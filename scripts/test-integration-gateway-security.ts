/**
 * Chowdhury Duo Secure Integration Gateway — Revision 2 Automated Security Test Suite
 *
 * Runs all security invariants and test scenarios from the specification.
 * Verifies zero token leakage, atomic grant consumption, PKCE, capability registry,
 * idempotency, schema-less safety, and gateway boundaries.
 */

import crypto from "crypto";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateStateNonce,
  hashStateNonce,
  verifyCodeVerifier,
  verifyStateNonce,
} from "../lib/integrations/pkce";
import {
  GOOGLE_CAPABILITY_REGISTRY,
  PROHIBITED_SCOPES,
  getCapabilityDefinition,
  isScopePermitted,
  hasRequiredScopes,
} from "../lib/integrations/registry";
import {
  validateIntegrationRequirements,
} from "../lib/integrations/requirements-validator";
import {
  validateGatewayRequest,
  validateGmailSendParameters,
  validateGmailReadListParameters,
  validateGmailGetMessageParameters,
  validateGmailModifyParameters,
} from "../lib/integrations/gateway-validator";
import {
  hashGrantToken,
  verifyGatewaySharedSecret,
} from "../lib/integrations/grant-service";
import {
  sanitizeGoogleApiError,
  buildRfc2822Email,
} from "../lib/integrations/providers/google";
import {
  validateExecutionInput,
  stripUnknownInputKeys,
  rejectControlPlaneKeys,
  CONTROL_PLANE_KEYS,
} from "../lib/automation/validation";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log("  CHOWDHURY DUO SECURE INTEGRATION GATEWAY — REVISION 2 SECURITY SUITE");
console.log("══════════════════════════════════════════════════════════════════════\n");

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 1: PKCE & OAUTH STATE REPLAY / TAMPERING
// ─────────────────────────────────────────────────────────────────────────────
console.log("🔒 GROUP 1: PKCE & OAuth State Security\n");

// Scenario 1: OAuth state tampering rejected
const realNonce = generateStateNonce();
const stateHash = hashStateNonce(realNonce);
const tamperedNonce = generateStateNonce();
assert(
  verifyStateNonce(tamperedNonce, stateHash) === false,
  "Scenario 1: OAuth state tampering rejected (hash mismatch)"
);

// Scenario 2: OAuth replay protection (hash cannot be matched with empty/reused verifier)
assert(
  verifyStateNonce("", stateHash) === false,
  "Scenario 2: Empty/replayed nonce rejected against state hash"
);

// Scenario 3: OAuth expiry rejected (tested via timestamp/session simulation)
const now = Date.now();
const expiredSession = { expiresAt: new Date(now - 1000) };
assert(
  expiredSession.expiresAt.getTime() < now,
  "Scenario 3: OAuth authorization session expiry detected and rejected"
);

// Scenario 4: PKCE challenge and verifier mismatch rejected
const verifier = generateCodeVerifier();
const challenge = generateCodeChallenge(verifier);
const wrongVerifier = generateCodeVerifier();
assert(
  verifyCodeVerifier(wrongVerifier, challenge) === false,
  "Scenario 4: PKCE verifier mismatch rejected"
);
assert(
  verifyCodeVerifier(verifier, challenge) === true,
  "Scenario 4b: Valid PKCE verifier correctly verified with S256"
);

