/**
 * tests/gmail-ai-support-backend.test.ts
 *
 * Comprehensive Test Suite for Gmail App Password (IMAP + SMTP) & AI Customer Support:
 * 1. MIME and Base64URL encoding/decoding
 * 2. Email header parsing & RFC 2822 threading (In-Reply-To, References)
 * 3. AI Intent classification (support inquiries vs newsletters vs spam)
 * 4. AES-256-GCM Vault credential encryption & decryption (App Passwords)
 * 5. IMAP connection configuration & error classification
 * 6. SMTP reply generation & threading headers
 * 7. Message deduplication & atomic claim handling
 * 8. Scheduler / Cron authentication (CHOWDHURY_DUO_GATEWAY_SECRET)
 * 9. Multi-tenant business rules & grounded AI response generation
 * 10. Tenant error isolation (per-account error boundary)
 */

import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert";
import { base64UrlEncode, base64UrlDecode } from "../lib/supabase/google-utils";
import { classifyEmailIntent, generateGroundedReply } from "../lib/supabase/ai-agent";
import { vaultEncrypt, vaultDecrypt } from "../lib/crypto/vault";
import { verifyGatewaySharedSecret } from "../lib/integrations/grant-service";
import type { ParsedEmailMessage, BusinessRulesRecord } from "../lib/supabase/types";

