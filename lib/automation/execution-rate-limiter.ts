/**
 * lib/automation/execution-rate-limiter.ts
 *
 * SERVER-SIDE ONLY. In-process sliding-window rate limiter for automation
 * execution requests.
 *
 * ─── PRIMARY LIMIT ───────────────────────────────────────────────────────────
 * Keyed by authenticated Clerk user ID. An authenticated user cannot bypass
 * this limit by changing their IP address because Clerk session tokens are
 * independent of IP.
 *
 * ─── SECONDARY (IP) LIMIT ────────────────────────────────────────────────────
 * Keyed by client IP (derived from the centralized getClientIp utility, which
 * trusts x-real-ip set by the Vercel/nginx infrastructure layer, NOT
 * client-controllable headers). This limit is a secondary safeguard to limit
 * pre-auth flooding — it alone does NOT prevent a determined authenticated
 * attacker who can change IPs.
 *
 * ─── CONCURRENCY LIMIT ───────────────────────────────────────────────────────
 * A DB-backed count of QUEUED/RUNNING executions per user prevents a burst of
 * requests that all slip through the in-process limiter before it updates.
 * This check crosses serverless instances because it reads the database.
 *
 * ─── KNOWN LIMITATION ────────────────────────────────────────────────────────
 * This implementation uses in-process Maps for the sliding-window counters.
 * On serverless deployments (Vercel, AWS Lambda) where multiple function
 * instances may handle requests concurrently, each instance maintains its own
 * counter. A user could exceed the intended per-window limit by distributing
 * requests across instances.
 *
 * Mitigation: The DB-backed concurrent execution cap (MAX_CONCURRENT_PER_USER)
 * is cross-instance and provides a hard upper bound on simultaneously running
 * executions regardless of which instance processed the request.
 *
 * For a fully cross-instance rate limit, replace the Map-based counters with
 * a Redis atomic increment (e.g., Upstash Redis with @upstash/ratelimit).
 *
 * ─── SCOPE ───────────────────────────────────────────────────────────────────
 * This limiter applies ONLY to POST /api/automation-executions (trigger).
 * GET polling and GET list endpoints are NOT rate-limited by this module.
 */

import { prisma } from "@/lib/prisma";
import {
  RATE_WINDOW_MS,
  RATE_LIMIT_PER_USER,
  RATE_LIMIT_PER_IP,
  MAX_CONCURRENT_PER_USER,
} from "./execution-limits";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry. Only set when allowed === false. */
  retryAfterSeconds?: number;
  /** Which limit was hit — for internal logging only, never expose to client. */
  limitType?: "user" | "ip" | "concurrent";
}

// ─── In-process sliding-window stores ────────────────────────────────────────
// Each entry is an array of UTC timestamps (ms) of recent trigger calls.
// Old timestamps outside the window are pruned on each check.

const userWindowMap = new Map<string, number[]>();
const ipWindowMap = new Map<string, number[]>();

// ─── Sliding-window helper ────────────────────────────────────────────────────

