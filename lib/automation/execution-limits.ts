/**
 * lib/automation/execution-limits.ts
 *
 * Centralized configuration for execution input/output size limits.
 *
 * SERVER-SIDE ONLY. All values are derived from server-side environment
 * variables and fall back to safe defaults if not configured.
 *
 * NEVER use NEXT_PUBLIC_ prefix for any limit env var — these are
 * implementation details that must remain server-side.
 */

// ─── Body / Input Limits ──────────────────────────────────────────────────────

/**
 * Maximum allowed Content-Length in bytes for the execution POST body.
 * Default: 32 KB.  Override via EXECUTION_MAX_BODY_BYTES.
 *
 * NOTE: This is a best-effort check on the Content-Length header. Next.js
 * may buffer the request body before the route handler receives it, so
 * Content-Length is not always present. The structural limits below are
 * the enforced backstop that applies post-parse.
 */
export const MAX_BODY_BYTES: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_BODY_BYTES);
  return Number.isFinite(v) && v > 0 ? v : 32 * 1024; // 32 KB
})();

/**
 * Maximum number of top-level keys allowed in the user-supplied input object.
 * Default: 50. Override via EXECUTION_MAX_INPUT_KEYS.
 */
export const MAX_INPUT_KEYS: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_INPUT_KEYS);
  return Number.isFinite(v) && v > 0 ? v : 50;
})();

/**
 * Maximum length (chars) for any string value within the input object.
 * Default: 10 000.  Override via EXECUTION_MAX_STRING_LENGTH.
 */
export const MAX_STRING_VALUE_LENGTH: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_STRING_LENGTH);
  return Number.isFinite(v) && v > 0 ? v : 10_000;
})();

/**
 * Maximum number of items allowed in any array within the input object.
 * Default: 100. Override via EXECUTION_MAX_ARRAY_ITEMS.
 */
export const MAX_ARRAY_ITEMS: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_ARRAY_ITEMS);
  return Number.isFinite(v) && v > 0 ? v : 100;
})();

/**
 * Maximum nested object depth allowed in the input object.
 * Default: 3. Override via EXECUTION_MAX_OBJECT_DEPTH.
 */
export const MAX_OBJECT_DEPTH: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_OBJECT_DEPTH);
  return Number.isFinite(v) && v > 0 ? v : 3;
})();

// ─── Output Limits ────────────────────────────────────────────────────────────

/**
 * Maximum serialized size (bytes) of execution output stored in the database
 * or returned to the client.
 * Default: 64 KB. Override via EXECUTION_MAX_OUTPUT_BYTES.
 *
 * If output exceeds this limit it is truncated safely and a truncation marker
 * is added before persistence.
 */
export const MAX_OUTPUT_BYTES: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_OUTPUT_BYTES);
  return Number.isFinite(v) && v > 0 ? v : 64 * 1024; // 64 KB
})();

// ─── Rate Limiting ────────────────────────────────────────────────────────────

/**
 * Sliding-window duration in milliseconds.
 * Default: 60 000 ms (1 minute). Override via EXECUTION_RATE_WINDOW_MS.
 */
export const RATE_WINDOW_MS: number = (() => {
  const v = Number(process.env.EXECUTION_RATE_WINDOW_MS);
  return Number.isFinite(v) && v > 0 ? v : 60_000;
})();

/**
 * Maximum execution triggers allowed per authenticated user per window.
 * Default: 10 per minute. Override via EXECUTION_RATE_LIMIT_PER_USER.
 */
export const RATE_LIMIT_PER_USER: number = (() => {
  const v = Number(process.env.EXECUTION_RATE_LIMIT_PER_USER);
  return Number.isFinite(v) && v > 0 ? v : 10;
})();

/**
 * Maximum execution triggers allowed per client IP per window.
 * The IP limit is a secondary safeguard; the user limit is the primary.
 * Default: 20 per minute. Override via EXECUTION_RATE_LIMIT_PER_IP.
 */
export const RATE_LIMIT_PER_IP: number = (() => {
  const v = Number(process.env.EXECUTION_RATE_LIMIT_PER_IP);
  return Number.isFinite(v) && v > 0 ? v : 20;
})();

/**
 * Maximum number of AutomationExecution records in RUNNING / QUEUED state
 * allowed simultaneously for a single user.
 * Default: 3. Override via EXECUTION_MAX_CONCURRENT.
 */
export const MAX_CONCURRENT_PER_USER: number = (() => {
  const v = Number(process.env.EXECUTION_MAX_CONCURRENT);
  return Number.isFinite(v) && v > 0 ? v : 3;
})();