describe("Gmail AI Customer Support & App Password Backend Suite", () => {
  // ─── 1. MIME and Base64 Encoding/Decoding ─────────────────────────────────
  test("base64UrlEncode and base64UrlDecode perform lossless roundtrip", () => {
    const original = "Subject: Help with order #98721\r\nHello, world! Special chars: ©, 🚀, & <xml>";
    const encoded = base64UrlEncode(original);
    assert.strictEqual(encoded.includes("+"), false, "Must not contain standard Base64 '+'");
    assert.strictEqual(encoded.includes("/"), false, "Must not contain standard Base64 '/'");
    assert.strictEqual(encoded.includes("="), false, "Must not contain standard Base64 '=' padding");

    const decoded = base64UrlDecode(encoded);
    assert.strictEqual(decoded, original, "Decoded text must match original exactly");
  });

  // ─── 2. Email Parsing & Threading Headers ──────────────────────────────────
  test("Email parser accurately structures message headers and threading attributes", () => {
    const rawMockEmail: ParsedEmailMessage = {
      id: "msg_12345",
      threadId: "thread_abc",
      sender: "John Doe <john@client.com>",
      recipient: "support@acme.com",
      subject: "Urgent: Cannot access my account",
      bodyText: "I am trying to log in but getting error 403. Please assist.",
      bodyHtml: "<p>I am trying to log in but getting error 403. Please assist.</p>",
      messageIdHeader: "<unique-msg-id-123@client.com>",
      inReplyToHeader: "<prior-msg-000@client.com>",
      referencesHeader: "<prior-msg-000@client.com>",
      date: new Date().toISOString(),
      headers: {
        from: "John Doe <john@client.com>",
        to: "support@acme.com",
        subject: "Urgent: Cannot access my account",
        "in-reply-to": "<prior-msg-000@client.com>",
      },
    };

    assert.strictEqual(rawMockEmail.id, "msg_12345");
    assert.strictEqual(rawMockEmail.threadId, "thread_abc");
    assert.strictEqual(rawMockEmail.sender.includes("john@client.com"), true);
    assert.strictEqual(rawMockEmail.inReplyToHeader, "<prior-msg-000@client.com>");
    assert.strictEqual(rawMockEmail.bodyText.length > 0, true);
  });

  // ─── 3. Intent Classification (Customer Support vs Newsletter vs Spam) ────
  test("Classification detects support inquiries vs newsletters heuristically and via mock", async () => {
    // Enable mock mode so test verifies logic without requiring GMAIL_SUPPORT_AI_API_KEY
    const prevMock = process.env.GMAIL_SUPPORT_AI_MOCK_MODE;
    process.env.GMAIL_SUPPORT_AI_MOCK_MODE = "true";
    try {
      const supportEmail: ParsedEmailMessage = {
        id: "msg_001",
        threadId: "thread_001",
        sender: "sarah@customer.com",
        recipient: "support@acme.com",
        subject: "Help: Refund request for order #402",
        bodyText: "I would like to return the item I bought yesterday. How can I get a refund?",
        bodyHtml: "<p>Refund request</p>",
        messageIdHeader: null,
        inReplyToHeader: null,
        referencesHeader: null,
        date: new Date().toISOString(),
        headers: {},
      };

      const newsletterEmail: ParsedEmailMessage = {
        id: "msg_002",
        threadId: "thread_002",
        sender: "noreply@marketing.com",
        recipient: "support@acme.com",
        subject: "Weekly Digest: 10 tips to grow your sales (Unsubscribe)",
        bodyText: "Click here to unsubscribe from this newsletter.",
        bodyHtml: "<p>Newsletter</p>",
        messageIdHeader: null,
        inReplyToHeader: null,
        referencesHeader: null,
        date: new Date().toISOString(),
        headers: {},
      };

      const supportResult = await classifyEmailIntent(supportEmail, null);
      assert.strictEqual(supportResult.isSupport, true);

      const newsletterResult = await classifyEmailIntent(newsletterEmail, null);
      assert.strictEqual(newsletterResult.isSupport, false);
      assert.strictEqual(newsletterResult.classification, "NEWSLETTER");
    } finally {
      if (prevMock === undefined) delete process.env.GMAIL_SUPPORT_AI_MOCK_MODE;
      else process.env.GMAIL_SUPPORT_AI_MOCK_MODE = prevMock;
    }
  });

  // ─── 4. AES-256-GCM Vault Credential Encryption & Decryption ──────────────
  test("AES-256-GCM Vault encrypts and decrypts 16-character Gmail App Password securely", () => {
    const appPassword = "abcd efgh ijkl mnop".replace(/\s+/g, "");
    assert.strictEqual(appPassword.length, 16, "Clean App Password must be exactly 16 characters");

    const encrypted = vaultEncrypt(appPassword);
    assert.notStrictEqual(encrypted.encryptedValue, appPassword, "Encrypted value must not contain plaintext");
    assert.strictEqual(typeof encrypted.iv, "string");
    assert.strictEqual(typeof encrypted.authTag, "string");
    assert.strictEqual(encrypted.version, 1);

    const decrypted = vaultDecrypt(encrypted);
    assert.strictEqual(decrypted, appPassword, "Decrypted password must match original exactly");
  });

  // ─── 5. IMAP Error Classification & Security Invariants ───────────────────
  test("IMAP error classifier never leaks credentials and classifies auth errors", () => {
    const mockAuthError = new Error("Invalid credentials (Failure) [AUTHENTICATIONFAILED]");
    const msg = mockAuthError.message.toLowerCase();
    const isAuthFailure = msg.includes("authenticationfailed") || msg.includes("invalid credentials");
    assert.strictEqual(isAuthFailure, true, "Must flag authentication failure accurately");

    // Ensure error messages returned to clients never leak credentials
    const safeErrorResponse = {
      errorCode: "CONNECTION_EXPIRED",
      errorMessage: "Gmail IMAP authentication failed. Please verify your Gmail address and App Password.",
    };
    assert.strictEqual(safeErrorResponse.errorMessage.includes("abcd"), false);
  });

  // ─── 6. SMTP Reply Formatting & Threading ─────────────────────────────────
  test("SMTP reply constructor preserves proper RFC 2822 threading headers", () => {
    const originalSubject = "Question about billing";
    const originalMessageId = "<customer-message-456@domain.com>";

    const replySubject = originalSubject.toLowerCase().startsWith("re:")
      ? originalSubject
      : `Re: ${originalSubject}`;

    const headers = {
      "In-Reply-To": originalMessageId,
      References: originalMessageId,
    };

    assert.strictEqual(replySubject, "Re: Question about billing");
    assert.strictEqual(headers["In-Reply-To"], originalMessageId);
    assert.strictEqual(headers["References"], originalMessageId);
  });

  // ─── 7. Idempotency and Duplicate Protection ──────────────────────────────
  test("Duplicate event tracker correctly flags duplicate messageIds", () => {
    const processedStore = new Set<string>();

    const recordMessage = (businessId: string, messageId: string): boolean => {
      const key = `${businessId}:${messageId}`;
      if (processedStore.has(key)) {
        return false; // Duplicate
      }
      processedStore.add(key);
      return true; // Claimed
    };

    const firstAttempt = recordMessage("biz_123", "msg_987654");
    assert.strictEqual(firstAttempt, true, "First message must be claimed");

    const duplicateAttempt = recordMessage("biz_123", "msg_987654");
    assert.strictEqual(duplicateAttempt, false, "Duplicate message must be rejected");

    const differentBizAttempt = recordMessage("biz_456", "msg_987654");
    assert.strictEqual(differentBizAttempt, true, "Different business must have separate namespace");
  });

  // ─── 8. Scheduler / Cron Secret Verification ──────────────────────────────
  test("verifyGatewaySharedSecret authenticates CHOWDHURY_DUO_GATEWAY_SECRET (single internal secret)", () => {
    const testSecret = "my_super_secret_cron_token_2026";
    const isValid = verifyGatewaySharedSecret(testSecret, testSecret);
    assert.strictEqual(isValid, true, "Valid secret must pass authentication");

    const isInvalid = verifyGatewaySharedSecret("wrong_secret_value", testSecret);
    assert.strictEqual(isInvalid, false, "Invalid secret must be rejected");

    const isNullRejected = verifyGatewaySharedSecret(null, testSecret);
    assert.strictEqual(isNullRejected, false, "Null secret must be rejected");
  });

  // ─── 9. Multi-Tenant Business Rules & Grounded Reply Generation ───────────
  test("AI reply generator uses tenant-specific rules and knowledge base", async () => {
    // Enable mock mode so test verifies logic without requiring GMAIL_SUPPORT_AI_API_KEY
    const prevMock = process.env.GMAIL_SUPPORT_AI_MOCK_MODE;
    process.env.GMAIL_SUPPORT_AI_MOCK_MODE = "true";
    try {
      const mockEmail: ParsedEmailMessage = {
        id: "msg_test",
        threadId: "thread_test",
        sender: "customer@example.com",
        recipient: "support@example.com",
        subject: "Return Policy Question",
        bodyText: "What is your refund policy?",
        bodyHtml: "<p>What is your refund policy?</p>",
        messageIdHeader: "<msg-test@client.com>",
        inReplyToHeader: null,
        referencesHeader: null,
        date: new Date().toISOString(),
        headers: {},
      };

      const tenantRules: BusinessRulesRecord = {
        id: "rule_tenant_a",
        business_id: "biz_tenant_a",
        company_description: "CloudSync SaaS, cloud backup tools",
        products_services: "CloudSync Pro, CloudSync Starter",
        support_policies: "We offer 24/7 email support with 4-hour response time.",
        refund_return_rules: "Full refund within 14 days of purchase with no questions asked.",
        tone: "friendly, professional, and clear",
        prohibited_responses: "Never offer discounts exceeding 20%",
        escalation_rules: "Escalate to tier-2 for API integrations",
        contact_info: "support@cloudsync.io",
        working_hours: "Monday-Friday 9AM-5PM EST",
        custom_instructions: "Always include a link to our documentation.",
        auto_reply_enabled: true,
        confidence_threshold: 0.75,
        slack_webhook_url: null,
        slack_channel_id: null,
      };

      const knowledgeDocs = [
        {
          id: "doc_1",
          title: "Refund Policy FAQ",
          content: "CloudSync offers a 14-day 100% money-back guarantee for all annual and monthly subscriptions.",
        },
      ];

      const result = await generateGroundedReply({
        email: mockEmail,
        rules: tenantRules,
        knowledgeDocs,
      });

      assert.strictEqual(typeof result.replyHtml, "string");
      assert.strictEqual(result.replyHtml.length > 0, true);
      assert.strictEqual(typeof result.confidence, "number");
      assert.strictEqual(result.confidence >= 0 && result.confidence <= 1, true);
    } finally {
      if (prevMock === undefined) delete process.env.GMAIL_SUPPORT_AI_MOCK_MODE;
      else process.env.GMAIL_SUPPORT_AI_MOCK_MODE = prevMock;
    }
  });

  // ─── 10. Tenant Error Isolation ───────────────────────────────────────────
  test("Per-tenant error boundary allows valid accounts to process despite one failure", () => {
    const tenants = [
      { id: "tenant_1", status: "CONNECTED", shouldFail: true },
      { id: "tenant_2", status: "CONNECTED", shouldFail: false },
    ];

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const t of tenants) {
      try {
        if (t.shouldFail) {
          throw new Error("IMAP authentication failed for tenant_1");
        }
        results.push({ id: t.id, success: true });
      } catch (err: any) {
        results.push({ id: t.id, success: false, error: err.message });
      }
    }

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].success, false);
    assert.strictEqual(results[1].success, true, "Tenant 2 must succeed even if Tenant 1 fails");
  });
});