function pruneWindow(timestamps: number[], now: number): number[] {
  const cutoff = now - RATE_WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

/**
 * Checks the sliding-window counter for a given key.
 *
 * @param store - The Map to read/write
 * @param key - The rate-limit key (userId or IP)
 * @param limit - Maximum allowed calls in the window
 * @param now - Current timestamp (ms)
 * @returns { allowed, retryAfterSeconds }
 */
function checkWindow(
  store: Map<string, number[]>,
  key: string,
  limit: number,
  now: number
): { allowed: boolean; retryAfterSeconds: number } {
  const raw = store.get(key) ?? [];
  const pruned = pruneWindow(raw, now);

  if (pruned.length >= limit) {
    // Oldest timestamp in window determines when the slot opens
    const oldest = pruned[0]!;
    const retryAfterMs = RATE_WINDOW_MS - (now - oldest);
    const retryAfterSeconds = Math.ceil(Math.max(retryAfterMs, 1000) / 1000);
    store.set(key, pruned); // Store pruned (no new entry — request rejected)
    return { allowed: false, retryAfterSeconds };
  }

  // Record this call
  pruned.push(now);
  store.set(key, pruned);
  return { allowed: true, retryAfterSeconds: 0 };
}

// ─── DB-backed concurrent execution count ─────────────────────────────────────

/**
 * Counts QUEUED + RUNNING executions for a user in the database.
 * This is cross-instance (reads the authoritative DB) and provides a hard
 * upper bound on simultaneously in-flight executions.
 */
async function countActiveConcurrentExecutions(
  clerkUserId: string
): Promise<number> {
  return prisma.automationExecution.count({
    where: {
      clerkUserId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks all execution rate limits before allowing an execution to proceed.
 *
 * Call order within execution pipeline:
 *   1. Clerk authentication  ← already done by route
 *   2. checkExecutionRateLimit()  ← THIS FUNCTION
 *   3. authorizeAutomationExecution()
 *   4. N8nClient.triggerWorkflow()
 *
 * @param clerkUserId - Authenticated Clerk user ID (from server session, never client)
 * @param clientIp - Client IP derived from getClientIp(req) — never raw header
 * @returns RateLimitResult
 */
export async function checkExecutionRateLimit(
  clerkUserId: string,
  clientIp: string
): Promise<RateLimitResult> {
  const now = Date.now();

  // ─── 1. User-level sliding window (primary, IP-bypass-resistant) ──────────
  const userCheck = checkWindow(userWindowMap, clerkUserId, RATE_LIMIT_PER_USER, now);
  if (!userCheck.allowed) {
    // Log internally — do not include limit values in client-facing errors
    console.warn(
      `[RateLimit] User limit hit: userId=${clerkUserId.slice(0, 8)}...`
    );
    return {
      allowed: false,
      retryAfterSeconds: userCheck.retryAfterSeconds,
      limitType: "user",
    };
  }

  // ─── 2. IP-level sliding window (secondary, pre-auth abuse safeguard) ────
  const ipCheck = checkWindow(ipWindowMap, clientIp, RATE_LIMIT_PER_IP, now);
  if (!ipCheck.allowed) {
    // Roll back the user-window entry we just recorded — the request is rejected.
    // (Remove the timestamp we just pushed to keep the user count accurate.)
    const userTimestamps = userWindowMap.get(clerkUserId);
    if (userTimestamps && userTimestamps.length > 0) {
      userTimestamps.pop(); // Remove the timestamp we just added
      userWindowMap.set(clerkUserId, userTimestamps);
    }
    console.warn(`[RateLimit] IP limit hit: ip=${clientIp}`);
    return {
      allowed: false,
      retryAfterSeconds: ipCheck.retryAfterSeconds,
      limitType: "ip",
    };
  }

  // ─── 3. Concurrent execution cap (DB-backed, cross-instance) ─────────────
  const activeCount = await countActiveConcurrentExecutions(clerkUserId);
  if (activeCount >= MAX_CONCURRENT_PER_USER) {
    // Roll back both window entries since we're rejecting
    const userTimestamps = userWindowMap.get(clerkUserId);
    if (userTimestamps && userTimestamps.length > 0) {
      userTimestamps.pop();
      userWindowMap.set(clerkUserId, userTimestamps);
    }
    const ipTimestamps = ipWindowMap.get(clientIp);
    if (ipTimestamps && ipTimestamps.length > 0) {
      ipTimestamps.pop();
      ipWindowMap.set(clientIp, ipTimestamps);
    }
    console.warn(
      `[RateLimit] Concurrent limit hit: userId=${clerkUserId.slice(0, 8)}... active=${activeCount}`
    );
    return {
      allowed: false,
      retryAfterSeconds: 30, // Suggest retry after existing executions may complete
      limitType: "concurrent",
    };
  }

  return { allowed: true };
}

// ─── Test helpers (not exported in production use) ────────────────────────────

/**
 * Resets all in-process counters. FOR TESTING ONLY.
 * Call between test cases to isolate limiter state.
 */
export function _resetLimiterState_TEST_ONLY(): void {
  userWindowMap.clear();
  ipWindowMap.clear();
}

/**
 * Returns current window snapshot for a user key. FOR TESTING ONLY.
 */
export function _getUserWindowCount_TEST_ONLY(userId: string): number {
  const now = Date.now();
  const raw = userWindowMap.get(userId) ?? [];
  return pruneWindow(raw, now).length;
}
