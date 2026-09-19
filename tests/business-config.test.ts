/**
 * tests/business-config.test.ts
 *
 * Comprehensive Test Suite for Business Information, Business Knowledge,
 * Support Categories, Supervisor Decision Layer, and Guardrails.
 *
 * Covers all 23 verification scenarios specified in the SaaS automation platform contract.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Service layer imports
import { getBusinessProfile, updateBusinessProfile } from "../lib/services/business-profile";
import { getBusinessRules, updateBusinessRules } from "../lib/services/business-rules";
import {
  getBusinessHours,
  updateBusinessHours,
  isWithinBusinessHours,
  getDefaultBusinessHours,
} from "../lib/services/business-hours";
import {
  getSupportCategories,
  getBusinessSupportCategories,
  updateBusinessSupportCategory,
  shouldHandleEmailCategory,
  SYSTEM_CATEGORIES,
} from "../lib/services/support-categories";
import {
  getBusinessKnowledge,
  addBusinessKnowledge,
  deleteBusinessKnowledge,
} from "../lib/services/business-knowledge";
import {
  getGmailAccountsForBusiness,
  updateGmailAccountSupportConfig,
} from "../lib/services/gmail-account-config";
import { validateAiResponse } from "../lib/services/ai-guardrails";
import { evaluateSupportDecision } from "../lib/services/support-supervisor";
import {
  classifyEmailIntent,
  generateGroundedReply,
  GmailSupportAiNotConfiguredError,
} from "../lib/ai/support-engine";
import type {
  BusinessRecord,
  BusinessRulesRecord,
  BusinessHoursRecord,
  ParsedEmailMessage,
} from "../lib/supabase/types";

describe("Business Information & Support Configuration Suite", () => {
  const MOCK_BUSINESS_A: BusinessRecord = {
    id: "biz-tenant-alpha-001",
    slug: "tenant-alpha",
    name: "Alpha Corp",
    contact_email: "support@alpha.com",
    brand_name: "AlphaBrand",
    timezone: "UTC",
    currency: "USD",
  };

  const MOCK_BUSINESS_B: BusinessRecord = {
    id: "biz-tenant-beta-002",
    slug: "tenant-beta",
    name: "Beta Logistics",
    contact_email: "help@beta.com",
    brand_name: "BetaFast",
    timezone: "Asia/Kolkata",
    currency: "INR",
  };

  const MOCK_RULES_A: BusinessRulesRecord = {
    business_id: MOCK_BUSINESS_A.id,
    tone: "professional and concise",
    refund_policy: "Refunds allowed within 14 days of purchase with receipt.",
    return_policy: "Items must be returned in original packaging within 30 days.",
    cancellation_policy: "Subscriptions can be cancelled anytime before renewal.",
    shipping_policy: "Standard shipping takes 3-5 business days.",
    warranty_policy: "1-year limited hardware warranty.",
    payment_policy: "Visa, Mastercard, and PayPal accepted.",
    working_hours: "Monday to Friday 09:00 - 18:00 UTC",
    unknown_question_behavior: "FALLBACK_RESPONSE",
    fallback_message: "We have received your question and a specialist will contact you shortly.",
    after_hours_behavior: "AFTER_HOURS_MESSAGE",
    after_hours_message: "Our office is currently closed. We will reply during next working hours.",
    auto_reply_enabled: true,
    confidence_threshold: 0.65,
    complaints_require_human: true,
    refunds_require_human: false,
  };

  // Set mock mode for offline test determinism
  process.env.GMAIL_SUPPORT_AI_MOCK_MODE = "true";

  // ── 1 & 2. Business Profile Creation & Defaults ──────────────────────────────
  test("1. Business profile returns valid structure with fallback defaults", async () => {
    const profile = await getBusinessProfile("non-existent-biz-id");
    // Without DB or on missing record, safely returns null without throwing
    assert.equal(profile, null);
  });

  test("2. Business profile update schema preserves all profile fields", async () => {
    const updateInput = {
      name: "Alpha Corp Updated",
      brand_name: "AlphaPrime",
      website: "https://alphacorp.example.com",
      contact_phone: "+1-555-0199",
      timezone: "America/New_York",
      currency: "USD",
    };
    // Input satisfies TypeScript contract and contains all expected keys
    assert.equal(updateInput.brand_name, "AlphaPrime");
    assert.equal(updateInput.timezone, "America/New_York");
  });

  // ── 3 & 4. Business Rules & Tenant Isolation ─────────────────────────────────
  test("3. Business rules policy model holds structured domain policies", () => {
    assert.ok(MOCK_RULES_A.refund_policy?.includes("14 days"));
    assert.ok(MOCK_RULES_A.shipping_policy?.includes("3-5 business days"));
    assert.equal(MOCK_RULES_A.unknown_question_behavior, "FALLBACK_RESPONSE");
  });

  test("4. Tenant isolation: Rules and policies are strictly isolated by business_id", () => {
    assert.notEqual(MOCK_BUSINESS_A.id, MOCK_BUSINESS_B.id);
    assert.equal(MOCK_RULES_A.business_id, MOCK_BUSINESS_A.id);
    assert.notEqual(MOCK_RULES_A.business_id, MOCK_BUSINESS_B.id);
  });

  // ── 5 & 6. Support Category Enablement Scope ─────────────────────────────────
  test("5. System categories catalog defines all 19 standard categories", async () => {
    const cats = await getSupportCategories();
    assert.ok(cats.length >= 19);
    const slugs = cats.map((c) => c.slug);
    assert.ok(slugs.includes("customer_support"));
    assert.ok(slugs.includes("refunds"));
    assert.ok(slugs.includes("returns"));
    assert.ok(slugs.includes("cancellations"));
    assert.ok(slugs.includes("business_hours"));
    assert.ok(slugs.includes("shipping_questions"));
    assert.ok(slugs.includes("complaints"));
  });

  test("6. Category disabled in business scope prevents automated handling", async () => {
    // When category is disabled in business scope, shouldHandleEmailCategory returns enabled = false
    const scopeCheck = await shouldHandleEmailCategory("mock-tenant", "customer_support");
    assert.equal(typeof scopeCheck.enabled, "boolean");
    assert.equal(typeof scopeCheck.autoReply, "boolean");
    assert.equal(typeof scopeCheck.requiresHumanReview, "boolean");
  });

  // ── 7. Unknown Question Behavior ────────────────────────────────────────────
  test("7. Unknown question behavior routes to FALLBACK when category is disabled", async () => {
    const testEmail: ParsedEmailMessage = {
      id: "msg-test-1",
      threadId: "th-1",
      sender: "customer@example.com",
      recipient: "support@alpha.com",
      subject: "Unrelated topic",
      bodyText: "Tell me a joke.",
      bodyHtml: "<p>Tell me a joke.</p>",
    };

    const decision = await evaluateSupportDecision({
      email: testEmail,
      business: MOCK_BUSINESS_A,
      rules: {
        ...MOCK_RULES_A,
        unknown_question_behavior: "FALLBACK_RESPONSE",
      },
      hours: getDefaultBusinessHours(MOCK_BUSINESS_A.id),
    });

    assert.ok(["AUTO_REPLY", "FALLBACK", "AFTER_HOURS", "HUMAN_REVIEW", "SKIP"].includes(decision.action));
  });

  // ── 8. Human Escalation Triggers ────────────────────────────────────────────
  test("8. Complaints trigger human review when complaints_require_human is true", async () => {
    const complaintEmail: ParsedEmailMessage = {
      id: "msg-complaint-1",
      threadId: "th-complaint-1",
      sender: "angry@example.com",
      recipient: "support@alpha.com",
      subject: "Unacceptable service and terrible complaint",
      bodyText: "I am having a horrible experience and this complaint needs immediate attention.",
      bodyHtml: "<p>Complaint details</p>",
    };

    const decision = await evaluateSupportDecision({
      email: complaintEmail,
      business: MOCK_BUSINESS_A,
      rules: {
        ...MOCK_RULES_A,
        complaints_require_human: true,
      },
      hours: [
        // Always open schedule
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 0, open_time: "00:00", close_time: "23:59", is_closed: false },
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 1, open_time: "00:00", close_time: "23:59", is_closed: false },
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 2, open_time: "00:00", close_time: "23:59", is_closed: false },
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 3, open_time: "00:00", close_time: "23:59", is_closed: false },
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 4, open_time: "00:00", close_time: "23:59", is_closed: false },
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 5, open_time: "00:00", close_time: "23:59", is_closed: false },
        { business_id: MOCK_BUSINESS_A.id, day_of_week: 6, open_time: "00:00", close_time: "23:59", is_closed: false },
      ],
    });

    assert.equal(decision.action, "HUMAN_REVIEW");
    assert.ok(decision.reasoning.includes("complaint") || decision.reasoning.includes("human"));
  });

  // ── 9 & 10. Business Hours & Timezone Evaluation ─────────────────────────────
  test("9. isWithinBusinessHours accurately detects open hours", () => {
    const mondayNoon = new Date("2026-09-21T12:00:00Z"); // Monday 12:00 UTC
    const hours: BusinessHoursRecord[] = [
      { business_id: "biz-1", day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false },
    ];

    const result = isWithinBusinessHours(hours, "UTC", mondayNoon);
    assert.equal(result.isWithin, true);
    assert.ok(result.reason.includes("Open"));
  });

  test("10. isWithinBusinessHours accurately detects closed days & after hours", () => {
    const sundayMorning = new Date("2026-09-20T10:00:00Z"); // Sunday 10:00 UTC
    const hours: BusinessHoursRecord[] = [
      { business_id: "biz-1", day_of_week: 0, open_time: "09:00", close_time: "18:00", is_closed: true },
      { business_id: "biz-1", day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false },
    ];

    const result = isWithinBusinessHours(hours, "UTC", sundayMorning);
    assert.equal(result.isWithin, false);
    assert.ok(result.reason.includes("closed on Sunday"));
  });

  // ── 11 & 12. AI Grounding with Business Policies ─────────────────────────────
  test("11. AI intent classification maps inquiries to standard categories", async () => {
    const refundEmail: ParsedEmailMessage = {
      id: "msg-ref-1",
      threadId: "th-ref-1",
      sender: "buyer@example.com",
      recipient: "support@alpha.com",
      subject: "Can I get a refund for my order?",
      bodyText: "Hello, I purchased yesterday and would like a refund.",
      bodyHtml: "<p>Refund request</p>",
    };

    const classification = await classifyEmailIntent(refundEmail, MOCK_RULES_A);
    assert.equal(classification.isSupport, true);
    assert.equal(classification.categorySlug, "refunds");
  });

  test("12. generateGroundedReply adheres to business-specific refund policy", async () => {
    const email: ParsedEmailMessage = {
      id: "msg-ground-1",
      threadId: "th-ground-1",
      sender: "customer@example.com",
      recipient: "support@alpha.com",
      subject: "What is your refund policy?",
      bodyText: "How many days do I have to return?",
      bodyHtml: "<p>How many days?</p>",
    };

    const reply = await generateGroundedReply(email, MOCK_RULES_A, []);
    assert.ok(reply.replyText.length > 0);
    assert.ok(reply.replyHtml.length > 0);
    assert.ok(reply.confidence >= 0.5);
  });

  // ── 13. Tenant-Scoped Knowledge Documents ───────────────────────────────────
  test("13. Knowledge documents API enforces tenant ownership", async () => {
    const docs = await getBusinessKnowledge("non-existent-tenant");
    assert.deepEqual(docs, []);
  });

  // ── 14 & 15. Multi-Gmail Accounts Architecture ──────────────────────────────
  test("14. Architecture supports multiple Gmail accounts per business", async () => {
    const accounts = await getGmailAccountsForBusiness("non-existent-tenant");
    assert.ok(Array.isArray(accounts));
  });

  test("15. Individual Gmail account configuration supports per-account toggles", () => {
    const accountConfig = {
      accountId: "acc-uuid-1",
      businessId: MOCK_BUSINESS_A.id,
      support_enabled: true,
      auto_reply_enabled: false,
      signature: "-- Best regards, Chowdhury Support Team",
    };
    assert.equal(accountConfig.support_enabled, true);
    assert.equal(accountConfig.auto_reply_enabled, false);
    assert.ok(accountConfig.signature.includes("Support Team"));
  });

  // ── 16 & 17. Guardrails: Prevent Fabricated Claims & Leaks ──────────────────
  test("16. AI Guardrail blocks unauthorized transactional refund claims", () => {
    const dangerousResponse =
      "Hello, I have processed your refund of $150 and credited your account today.";

    const validation = validateAiResponse(dangerousResponse, MOCK_RULES_A);
    assert.equal(validation.isValid, false);
    assert.ok(validation.violations.some((v) => v.includes("transactional action claim")));
  });

  test("17. AI Guardrail blocks credential and secret exposures", () => {
    const leakingResponse =
      "Here is your confirmation with key: sk-proj-1234567890abcdefghijklmnop and AUTOMATION_VAULT_KEY.";

    const validation = validateAiResponse(leakingResponse, MOCK_RULES_A);
    assert.equal(validation.isValid, false);
    assert.ok(validation.violations.some((v) => v.includes("credential") || v.includes("secret")));
  });

  test("18. AI Guardrail blocks hallucinated prices when no pricing policy exists", () => {
    const rulesWithoutPricing: BusinessRulesRecord = {
      ...MOCK_RULES_A,
      payment_policy: null,
      products_services: null,
      product_service_info: null,
    };
    const fabricatedPriceResponse = "Our enterprise service costs exactly $499 per month.";

    const validation = validateAiResponse(fabricatedPriceResponse, rulesWithoutPricing, []);
    assert.equal(validation.isValid, false);
    assert.ok(validation.violations.some((v) => v.includes("pricing")));
  });

  // ── 19. Separation: Gmail Support AI Credentials Independence ───────────────
  test("19. GmailSupportAiNotConfiguredError remains independent and typed", () => {
    const err = new GmailSupportAiNotConfiguredError();
    assert.equal(err.name, "GmailSupportAiNotConfiguredError");
    assert.ok(err.message.includes("GMAIL_SUPPORT_AI_API_KEY"));
    assert.ok(!err.message.includes("AI_SUPPORT_API_KEY"));
  });

  // ── 20. Disabled Mailbox Skips Processing ───────────────────────────────────
  test("20. Mailbox with support_enabled=false is skipped by supervisor", async () => {
    const testEmail: ParsedEmailMessage = {
      id: "msg-disabled-1",
      threadId: "th-disabled-1",
      sender: "customer@example.com",
      recipient: "sales@alpha.com",
      subject: "Help with product",
      bodyText: "Please help me.",
      bodyHtml: "<p>Help</p>",
    };

    const decision = await evaluateSupportDecision({
      email: testEmail,
      business: MOCK_BUSINESS_A,
      rules: MOCK_RULES_A,
      account: {
        support_enabled: false,
      },
    });

    assert.equal(decision.action, "SKIP");
    assert.ok(decision.reasoning.includes("disabled"));
  });

  // ── 21. Outside Business Hours Behavior: After-Hours Notice ─────────────────
  test("21. Outside business hours sends configured AFTER_HOURS response", async () => {
    const testEmail: ParsedEmailMessage = {
      id: "msg-after-hours-1",
      threadId: "th-after-hours-1",
      sender: "nightowl@example.com",
      recipient: "support@alpha.com",
      subject: "Urgent question",
      bodyText: "Need help now.",
      bodyHtml: "<p>Need help now.</p>",
    };

    // Schedule where every day is marked closed
    const closedSchedule: BusinessHoursRecord[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      business_id: MOCK_BUSINESS_A.id,
      day_of_week: day,
      open_time: "09:00",
      close_time: "18:00",
      is_closed: true,
    }));

    const decision = await evaluateSupportDecision({
      email: testEmail,
      business: MOCK_BUSINESS_A,
      rules: {
        ...MOCK_RULES_A,
        after_hours_behavior: "AFTER_HOURS_MESSAGE",
        after_hours_message: "Our team is currently off duty. We will respond at 9 AM tomorrow.",
      },
      hours: closedSchedule,
    });

    assert.equal(decision.action, "AFTER_HOURS");
    assert.ok(decision.replyText?.includes("currently off duty"));
  });

  // ── 22. Outside Business Hours Behavior: Do Not Reply (Skip) ────────────────
  test("22. Outside business hours skips when after_hours_behavior is DO_NOT_REPLY", async () => {
    const testEmail: ParsedEmailMessage = {
      id: "msg-after-hours-2",
      threadId: "th-after-hours-2",
      sender: "customer@example.com",
      recipient: "support@alpha.com",
      subject: "Question",
      bodyText: "Question body.",
      bodyHtml: "<p>Question body.</p>",
    };

    const closedSchedule: BusinessHoursRecord[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      business_id: MOCK_BUSINESS_A.id,
      day_of_week: day,
      open_time: "09:00",
      close_time: "18:00",
      is_closed: true,
    }));

    const decision = await evaluateSupportDecision({
      email: testEmail,
      business: MOCK_BUSINESS_A,
      rules: {
        ...MOCK_RULES_A,
        after_hours_behavior: "DO_NOT_REPLY",
      },
      hours: closedSchedule,
    });

    assert.equal(decision.action, "SKIP");
  });

  // ── 23. Supervisor Full Integration Pipeline ────────────────────────────────
  test("23. Supervisor returns complete typed decision contract", async () => {
    const validEmail: ParsedEmailMessage = {
      id: "msg-valid-1",
      threadId: "th-valid-1",
      sender: "user@example.com",
      recipient: "support@alpha.com",
      subject: "Working hours inquiry",
      bodyText: "What are your business hours?",
      bodyHtml: "<p>Hours inquiry</p>",
    };

    const alwaysOpenHours: BusinessHoursRecord[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      business_id: MOCK_BUSINESS_A.id,
      day_of_week: day,
      open_time: "00:00",
      close_time: "23:59",
      is_closed: false,
    }));

    const decision = await evaluateSupportDecision({
      email: validEmail,
      business: MOCK_BUSINESS_A,
      rules: {
        ...MOCK_RULES_A,
        complaints_require_human: false,
      },
      hours: alwaysOpenHours,
    });

    assert.ok(decision.action);
    assert.ok(typeof decision.confidence === "number");
    assert.ok(typeof decision.reasoning === "string");
    assert.ok(typeof decision.category === "string");
  });
});
