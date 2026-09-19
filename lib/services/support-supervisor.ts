/**
 * lib/services/support-supervisor.ts
 *
 * Support Supervisor & Decision Layer for Gmail Customer Support.
 * Orchestrates deterministic routing, business hours enforcement, category scoping,
 * human escalation triggers, AI grounded generation, and guardrail validation.
 */

import type {
  ParsedEmailMessage,
  BusinessRulesRecord,
  BusinessHoursRecord,
  BusinessRecord,
  GmailAccountRecord,
  SupervisorDecision,
  KnowledgeDocumentMatch,
} from "@/lib/supabase/types";
import { isWithinBusinessHours } from "./business-hours";
import { shouldHandleEmailCategory } from "./support-categories";
import { validateAiResponse } from "./ai-guardrails";
import { classifyEmailIntent, generateGroundedReply } from "@/lib/ai/support-engine";
import { getRelevantBusinessKnowledge } from "./business-knowledge";

export interface SupervisorInput {
  email: ParsedEmailMessage;
  business: BusinessRecord;
  rules?: BusinessRulesRecord | null;
  hours?: BusinessHoursRecord[];
  account?: Partial<GmailAccountRecord>;
  supabaseClient?: any;
}

export async function evaluateSupportDecision({
  email,
  business,
  rules,
  hours = [],
  account,
  supabaseClient,
}: SupervisorInput): Promise<SupervisorDecision> {
  const businessId = business.id;

  // ── Step 1: Mailbox Support Enabled Check ────────────────────────────────────
  if (account?.support_enabled === false) {
    return {
      action: "SKIP",
      category: "disabled_mailbox",
      confidence: 1.0,
      reasoning: "Gmail Support is explicitly disabled for this mailbox account.",
    };
  }

  // ── Step 2: Business Hours Check ─────────────────────────────────────────────
  const timezone = business.timezone || "UTC";
  const hoursCheck = isWithinBusinessHours(hours, timezone, new Date());

  if (!hoursCheck.isWithin) {
    const afterHoursBehavior = rules?.after_hours_behavior || "REPLY_NORMALLY";
    const afterHoursMsg =
      rules?.after_hours_message ||
      "Thank you for contacting us. Our office is currently closed. We will respond during our next business hours.";

    if (afterHoursBehavior === "DO_NOT_REPLY") {
      return {
        action: "SKIP",
        category: "outside_hours",
        confidence: 1.0,
        reasoning: `Outside business hours (${hoursCheck.reason}). Configuration set to DO_NOT_REPLY.`,
      };
    }

    if (afterHoursBehavior === "AFTER_HOURS_MESSAGE") {
      return {
        action: "AFTER_HOURS",
        category: "outside_hours",
        confidence: 1.0,
        replyText: afterHoursMsg,
        replyHtml: `<p>${afterHoursMsg.replace(/\n/g, "<br/>")}</p>`,
        reasoning: `Outside business hours (${hoursCheck.reason}). Sending configured after-hours notice.`,
      };
    }

    if (afterHoursBehavior === "ESCALATE") {
      return {
        action: "HUMAN_REVIEW",
        category: "outside_hours",
        confidence: 1.0,
        reasoning: `Outside business hours (${hoursCheck.reason}). Marked for team review.`,
        humanReviewReason: "Received outside operating hours",
      };
    }
    // If 'REPLY_NORMALLY', fall through to standard processing
  }

  // ── Step 3: Classify Email Intent & Category ─────────────────────────────────
  const classification = await classifyEmailIntent(email, rules);

  // If newsletter or spam, skip immediately
  if (classification.classification === "NEWSLETTER" || classification.classification === "SPAM") {
    return {
      action: "SKIP",
      category: classification.classification.toLowerCase(),
      confidence: classification.confidence,
      reasoning: `Ignored ${classification.classification} email. ${classification.reasoning}`,
    };
  }

  const categorySlug = classification.categorySlug || "customer_support";

  // ── Step 4: Category Enablement Scope Check ──────────────────────────────────
  const categoryScope = await shouldHandleEmailCategory(businessId, categorySlug);

  if (!categoryScope.enabled) {
    const unknownBehavior = rules?.unknown_question_behavior || "FALLBACK_RESPONSE";
    const fallbackMsg =
      rules?.fallback_message ||
      "Thank you for reaching out to us. We have received your message and our team will review it shortly.";

    if (unknownBehavior === "NO_REPLY") {
      return {
        action: "SKIP",
        category: categorySlug,
        confidence: classification.confidence,
        reasoning: `Category '${categorySlug}' is disabled and unknown_question_behavior is NO_REPLY.`,
      };
    }

    if (unknownBehavior === "HUMAN_REVIEW" || unknownBehavior === "NOTIFY_TEAM") {
      return {
        action: "HUMAN_REVIEW",
        category: categorySlug,
        confidence: classification.confidence,
        reasoning: `Category '${categorySlug}' is disabled. Routed to human review.`,
        humanReviewReason: `Category '${categorySlug}' requires manual review`,
      };
    }

    // Default FALLBACK_RESPONSE
    return {
      action: "FALLBACK",
      category: categorySlug,
      confidence: classification.confidence,
      replyText: fallbackMsg,
      replyHtml: `<p>${fallbackMsg.replace(/\n/g, "<br/>")}</p>`,
      reasoning: `Category '${categorySlug}' is disabled. Sending safe fallback notice.`,
    };
  }

  // ── Step 5: Check Human Review Triggers ─────────────────────────────────────
  let requiresHuman = categoryScope.requiresHumanReview;
  let escalationReason = "";

  if (categorySlug === "complaints" && rules?.complaints_require_human) {
    requiresHuman = true;
    escalationReason = "Customer complaint requires human review per business policy.";
  } else if (categorySlug === "refunds" && rules?.refunds_require_human) {
    requiresHuman = true;
    escalationReason = "Refund request requires human review per business policy.";
  }

  const confidenceThreshold = rules?.confidence_threshold ?? 0.65;
  if (classification.confidence < confidenceThreshold) {
    requiresHuman = true;
    escalationReason = `AI confidence (${classification.confidence.toFixed(2)}) is below threshold (${confidenceThreshold}).`;
  }

  const mailboxAutoReply = account?.auto_reply_enabled !== false;
  const businessAutoReply = rules?.auto_reply_enabled !== false;
  if (!mailboxAutoReply || !businessAutoReply || !categoryScope.autoReply) {
    requiresHuman = true;
    escalationReason = escalationReason || "Auto-reply is disabled for this category or mailbox.";
  }

  if (requiresHuman) {
    return {
      action: "HUMAN_REVIEW",
      category: categorySlug,
      confidence: classification.confidence,
      reasoning: escalationReason || "Inquiry flagged for human supervisor review.",
      humanReviewReason: escalationReason || "Flagged for manual review",
    };
  }

  // ── Step 6: Retrieve Grounding Knowledge ────────────────────────────────────
  let knowledgeDocs: KnowledgeDocumentMatch[] = [];
  try {
    knowledgeDocs = await getRelevantBusinessKnowledge(email, businessId, supabaseClient);
  } catch (err: any) {
    console.warn("[Supervisor] Knowledge retrieval error:", err?.message);
  }

  // ── Step 7: Generate Grounded Reply ─────────────────────────────────────────
  const generated = await generateGroundedReply(email, rules, knowledgeDocs);

  // ── Step 8: Validate Response Against Guardrails ────────────────────────────
  const guardrailCheck = validateAiResponse(generated.replyText, rules, knowledgeDocs);
  if (!guardrailCheck.isValid) {
    console.warn("[Supervisor] Guardrail validation failed:", guardrailCheck.violations);
    const fallbackMsg =
      rules?.fallback_message ||
      "Thank you for reaching out. We have received your inquiry and our support team will respond shortly.";

    return {
      action: "FALLBACK",
      category: categorySlug,
      confidence: generated.confidence,
      replyText: fallbackMsg,
      replyHtml: `<p>${fallbackMsg.replace(/\n/g, "<br/>")}</p>`,
      reasoning: `Guardrail violation intercepted: ${guardrailCheck.violations.join("; ")}. Reverted to safe fallback.`,
      humanReviewReason: `Guardrail violations: ${guardrailCheck.violations.join("; ")}`,
    };
  }

  // ── Step 9: Return Authorized Auto-Reply ────────────────────────────────────
  return {
    action: "AUTO_REPLY",
    category: categorySlug,
    confidence: generated.confidence,
    replyText: generated.replyText,
    replyHtml: generated.replyHtml,
    reasoning: generated.reasoning || "Grounded AI response generated and verified against guardrails.",
  };
}