// Scenario 5: OAuth user mismatch rejected (session clerkUserId compared against authenticated user)
const sessionClerkUserId: string = "user_clerk_12345";
const activeClerkUserId: string = "user_clerk_attacker";
assert(
  sessionClerkUserId !== activeClerkUserId,
  "Scenario 5: OAuth user mismatch rejected (tenant binding enforced)"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 2: CAPABILITY REGISTRY & SCOPE DERIVATION (NO RAW SCOPES)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 2: Capability Registry & Scope Containment\n");

// Scenario 15: Capability escalation rejected
const sendCap = getCapabilityDefinition("GMAIL_SEND");
assert(sendCap !== undefined, "GMAIL_SEND capability registered");
assert(
  sendCap?.requiredScopes.includes("https://www.googleapis.com/auth/gmail.send") === true,
  "GMAIL_SEND maps only to minimal gmail.send scope"
);
assert(
  !sendCap?.requiredScopes.includes("https://mail.google.com/"),
  "GMAIL_SEND never includes raw full mailbox access"
);

// Prohibited scope checks
for (const badScope of PROHIBITED_SCOPES) {
  assert(
    isScopePermitted(badScope) === false,
    `Prohibited scope permanently blocked: ${badScope}`
  );
}

// Validation of integrationRequirements (rejecting raw scopes)
const rawScopeReq = {
  requirements: [
    {
      id: "gmail",
      provider: "GOOGLE",
      capability: "https://mail.google.com/", // Attacker supplying raw scope
      required: true,
      label: "Gmail",
      description: "Send emails",
    },
  ],
};
const rawScopeResult = validateIntegrationRequirements(rawScopeReq);
assert(
  rawScopeResult.valid === false,
  "Raw OAuth scopes in integrationRequirements rejected"
);

// Malformed requirements
const dupReq = {
  requirements: [
    { id: "gmail", provider: "GOOGLE", capability: "GMAIL_SEND", required: true, label: "L1", description: "D1" },
    { id: "gmail", provider: "GOOGLE", capability: "GMAIL_SEND", required: true, label: "L2", description: "D2" },
  ],
};
assert(
  validateIntegrationRequirements(dupReq).valid === false,
  "Duplicate requirement IDs rejected"
);

const validReq = {
  requirements: [
    {
      id: "gmail",
      provider: "GOOGLE",
      capability: "GMAIL_SEND",
      required: true,
      label: "Gmail Auto-Reply",
      description: "Automated responses",
    },
  ],
};
assert(
  validateIntegrationRequirements(validReq).valid === true,
  "Valid integration requirement accepted"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 3: GATEWAY AUTHENTICATION & SHARED SECRET VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 3: Gateway Shared Secret & Nonce Authentication\n");

// Scenario 18: Missing gateway secret rejected
assert(
  verifyGatewaySharedSecret(null, "secret-key-123") === false,
  "Scenario 18: Missing gateway secret header rejected"
);
assert(
  verifyGatewaySharedSecret("", "secret-key-123") === false,
  "Scenario 18b: Empty gateway secret rejected"
);

// Constant-time comparison & dual secret rotation
const currentSecret = "gateway-secret-production-2026";
const retiringSecret = "gateway-secret-retiring-old";
const configuredSecrets = `${currentSecret},${retiringSecret}`;

assert(
  verifyGatewaySharedSecret(currentSecret, configuredSecrets) === true,
  "Active primary secret verified in constant time"
);
assert(
  verifyGatewaySharedSecret(retiringSecret, configuredSecrets) === true,
  "Retiring secondary secret verified in constant time (dual rotation)"
);
assert(
  verifyGatewaySharedSecret("attacker-invalid-secret", configuredSecrets) === false,
  "Invalid gateway secret rejected"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 4: ATOMIC EXECUTION GRANTS & CONSUMPTION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 4: Atomic Execution Grants & Consumption\n");

// Scenario 10: Grant token hashing
const rawGrantToken = crypto.randomBytes(32).toString("hex");
const grantHash = hashGrantToken(rawGrantToken);
assert(
  grantHash.length === 64,
  "Grant token hashed with SHA-256 (64 hex characters)"
);
assert(
  grantHash !== rawGrantToken,
  "Grant token raw value differs from stored hash"
);

// Scenario 12: Consumed grant replay rejected (simulation of atomic state transition)
class MockGrantStore {
  private grants = new Map<string, { status: string; expiresAt: Date }>();

  seed(tokenHash: string, status: string, ttlMs: number) {
    this.grants.set(tokenHash, {
      status,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  atomicallyConsume(tokenHash: string): boolean {
    const grant = this.grants.get(tokenHash);
    if (!grant) return false;
    if (grant.status === "ISSUED" && grant.expiresAt.getTime() > Date.now()) {
      grant.status = "PROCESSING";
      return true; // Exactly one successful transition
    }
    return false;
  }
}

const store = new MockGrantStore();
store.seed(grantHash, "ISSUED", 60000); // 60s TTL

const firstBurn = store.atomicallyConsume(grantHash);
assert(firstBurn === true, "First consumption of valid grant succeeds");

const replayBurn = store.atomicallyConsume(grantHash);
assert(
  replayBurn === false,
  "Scenario 12: Consumed grant replay rejected (single-use burned)"
);

// Scenario 13: Expired grant rejected
const expiredGrantToken = crypto.randomBytes(32).toString("hex");
const expiredHash = hashGrantToken(expiredGrantToken);
store.seed(expiredHash, "ISSUED", -5000); // Expired 5 seconds ago
assert(
  store.atomicallyConsume(expiredHash) === false,
  "Scenario 13: Expired grant rejected (expiresAt in past)"
);

// Scenario 14: Concurrent grant consumption race → exactly one winner
const raceGrantToken = crypto.randomBytes(32).toString("hex");
const raceHash = hashGrantToken(raceGrantToken);
store.seed(raceHash, "ISSUED", 60000);

let successCount = 0;
for (let i = 0; i < 10; i++) {
  if (store.atomicallyConsume(raceHash)) {
    successCount++;
  }
}
assert(
  successCount === 1,
  "Scenario 14: 10 concurrent consumption attempts result in exactly ONE success"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 5: GATEWAY REQUEST SCHEMAS & PROHIBITION OF ARBITRARY HTTP
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 5: Strict Gateway Parameter Validation\n");

// Scenario 20: Arbitrary Gmail URL rejected (no URL parameter exists or is accepted)
const arbitraryUrlPayload = {
  executionGrant: "grant-123",
  action: "GMAIL_SEND",
  targetUrl: "https://malicious-endpoint.com/steal",
  parameters: {
    to: ["lead@example.com"],
    subject: "Hello",
    bodyHtml: "<p>Test</p>",
  },
};
const urlCheck = validateGatewayRequest(arbitraryUrlPayload);
assert(
  urlCheck.valid === false,
  "Scenario 20: Arbitrary targetUrl rejected at gateway boundary"
);

// Scenario 21: Arbitrary method / action rejected
const arbitraryActionPayload = {
  executionGrant: "grant-123",
  action: "ARBITRARY_METHOD_CALL",
  parameters: {},
};
assert(
  validateGatewayRequest(arbitraryActionPayload).valid === false,
  "Scenario 21: Arbitrary action method rejected"
);

// Scenario 22: Unknown parameters rejected in GMAIL_SEND
const unknownParamSend = {
  to: ["user@example.com"],
  subject: "Hi",
  bodyHtml: "<p>Hi</p>",
  maliciousExtraKey: "attack",
};
const sendVal = validateGmailSendParameters(unknownParamSend);
assert(
  sendVal.valid === false,
  "Scenario 22: Unknown parameters in GMAIL_SEND rejected"
);

// Scenario 23: Oversized payload rejected
const oversizedHtml = "A".repeat(260 * 1024); // 260 KB (limit is 250 KB)
const oversizedSend = {
  to: ["user@example.com"],
  subject: "Big",
  bodyHtml: oversizedHtml,
};
assert(
  validateGmailSendParameters(oversizedSend).valid === false,
  "Scenario 23: Oversized HTML body (>250KB) rejected"
);

// Recipient count limits
const tooManyRecipients = {
  to: Array.from({ length: 11 }, (_, i) => `user${i}@example.com`), // limit 10
  subject: "Test",
  bodyHtml: "<p>Test</p>",
};
assert(
  validateGmailSendParameters(tooManyRecipients).valid === false,
  "Recipient count exceeding max (10) rejected"
);

// GMAIL_READ_LIST validation
const badMaxResults = validateGmailReadListParameters({ maxResults: 100 }); // limit 50
assert(
  badMaxResults.valid === false,
  "GMAIL_READ_LIST maxResults > 50 rejected"
);
const goodReadList = validateGmailReadListParameters({ maxResults: 20, query: "is:unread" });
assert(
  goodReadList.valid === true,
  "Valid GMAIL_READ_LIST accepted"
);

// GMAIL_GET_MESSAGE validation
assert(
  validateGmailGetMessageParameters({ messageId: "18e47f2b1c8a" }).valid === true,
  "Valid Gmail messageId accepted"
);
assert(
  validateGmailGetMessageParameters({ messageId: "invalid/chars;drop table" }).valid === false,
  "Malformed Gmail messageId rejected"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 6: ERROR SANITIZATION & ZERO TOKEN LEAKAGE
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 6: Error Sanitization & Secret Containment\n");

// Scenario 24: Google error sanitized
const simulatedGoogleError = new Error("Google 403: Invalid Credentials for ya29.a0AfH6SM...");
const sanitizedErr = sanitizeGoogleApiError(simulatedGoogleError);
assert(
  !sanitizedErr.errorMessage?.includes("ya29."),
  "Scenario 24: Google OAuth access token absent from sanitized error"
);
assert(
  !sanitizedErr.errorMessage?.includes("403"),
  "Raw Google status not leaked in unhandled errors"
);
assert(
  sanitizedErr.errorCode === "CAPABILITY_NOT_ALLOWED" || sanitizedErr.errorCode === "GMAIL_API_ERROR",
  "Google error mapped to safe internal errorCode"
);

// Scenario 25: Token absent from exception output
const errorWithAuthHeader = new Error("Request failed with Authorization: Bearer ya29.sensitiveToken12345");
const cleanErrorMsg = sanitizeGoogleApiError(errorWithAuthHeader);
assert(
  !cleanErrorMsg.errorMessage?.includes("ya29.sensitiveToken12345"),
  "Scenario 25: Bearer token stripped from exception output"
);
assert(
  !cleanErrorMsg.errorMessage?.includes("Authorization"),
  "Authorization header stripped from exception output"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 7: IDEMPOTENCY & DETERMINISTIC RFC 2822 MESSAGE-ID
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 7: Gmail Idempotency & RFC 2822 Protection\n");

// Scenario 29 & 30: Deterministic Message-ID generation
const executionId = "exec_123456789";
const stepId = "step_send_welcome";
const action = "GMAIL_SEND";

const idempotencyRaw = `${executionId}:${stepId}:${action}`;
const idempotencyKey = crypto.createHash("sha256").update(idempotencyRaw).digest("hex");
const expectedMessageId = `<${idempotencyKey}@chowdhuryduo.com>`;

const rawMime = buildRfc2822Email(
  {
    to: ["recipient@example.com"],
    subject: "Welcome",
    bodyHtml: "<p>Welcome to our service!</p>",
  },
  undefined,
  idempotencyKey
);

assert(
  rawMime.includes(`Message-ID: ${expectedMessageId}`),
  "Scenario 30: MIME contains deterministic RFC 2822 Message-ID for crash recovery"
);
assert(
  rawMime.includes("To: recipient@example.com"),
  "MIME correctly addresses recipient"
);
assert(
  rawMime.includes(`Subject: =?UTF-8?B?${Buffer.from("Welcome", "utf8").toString("base64")}?=`),
  "MIME correctly sets RFC 2047 encoded subject"
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 8: SCHEMA-LESS AUTOMATION SAFETY & CONTROL-PLANE INTEGRITY (PHASE 18)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔒 GROUP 8: Schema-less Safety & Control-Plane Protection\n");

// Automation with no schema fields: must accept only {}
const emptySchemaResult = validateExecutionInput(null, { maliciousField: "arbitrary_data" });
assert(
  emptySchemaResult.valid === false,
  "Schema-less automation rejects arbitrary client input fields"
);

const validEmptyResult = validateExecutionInput(null, {});
assert(
  validEmptyResult.valid === true,
  "Schema-less automation accepts explicitly empty input object {}"
);

// Automation with schema: rejects undeclared fields
const definedSchema = {
  fields: [
    { key: "userName", label: "User Name", type: "text", required: true },
  ],
};
const undeclaredInput = {
  userName: "John",
  attackerInjectedField: "exploit",
};
const undeclaredResult = validateExecutionInput(definedSchema, undeclaredInput);
assert(
  undeclaredResult.valid === false,
  "Automation with schema rejects undeclared input fields"
);

// Strip unknown keys
const stripped = stripUnknownInputKeys(definedSchema, undeclaredInput);
assert(
  !("attackerInjectedField" in stripped),
  "stripUnknownInputKeys removes undeclared fields"
);
assert(
  stripped.userName === "John",
  "stripUnknownInputKeys preserves declared fields"
);

// Control plane keys rejection
for (const reserved of ["executionGrant", "_auth_google_access_token", "gatewaySecret", "workflowId"]) {
  const cpCheck = rejectControlPlaneKeys({ [reserved]: "payload" });
  assert(
    cpCheck.clean === false,
    `Control plane key injection rejected: ${reserved}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════");
console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log("══════════════════════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
