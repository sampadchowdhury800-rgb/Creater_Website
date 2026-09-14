/**
 * lib/automation/output-sanitizer.ts
 *
 * SERVER-SIDE ONLY. Sanitizes n8n execution output before database persistence
 * and before API response.
 *
 * ─── DEFENSE-IN-DEPTH STRATEGY ───────────────────────────────────────────────
 * This sanitizer is applied at TWO points in the execution pipeline:
 *
 *   1. PERSISTENCE TIME (ExecutionService, before DB write):
 *      Prevents secrets from ever entering AutomationExecution.output in the DB.
 *
 *   2. RESPONSE TIME (GET /api/automation-executions/[id]):
 *      Re-sanitizes historical records so that any output written before this
 *      fix was deployed cannot be blindly returned to the client.
 *
 * ─── IMPORTANT LIMITATIONS ───────────────────────────────────────────────────
 * Regex-based redaction catches common patterns but CANNOT guarantee that all
 * secrets are detected. Some secrets may have non-standard field names or be
 * embedded within longer strings in unrecognized formats.
 *
 * This module is one layer of a defence-in-depth strategy. The vault service
 * (lib/automation/vault-service.ts) ensures that actual credential values are
 * never passed through the execution output path in the first place.
 *
 * ─── SCOPE ───────────────────────────────────────────────────────────────────
 * Applies to execution output from n8n only. User-supplied input is handled
 * separately by maskSensitiveInput() in vault-service.ts.
 */

import { MAX_OUTPUT_BYTES } from "./execution-limits";

// ─── Patterns ─────────────────────────────────────────────────────────────────

/**
 * Field key patterns that indicate a sensitive value regardless of content.
 * Matched case-insensitively against all object keys in the output tree.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /authorization/i,
  /bearer/i,
  /api[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /oauth/i,
  /cookie/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
  /webhook/i,
  /credential/i,
  /database[_-]?url/i,
  /connection[_-]?string/i,
  /db[_-]?url/i,
  /x-n8n-/i,
  /n8n[_-]?api/i,
  /auth[_-]?token/i,
  /session[_-]?token/i,
  /signing[_-]?key/i,
  /encryption[_-]?key/i,
  /vault[_-]?key/i,
  /smtp[_-]?pass/i,
  /twilio/i,
  /stripe[_-]?key/i,
  /stripe[_-]?secret/i,
];

/**
 * n8n-internal top-level keys that reveal execution infrastructure details.
 * These are removed from the root of the output object.
 */
const N8N_INTERNAL_ROOT_KEYS: Set<string> = new Set([
  "credentials",
  "settings",
  "staticData",
  "workflowId",
  "executionId",
  "workflowName",
  "finished",
  "mode",
  "startedAt",
  "stoppedAt",
  "retrySuccessId",
  "retryOf",
]);

/**
 * Value patterns that look like secrets regardless of the key name.
 *
 * These heuristics catch obvious formats; they are NOT exhaustive.
 */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  // JWT / base64url tokens (eyJ... → typical JWT/OAuth token prefix)
  /^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/,
  // PEM private key blocks
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  // Long hex strings ≥ 40 chars (common for API keys, HMAC secrets)
  /^[0-9a-fA-F]{40,}$/,
  // AWS access key style: AKIA...
  /^AKIA[0-9A-Z]{16}/,
  // Generic "Bearer <token>" strings
  /^Bearer\s+\S{8,}/i,
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SanitizeResult {
  /** The sanitized, safe-to-store output object. */
  output: Record<string, unknown>;
  /** True if the output was truncated due to exceeding MAX_OUTPUT_BYTES. */
  truncated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((re) => re.test(value));
}

/**
 * Recursively sanitizes an unknown value.
 *
 * @param value - The value to sanitize
 * @param depth - Current depth in the tree (to avoid deep recursion)
 * @param maxDepth - Maximum recursion depth before values are replaced
 * @returns Sanitized value safe to store/return
 */
function sanitizeValue(value: unknown, depth: number, maxDepth = 10): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (isSensitiveValue(value)) return "[REDACTED]";
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= maxDepth) return "[DEPTH_LIMIT]";
    return value
      .slice(0, 500) // Limit array length
      .map((item) => sanitizeValue(item, depth + 1, maxDepth));
  }

  if (typeof value === "object") {
    if (depth >= maxDepth) return "[DEPTH_LIMIT]";
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isSensitiveKey(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitizeValue(v, depth + 1, maxDepth);
      }
    }
    return result;
  }

  // Function, symbol, bigint, etc. — drop
  return undefined;
}

// ─── Main Sanitizer ───────────────────────────────────────────────────────────

/**
 * Sanitizes raw n8n execution output before database persistence or API response.
 *
 * Applies in order:
 *   1. Type guard — rejects non-object input safely
 *   2. Remove n8n internal root-level metadata keys
 *   3. Recursively redact sensitive keys and suspicious values
 *   4. Serialize and enforce MAX_OUTPUT_BYTES; truncate if exceeded
 *
 * NEVER throws — if sanitization fails for any reason, returns an empty
 * safe output object with a truncation marker.
 *
 * @param raw - Raw n8n response data (may be any shape)
 * @returns SanitizeResult with sanitized output and truncation flag
 */
export function sanitizeExecutionOutput(raw: unknown): SanitizeResult {
  try {
    // Step 1: Ensure we have an object to work with
    if (raw === null || raw === undefined) {
      return { output: {}, truncated: false };
    }

    let rootObj: Record<string, unknown>;
    if (typeof raw !== "object" || Array.isArray(raw)) {
      // Wrap non-object output in a safe envelope
      rootObj = { result: raw };
    } else {
      rootObj = raw as Record<string, unknown>;
    }

    // Step 2: Remove n8n internal root-level keys that expose infrastructure
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rootObj)) {
      if (N8N_INTERNAL_ROOT_KEYS.has(k)) continue; // Drop internal keys
      filtered[k] = v;
    }

    // Step 3: Recursively sanitize sensitive key names and suspicious values
    const sanitized = sanitizeValue(filtered, 0) as Record<string, unknown>;

    // Step 4: Enforce serialized size limit
    let serialized: string;
    try {
      serialized = JSON.stringify(sanitized);
    } catch {
      // If JSON.stringify fails (circular refs, etc.), return empty safe output
      return {
        output: { __error: "Output serialization failed." },
        truncated: true,
      };
    }

    if (serialized.length <= MAX_OUTPUT_BYTES) {
      return { output: sanitized, truncated: false };
    }

    // Truncate: find safe keys to keep within the byte budget
    const truncated: Record<string, unknown> = {};
    let budget = MAX_OUTPUT_BYTES - 128; // Leave room for the truncation marker
    for (const [k, v] of Object.entries(sanitized)) {
      const entry = JSON.stringify({ [k]: v });
      if (budget - entry.length >= 0) {
        truncated[k] = v;
        budget -= entry.length;
      }
    }
    truncated.__truncated = true;
    truncated.__truncatedAt = new Date().toISOString();

    return { output: truncated, truncated: true };
  } catch (err) {
    // Absolute safety net — sanitizer must never throw into the caller
    console.error("[OutputSanitizer] Unexpected sanitization error:", err instanceof Error ? err.message : err);
    return {
      output: { __error: "Output processing failed." },
      truncated: true,
    };
  }
}
