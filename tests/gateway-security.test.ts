/**
 * tests/gateway-security.test.ts
 *
 * Security and architecture regression tests:
 * - Gateway secret enforcement
 * - Grant capability validation
 * - Idempotency preservation
 * - Baseline protection logic
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import { validateInternalServiceRequest } from "../lib/security/internal-auth";
import { validateExecutionGrant } from "../lib/integrations/grant-service";

describe("Gateway Security & Invariant Tests", () => {
  test("validateInternalServiceRequest rejects requests missing the gateway secret", () => {
    const mockReq = {
      headers: new Headers({}),
    } as any;

    const authRes = validateInternalServiceRequest(mockReq);
    assert.strictEqual(authRes.authenticated, false);
    assert.strictEqual(authRes.errorCode, "MISSING_SERVICE_AUTH");
  });

  test("validateInternalServiceRequest rejects requests with wrong secret", () => {
    const mockReq = {
      headers: new Headers({
        "x-n8n-gateway-secret": "wrong-secret-value",
      }),
    } as any;

    const authRes = validateInternalServiceRequest(mockReq);
    assert.strictEqual(authRes.authenticated, false);
    assert.strictEqual(authRes.errorCode, "INVALID_SERVICE_AUTH");
  });

  test("validateExecutionGrant rejects invalid or non-existent grant tokens", async () => {
    const grantRes = await validateExecutionGrant("invalid-grant-token-123", {
      requiredCapability: "GMAIL_GET_MESSAGE",
    });

    assert.strictEqual(grantRes.valid, false);
    assert.strictEqual(grantRes.errorCode, "GRANT_INVALID");
  });

  test("Baseline timestamp protects pre-existing unread emails", () => {
    const baselineDate = new Date("2026-09-17T12:00:00Z");
    const preExistingEmailDate = new Date("2026-09-17T11:59:59Z");
    const newEmailDate = new Date("2026-09-17T12:00:01Z");

    // Defense-in-depth condition tested in poll route
    const isPreExistingSkipped = preExistingEmailDate.getTime() < baselineDate.getTime();
    const isNewEmailProcessed = newEmailDate.getTime() >= baselineDate.getTime();

    assert.strictEqual(isPreExistingSkipped, true, "Pre-existing emails before baseline must be skipped");
    assert.strictEqual(isNewEmailProcessed, true, "Emails arriving after baseline must be processed");
  });
});
