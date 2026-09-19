/**
 * tests/imap-provider.test.ts
 *
 * Unit tests for IMAP provider error classification, message fetching,
 * and security invariants (no credential leakage).
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  testImapConnection,
  listUnreadImapMessages,
  fetchImapMessage,
} from "../lib/integrations/providers/imap";

describe("IMAP Provider Tests", () => {
  const dummyCreds = {
    email: "test-customer@gmail.com",
    appPassword: "abcd-efgh-ijkl-mnop",
  };

  test("testImapConnection handles authentication failures gracefully without leaking appPassword", async () => {
    const res = await testImapConnection({
      email: "invalid-user@gmail.com",
      appPassword: "wrong-app-password-secret-1234",
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.error, "Error message should be present");
    // Ensure the app password is never leaked in the error message
    assert.strictEqual(res.error?.includes("wrong-app-password-secret-1234"), false);
    assert.strictEqual(res.error?.includes("secret"), false);
  });

  test("listUnreadImapMessages handles connection errors without leaking appPassword", async () => {
    const res = await listUnreadImapMessages({
      email: "invalid-user@gmail.com",
      appPassword: "super-secret-password-xyz",
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.errorCode, "errorCode should be present");
    assert.ok(res.errorMessage, "errorMessage should be present");
    assert.strictEqual(res.errorMessage?.includes("super-secret-password-xyz"), false);
  });

  test("fetchImapMessage handles connection failures and sanitizes errors", async () => {
    const res = await fetchImapMessage(
      {
        email: "invalid-user@gmail.com",
        appPassword: "my-hidden-password-999",
      },
      "1234567890",
      "full"
    );

    assert.strictEqual(res.success, false);
    assert.ok(res.errorCode, "errorCode should be defined");
    assert.ok(res.errorMessage, "errorMessage should be defined");
    assert.strictEqual(res.errorMessage?.includes("my-hidden-password-999"), false);
  });
});
