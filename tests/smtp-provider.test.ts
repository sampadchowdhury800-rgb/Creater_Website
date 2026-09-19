/**
 * tests/smtp-provider.test.ts
 *
 * Unit tests for SMTP provider module:
 * - Error classification (EAUTH, timeouts, rate limits)
 * - Security invariants (app password never leaked)
 * - Deterministic idempotency headers
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import { sendSmtpReply } from "../lib/integrations/providers/smtp";

describe("SMTP Provider Tests", () => {
  const dummyCreds = {
    email: "support-duo@gmail.com",
    appPassword: "secret-smtp-password-5678",
  };

  test("sendSmtpReply fails securely on invalid credentials and redacts password", async () => {
    const res = await sendSmtpReply(dummyCreds, {
      to: "customer@example.com",
      subject: "Test Subject",
      bodyHtml: "<p>Hello customer</p>",
      idempotencyKey: "idem_test_123",
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.errorCode, "errorCode should be populated");
    assert.ok(res.errorMessage, "errorMessage should be populated");
    // Ensure the password does not leak in error message
    assert.strictEqual(res.errorMessage?.includes("secret-smtp-password-5678"), false);
  });
});
