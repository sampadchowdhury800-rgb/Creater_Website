import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { ExecutionService } from "@/lib/automation/execution-service";
import { checkExecutionRateLimit } from "@/lib/automation/execution-rate-limiter";
import { MAX_BODY_BYTES } from "@/lib/automation/execution-limits";
import { getClientIp } from "@/lib/security/ip-utils";

/**
 * POST /api/automation-executions
 *
 * Triggers a secure automation execution.
 *
 * Request body:
 * {
 *   "userAutomationId": "...",
 *   "input": { ... }   // optional, validated against Automation.configSchema
 * }
 *
 * SECURITY:
 * - Requires Clerk authentication.
 * - Rate limited per user (primary) and per IP (secondary). [F1]
 * - Request body size is checked before parsing where Content-Length is present. [F2]
 * - Client NEVER supplies workflowId — only userAutomationId. [F4]
 * - Control-plane keys (workflowId, clerkUserId, etc.) are rejected. [F4]
 * - Unknown input keys are stripped to schema-defined keys only. [F4]
 * - n8n output is sanitized before persistence and again at response time. [F3]
 * - Server resolves n8nWorkflowId via DB lookup after ownership verification.
 * - All sensitive values stay server-side.
 * - Returns sanitized error messages — no stack traces, no internal details.
 *
 * RATE LIMITING NOTE:
 * Uses an in-process sliding-window limiter (lib/automation/execution-rate-limiter.ts).
 * On serverless deployments with multiple instances, each instance has its own
 * counter. The DB-backed concurrent execution cap provides a cross-instance backstop.
 * For full cross-instance limiting, replace with a Redis-backed solution.
 */
export async function POST(req: NextRequest) {
  // ─── Authentication ─────────────────────────────────────────────────────────
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  // ─── F2: Pre-parse body size check (best-effort via Content-Length) ─────────
  // Next.js may buffer the body before the route handler sees it, so
  // Content-Length is not always present. The structural limits applied
  // by validateInputLimits() inside ExecutionService are the enforced backstop.
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large.", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 }
      );
    }
  }

  // ─── F1: Rate limiting (must occur before any DB writes or n8n dispatch) ────
  // Primary: per authenticated Clerk user ID (IP-bypass-resistant).
  // Secondary: per client IP (from centralized utility — not client-spoofable).
  // Tertiary: DB-backed concurrent execution cap (cross-instance safe).
  const clientIp = getClientIp(req);
  const rateResult = await checkExecutionRateLimit(clerkUserId, clientIp);
  if (!rateResult.allowed) {
    const headers: Record<string, string> = {};
    if (rateResult.retryAfterSeconds) {
      headers["Retry-After"] = String(rateResult.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        error: "Too many execution requests. Please wait before retrying.",
        code: "RATE_LIMITED",
      },
      { status: 429, headers }
    );
  }

  // ─── Parse Request Body ──────────────────────────────────────────────────────
  let body: { userAutomationId?: string; input?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body.", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const { userAutomationId, input } = body;

  if (!userAutomationId || typeof userAutomationId !== "string") {
    return NextResponse.json(
      { error: "userAutomationId is required.", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // ─── Execute via Service (contains full auth + ownership + validation) ───────
  // ExecutionService applies in order:
  //   1. rejectControlPlaneKeys()        (F4)
  //   2. validateInputLimits()           (F2 — structural backstop)
  //   3. authorizeAutomationExecution()  (ownership + entitlement)
  //   4. stripUnknownInputKeys()         (F4 — schema whitelist)
  //   5. validateExecutionInput()        (schema field validation)
  //   6. n8n dispatch
  //   7. sanitizeExecutionOutput()       (F3 — persistence-time sanitization)
  const result = await ExecutionService.triggerExecution({
    clerkUserId,
    userAutomationId,
    input: input && typeof input === "object" ? input : {},
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.errorMessage, code: result.errorCode },
      { status: result.statusCode }
    );
  }

  return NextResponse.json(
    { success: true, execution: result.execution },
    { status: 200 }
  );
}

/**
 * GET /api/automation-executions?userAutomationId=...
 *
 * Returns real execution history for a specific UserAutomation workspace.
 *
 * SECURITY:
 * - Requires Clerk authentication.
 * - Verifies ownership of the UserAutomation before returning any records.
 * - Returns sanitized execution data — no raw n8n secrets, no internal errors.
 * - Output fields are stripped of potentially sensitive values.
 * - NOT rate-limited by the execution rate limiter (read-only polling endpoint).
 */
export async function GET(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const userAutomationId = searchParams.get("userAutomationId");

  if (!userAutomationId) {
    return NextResponse.json(
      { error: "userAutomationId query parameter is required.", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // ─── Ownership Verification ───────────────────────────────────────────────
  const userAutomation = await prisma.userAutomation.findUnique({
    where: { id: userAutomationId },
    select: { clerkUserId: true },
  });

  if (!userAutomation) {
    return NextResponse.json(
      { error: "Automation workspace not found.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // IDOR Protection — verify caller owns this record
  if (userAutomation.clerkUserId !== clerkUserId) {
    return NextResponse.json(
      { error: "Access denied.", code: "UNAUTHORIZED" },
      { status: 403 }
    );
  }

  // ─── Fetch Real Execution Records ─────────────────────────────────────────
  const executions = await prisma.automationExecution.findMany({
    where: { userAutomationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      // IMPORTANT: Intentionally omit 'input', 'output', 'externalExecutionId'
      // from the list view to avoid bulk data exposure.
      // Use GET /api/automation-executions/[id] for detail view.
      error: true,
    },
  });

  return NextResponse.json({ executions });
}
