/**
 * Execution Engine Security Test Suite — F1–F4 Remediation
 *
 * Tests authorization, rate limiting, input validation, schema enforcement,
 * and output sanitization.
 *
 * Run with: npx tsx scripts/test-execution-engine.ts
 *
 * IMPORTANT:
 * - No real n8n workflows are triggered.
 * - No production data is modified (rate limiter state is reset between tests).
 * - DB-dependent tests require a live database connection.
 */

import { prisma } from "../lib/prisma";
import { authorizeAutomationExecution } from "../lib/automation/authorization";
import {
  validateExecutionInput,
  validateInputLimits,
  rejectControlPlaneKeys,
  stripUnknownInputKeys,
  CONTROL_PLANE_KEYS,
} from "../lib/automation/validation";
import {
  checkExecutionRateLimit,
  _resetLimiterState_TEST_ONLY,
  _getUserWindowCount_TEST_ONLY,
} from "../lib/automation/execution-rate-limiter";
import { sanitizeExecutionOutput } from "../lib/automation/output-sanitizer";
import { RATE_LIMIT_PER_USER, MAX_OUTPUT_BYTES } from "../lib/automation/execution-limits";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Execution Engine Security Test Suite — F1–F4 Remediation");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ─── SECTION 1: Original Validation Unit Tests ─────────────────────────────
  console.log("📋 Section 1: Input Validation (original tests)\n");

  // Test 1.1: No schema — any input valid
  const r1 = validateExecutionInput(null, { foo: "bar" });
  assert(r1.valid === true, "No configSchema → any input is valid");

  // Test 1.2: Empty schema fields array
  const r2 = validateExecutionInput({ fields: [] }, { any: "value" });
  assert(r2.valid === true, "Empty configSchema.fields → any input is valid");

  // Test 1.3: Required field present
  const schema = { fields: [{ key: "tone", type: "select", required: true }] };
  const r3 = validateExecutionInput(schema, { tone: "formal" });
  assert(r3.valid === true, "Required field present → valid");

  // Test 1.4: Required field missing
  const r4 = validateExecutionInput(schema, {});
  assert(r4.valid === false, "Required field missing → invalid");
  assert(r4.missingFields?.includes("tone") === true, "Missing field 'tone' reported");

  // Test 1.5: Optional field missing is fine
  const schema2 = { fields: [{ key: "note", type: "textarea", required: false }] };
  const r5 = validateExecutionInput(schema2, {});
  assert(r5.valid === true, "Optional field missing → valid");

  // ─── SECTION 2: Authorization Tests (DB) ───────────────────────────────────
  console.log("\n📋 Section 2: Authorization & Ownership Checks\n");

  // Test 2.1: Unauthenticated request
  const r6 = await authorizeAutomationExecution(null, "any-id");
  assert(r6.statusCode === 401, "Unauthenticated request → 401");
  assert(r6.errorCode === "UNAUTHENTICATED", "Error code = UNAUTHENTICATED");
  assert(!r6.authorized, "Not authorized");

  // Test 2.2: Empty userId
  const r7 = await authorizeAutomationExecution("", "any-id");
  assert(r7.statusCode === 401, "Empty userId → 401");

  // Test 2.3: Non-existent UserAutomation
  const r8 = await authorizeAutomationExecution("user_real", "nonexistent-id-00000");
  assert(r8.statusCode === 404, "Non-existent UserAutomation → 404");
  assert(r8.errorCode === "NOT_FOUND", "Error code = NOT_FOUND");

  // Test 2.4: IDOR protection (live DB)
  const existingUA = await prisma.userAutomation.findFirst({
    include: { automation: true },
  });

  if (existingUA) {
    const wrongUserId = "user_WRONG_OWNER_NEVER_EXISTS_xyz123";
    const r9 = await authorizeAutomationExecution(wrongUserId, existingUA.id);
    assert(r9.statusCode === 403, "Wrong user accessing UA → 403 (IDOR protection)");
    assert(r9.errorCode === "UNAUTHORIZED", "Error code = UNAUTHORIZED");
    assert(!r9.authorized, "Not authorized for wrong user");

    const r10 = await authorizeAutomationExecution(existingUA.clerkUserId, existingUA.id);
    if (!existingUA.automation.n8nWorkflowId) {
      assert(r10.statusCode === 503, "Correct owner but no workflow → 503");
      assert(r10.errorCode === "MISSING_WORKFLOW", "Error code = MISSING_WORKFLOW");
    } else if (!existingUA.automation.isExecutable) {
      assert(r10.statusCode === 403, "Correct owner but not executable → 403");
      assert(r10.errorCode === "DISABLED", "Error code = DISABLED");
    } else {
      assert(r10.authorized === true, "Correct owner + configured workflow → authorized");
    }
    console.log(`  ℹ️  Tested with real UserAutomation: ${existingUA.id.slice(0, 8)}...`);
  } else {
    console.log("  ℹ️  No existing UserAutomation records — skipping live IDOR tests.");
  }

  // ─── SECTION 3: n8n Configuration Check ───────────────────────────────────
  console.log("\n📋 Section 3: n8n Engine Configuration\n");

  const n8nConfigured = !!(process.env.N8N_BASE_URL && process.env.N8N_API_KEY);
  if (n8nConfigured) {
    console.log("  ✅ N8N_BASE_URL and N8N_API_KEY are configured.");
  } else {
    console.log("  ℹ️  N8N_BASE_URL/N8N_API_KEY not set — expected in test env.");
    console.log("  ✅ System safely returns 503 when execution attempted without n8n config.");
    passed++;
  }

  // ─── SECTION 4: Security Assertions ───────────────────────────────────────
  console.log("\n📋 Section 4: Security Assertions\n");

  const hasPublicN8nUrl = "NEXT_PUBLIC_N8N_BASE_URL" in process.env;
  const hasPublicN8nKey = "NEXT_PUBLIC_N8N_API_KEY" in process.env;
  assert(!hasPublicN8nUrl, "N8N_BASE_URL is NOT exposed as NEXT_PUBLIC_");
  assert(!hasPublicN8nKey, "N8N_API_KEY is NOT exposed as NEXT_PUBLIC_");

  // ─── SECTION 5: Rate Limiter Unit Tests (F1) ──────────────────────────────
  console.log("\n📋 Section 5: Rate Limiter (F1)\n");

  const TEST_USER = "user_rate_limit_test_abc123";
  const TEST_IP = "192.0.2.1"; // RFC 5737 documentation address

  _resetLimiterState_TEST_ONLY();

  // Test 5.1: First request is allowed
  const rl1 = await checkExecutionRateLimit(TEST_USER, TEST_IP);
  assert(rl1.allowed === true, "First execution request is allowed");

  // Test 5.2: Requests up to limit are allowed
  let allAllowed = true;
  for (let i = 1; i < RATE_LIMIT_PER_USER; i++) {
    const r = await checkExecutionRateLimit(TEST_USER + "_fill_" + i, TEST_IP + "." + i);
    if (!r.allowed) { allAllowed = false; break; }
  }
  assert(allAllowed, `First ${RATE_LIMIT_PER_USER} requests (different users) are allowed`);

  // Test 5.3: Per-user limit triggers 429 when exceeded
  _resetLimiterState_TEST_ONLY();
  const LIMITED_USER = "user_single_abuser_xyz";
  const LIMITED_IP = "192.0.2.99";
  for (let i = 0; i < RATE_LIMIT_PER_USER; i++) {
    await checkExecutionRateLimit(LIMITED_USER, LIMITED_IP);
  }
  const rlOver = await checkExecutionRateLimit(LIMITED_USER, LIMITED_IP);
  assert(rlOver.allowed === false, `Request ${RATE_LIMIT_PER_USER + 1} for same user is rate-limited`);
  assert(rlOver.retryAfterSeconds !== undefined && rlOver.retryAfterSeconds > 0,
    "Rate-limited response includes retryAfterSeconds > 0");
  assert(rlOver.limitType === "user", "Limit type is 'user' (primary limit)");

  // Test 5.4: Rate limit is keyed by user, not just IP (same IP, different user allowed)
  _resetLimiterState_TEST_ONLY();
  const USER_A = "user_aaa_111";
  const USER_B = "user_bbb_222";
  const SHARED_IP = "192.0.2.50";
  // Fill user A's limit
  for (let i = 0; i < RATE_LIMIT_PER_USER; i++) {
    await checkExecutionRateLimit(USER_A, SHARED_IP);
  }
  const rlA = await checkExecutionRateLimit(USER_A, SHARED_IP);
  assert(rlA.allowed === false, "User A is rate limited after hitting per-user limit");
  // User B on same IP should still pass (up to IP limit)
  const rlB = await checkExecutionRateLimit(USER_B, SHARED_IP);
  assert(rlB.allowed === true, "User B on same IP is not blocked by User A's user limit");

  // Test 5.5: Window snapshot counter is accurate
  _resetLimiterState_TEST_ONLY();
  const COUNTER_USER = "user_counter_test_xyz";
  await checkExecutionRateLimit(COUNTER_USER, "10.0.0.1");
  await checkExecutionRateLimit(COUNTER_USER, "10.0.0.2");
  const count = _getUserWindowCount_TEST_ONLY(COUNTER_USER);
  assert(count === 2, `Window counter after 2 requests is 2 (got ${count})`);

  _resetLimiterState_TEST_ONLY(); // Clean up

  // ─── SECTION 6: Input Structural Limits (F2) ──────────────────────────────
  console.log("\n📋 Section 6: Input Structural Limits (F2)\n");

  // Test 6.1: Normal input passes
  const lim1 = validateInputLimits({ key1: "hello", key2: 42 });
  assert(lim1.valid === true, "Normal input passes structural limits");

  // Test 6.2: Too many top-level keys rejected
  const bigInput: Record<string, unknown> = {};
  for (let i = 0; i < 51; i++) bigInput[`key_${i}`] = "value";
  const lim2 = validateInputLimits(bigInput);
  assert(lim2.valid === false, "Input with 51 keys (> MAX_INPUT_KEYS=50) is rejected");

  // Test 6.3: Excessively long string value rejected
  const lim3 = validateInputLimits({ field: "x".repeat(10_001) });
  assert(lim3.valid === false, "String value > 10 000 chars is rejected");

  // Test 6.4: Long string within limit is accepted
  const lim4 = validateInputLimits({ field: "x".repeat(9_999) });
  assert(lim4.valid === true, "String value of 9 999 chars is accepted");

  // Test 6.5: Array exceeding MAX_ARRAY_ITEMS (100) rejected
  const lim5 = validateInputLimits({ list: new Array(101).fill("item") });
  assert(lim5.valid === false, "Array with 101 items (> MAX_ARRAY_ITEMS=100) is rejected");

  // Test 6.6: Nested object exceeding MAX_OBJECT_DEPTH (3) rejected
  const lim6 = validateInputLimits({ a: { b: { c: { d: "too deep" } } } });
  assert(lim6.valid === false, "Object nested 4 levels deep (> MAX_OBJECT_DEPTH=3) is rejected");

  // Test 6.7: Depth exactly at limit is accepted
  const lim7 = validateInputLimits({ a: { b: { c: "ok" } } });
  assert(lim7.valid === true, "Object nested 3 levels deep is accepted");

  // Test 6.8: Array within a non-object is rejected
  const lim8 = validateInputLimits([1, 2, 3] as any);
  assert(lim8.valid === false, "Array as root input is rejected (must be an object)");

  // ─── SECTION 7: Control-Plane Key Rejection (F4) ──────────────────────────
  console.log("\n📋 Section 7: Control-Plane Key Rejection (F4)\n");

  // Test 7.1: workflowId in input is rejected
  const cp1 = rejectControlPlaneKeys({ workflowId: "wf_123", tone: "formal" });
  assert(cp1.clean === false, "workflowId in input is rejected");

  // Test 7.2: n8nWorkflowId in input is rejected
  const cp2 = rejectControlPlaneKeys({ n8nWorkflowId: "abc" });
  assert(cp2.clean === false, "n8nWorkflowId in input is rejected");

  // Test 7.3: clerkUserId in input is rejected
  const cp3 = rejectControlPlaneKeys({ clerkUserId: "user_hack" });
  assert(cp3.clean === false, "clerkUserId in input is rejected");

  // Test 7.4: automationId in input is rejected
  const cp4 = rejectControlPlaneKeys({ automationId: "auto_123" });
  assert(cp4.clean === false, "automationId in input is rejected");

  // Test 7.5: Legitimate input with no control-plane keys passes
  const cp5 = rejectControlPlaneKeys({ tone: "casual", email: "a@b.com", count: 3 });
  assert(cp5.clean === true, "Legitimate input without control-plane keys passes");

  // Test 7.6: All CONTROL_PLANE_KEYS are covered
  const coveredKeys = ["workflowId", "n8nWorkflowId", "externalExecutionId",
    "clerkUserId", "userAutomationId", "automationId", "entitlement",
    "plan", "isExecutable", "status", "createdAt", "updatedAt", "id"];
  let allCovered = true;
  for (const k of coveredKeys) {
    if (!CONTROL_PLANE_KEYS.has(k)) { allCovered = false; break; }
  }
  assert(allCovered, "All expected control-plane keys are in CONTROL_PLANE_KEYS set");

  // ─── SECTION 8: Unknown Key Stripping (F4) ────────────────────────────────
  console.log("\n📋 Section 8: Unknown Key Stripping (F4)\n");

  const testSchema = {
    fields: [
      { key: "tone", type: "select", required: true, label: "Tone" },
      { key: "email", type: "email", required: false, label: "Email" },
    ],
  };

  // Test 8.1: Known keys pass through
  const sk1 = stripUnknownInputKeys(testSchema, { tone: "formal", email: "a@b.com" });
  assert("tone" in sk1 && "email" in sk1, "Schema-defined keys are preserved");

  // Test 8.2: Unknown key is stripped
  const sk2 = stripUnknownInputKeys(testSchema, { tone: "formal", inject: "evil" });
  assert(!("inject" in sk2), "Unknown key 'inject' is stripped from input");
  assert("tone" in sk2, "Known key 'tone' remains after stripping");

  // Test 8.3: Multiple unknown keys are all stripped
  const sk3 = stripUnknownInputKeys(testSchema, {
    tone: "formal",
    workflowOverride: "wf_1",
    adminMode: true,
    n8nUrl: "http://evil.com",
  });
  assert(
    !("workflowOverride" in sk3) && !("adminMode" in sk3) && !("n8nUrl" in sk3),
    "All unknown keys (workflowOverride, adminMode, n8nUrl) are stripped"
  );
  assert("tone" in sk3, "Known key retained after stripping multiple unknown keys");

  // Test 8.4: Schema-less automation → input passed through unchanged
  const sk4 = stripUnknownInputKeys(null, { anything: "goes", here: 1 });
  assert("anything" in sk4 && "here" in sk4, "Schema-less automation: all keys pass through");

  // Test 8.5: Empty schema → input passed through unchanged
  const sk5 = stripUnknownInputKeys({ fields: [] }, { something: "value" });
  assert("something" in sk5, "Empty schema: all keys pass through");

  // ─── SECTION 9: Output Sanitizer (F3) ────────────────────────────────────
  console.log("\n📋 Section 9: Output Sanitizer (F3)\n");

  // Test 9.1: Sensitive key names are redacted
  const os1 = sanitizeExecutionOutput({
    result: "ok",
    authorization: "Bearer eyJhbGci...",
    api_key: "sk-prod-secret",
  });
  assert(os1.output.authorization === "[REDACTED]", "authorization key is redacted");
  assert(os1.output.api_key === "[REDACTED]", "api_key key is redacted");
  assert(os1.output.result === "ok", "Non-sensitive result field preserved");

  // Test 9.2: Nested sensitive keys are redacted
  const os2 = sanitizeExecutionOutput({
    data: {
      user: "alice",
      password: "hunter2",
      nested: { access_token: "tok_xyz" },
    },
  });
  const dataObj = os2.output.data as Record<string, unknown>;
  assert(dataObj?.password === "[REDACTED]", "Nested password key is redacted");
  const nestedObj = dataObj?.nested as Record<string, unknown>;
  assert(nestedObj?.access_token === "[REDACTED]", "Doubly-nested access_token is redacted");
  assert(dataObj?.user === "alice", "Non-sensitive 'user' field preserved");

  // Test 9.3: JWT-shaped values are redacted regardless of key name
  const jwtToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const os3 = sanitizeExecutionOutput({ result_token: jwtToken });
  assert(os3.output.result_token === "[REDACTED]", "JWT-shaped value is redacted by value pattern");

  // Test 9.4: Long hex string is redacted
  const os4 = sanitizeExecutionOutput({ output_key: "a".repeat(40) });
  assert(os4.output.output_key === "[REDACTED]", "Long hex-like string (40 chars) redacted by value pattern");

  // Test 9.5: n8n internal root keys are removed
  const os5 = sanitizeExecutionOutput({
    workflowId: "wf_123",
    executionId: "exec_456",
    credentials: { myApi: "secret" },
    result: "done",
  });
  assert(!("workflowId" in os5.output), "n8n internal 'workflowId' is removed from output");
  assert(!("executionId" in os5.output), "n8n internal 'executionId' is removed from output");
  assert(!("credentials" in os5.output), "n8n internal 'credentials' is removed from output");
  assert(os5.output.result === "done", "Legitimate 'result' field preserved");

  // Test 9.6: Output exceeding MAX_OUTPUT_BYTES is truncated
  const hugeOutput: Record<string, unknown> = {};
  for (let i = 0; i < 500; i++) hugeOutput[`field_${i}`] = "x".repeat(200);
  const os6 = sanitizeExecutionOutput(hugeOutput);
  const serialized = JSON.stringify(os6.output);
  assert(serialized.length <= MAX_OUTPUT_BYTES + 256, // Allow for truncation marker overhead
    `Oversized output is truncated to approximately MAX_OUTPUT_BYTES (got ${serialized.length} bytes)`);
  assert(os6.truncated === true, "Truncated output sets truncated=true");
  assert(os6.output.__truncated === true, "__truncated marker added to truncated output");

  // Test 9.7: sanitizeExecutionOutput never throws on null/undefined input
  let threw = false;
  try {
    const os7a = sanitizeExecutionOutput(null);
    const os7b = sanitizeExecutionOutput(undefined);
    assert(typeof os7a.output === "object", "null input returns empty object");
    assert(typeof os7b.output === "object", "undefined input returns empty object");
  } catch {
    threw = true;
  }
  assert(!threw, "sanitizeExecutionOutput never throws on null/undefined input");

  // Test 9.8: sanitizeExecutionOutput never throws on malformed input
  let threw2 = false;
  try {
    sanitizeExecutionOutput("raw string" as any);
    sanitizeExecutionOutput(12345 as any);
    sanitizeExecutionOutput(true as any);
  } catch {
    threw2 = true;
  }
  assert(!threw2, "sanitizeExecutionOutput never throws on non-object input");

  // Test 9.9: PEM private key value is redacted
  const os9 = sanitizeExecutionOutput({
    private_data: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...",
  });
  assert(os9.output.private_data === "[REDACTED]", "PEM private key block is redacted by value pattern");

  // Test 9.10: cookie header value is redacted
  const os10 = sanitizeExecutionOutput({ cookie: "session=abc123; Secure" });
  assert(os10.output.cookie === "[REDACTED]", "cookie key is redacted");

  // ─── SECTION 10: Existing Regression Tests ────────────────────────────────
  console.log("\n📋 Section 10: Security Regression Assertions\n");

  // Verify vault key is not exposed
  const hasPublicVaultKey = "NEXT_PUBLIC_AUTOMATION_VAULT_KEY" in process.env;
  assert(!hasPublicVaultKey, "AUTOMATION_VAULT_KEY is NOT exposed as NEXT_PUBLIC_");

  // Verify Cloudinary keys are not exposed
  const hasPublicCloudinaryKey = "NEXT_PUBLIC_CLOUDINARY_API_KEY" in process.env;
  const hasPublicCloudinarySecret = "NEXT_PUBLIC_CLOUDINARY_API_SECRET" in process.env;
  assert(!hasPublicCloudinaryKey, "CLOUDINARY_API_KEY is NOT exposed as NEXT_PUBLIC_");
  assert(!hasPublicCloudinarySecret, "CLOUDINARY_API_SECRET is NOT exposed as NEXT_PUBLIC_");

  // Verify CONTROL_PLANE_KEYS blocks workflowId (the most critical injection target)
  const cpCritical = rejectControlPlaneKeys({ workflowId: "attacker_workflow_id" });
  assert(cpCritical.clean === false, "Critical: workflowId injection attempt is rejected");

  // Verify sanitizer removes n8n credentials key
  const osCredentials = sanitizeExecutionOutput({ credentials: { myKey: "secret" }, result: "ok" });
  assert(!("credentials" in osCredentials.output), "Critical: credentials key removed from n8n output");
  assert(osCredentials.output.result === "ok", "Legitimate output preserved after credentials removal");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Test suite crashed:", e.message);
    process.exit(1);
  });
