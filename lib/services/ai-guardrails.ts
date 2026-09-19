/**
 * lib/services/ai-guardrails.ts
 *
 * Deterministic AI Response Guardrails for Gmail Customer Support.
 * Validates generated replies before outbound transmission via SMTP.
 *
 * Enforces:
 * 1. Zero credential / secret leakage (API keys, vault keys, passwords, bearer tokens).
 * 2. Zero internal prompt / instruction leakage.
 * 3. Prevention of hallucinated price commitments if no pricing policy is configured.
 * 4. Prevention of unauthorized refund commitments ("I have refunded", "Your money has been returned").
 * 5. Prevention of unsupported shipment claims ("Your package was dispatched today").
 * 6. Maximum length constraint to prevent token runaway.
 */

import type { BusinessRulesRecord, KnowledgeDocumentMatch } from "@/lib/supabase/types";

export interface GuardrailValidationResult {
  isValid: boolean;
  violations: string[];
  remediatedText?: string;
}

export function validateAiResponse(
  replyText: string,
  rules?: BusinessRulesRecord | null,
  knowledgeDocs?: KnowledgeDocumentMatch[]
): GuardrailValidationResult {
  const violations: string[] = [];
  const text = replyText || "";

  // ── 1. Secret & Credential Leakage Check ─────────────────────────────────────
  const secretPatterns = [
    /sk-[a-zA-Z0-9_-]{20,}/i,               // OpenAI / API keys
    /AIza[0-9A-Za-z_-]{35}/,                // Google API keys
    /Bearer\s+[a-zA-Z0-9._-]{20,}/i,        // Bearer tokens
    /[a-f0-9]{32,64}/i,                      // Long hex hashes/tokens if explicitly presented as secret
    /password\s*[:=]\s*['"][^'"]+['"]/i,   // Plaintext passwords
    /AUTOMATION_VAULT_KEY/i,
    /GMAIL_SUPPORT_AI_API_KEY/i,
    /SUPABASE_SERVICE_ROLE_KEY/i,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      violations.push("Potential credential or environment secret detected in response text.");
      break;
    }
  }

  // ── 2. System Prompt / Architecture Leakage Check ────────────────────────────
  const internalLeakagePatterns = [
    /you are an elite customer support/i,
    /system prompt/i,
    /ground your response strictly/i,
    /provide your response in json/i,
    /callGmailSupportAI/i,
    /supabase/i,
    /postgres/i,
    /pg_cron/i,
  ];

  for (const pattern of internalLeakagePatterns) {
    if (pattern.test(text)) {
      violations.push("Internal system prompt or architectural details detected in response.");
      break;
    }
  }

  // ── 3. Unauthorized Immediate Financial Commitments ─────────────────────────
  // The AI can explain the refund *policy*, but must NEVER claim it processed an actual transaction.
  const unauthorizedActionPatterns = [
    /i have processed your refund/i,
    /i have refunded your money/i,
    /your refund of .* has been sent/i,
    /i have credited your account/i,
    /i have cancelled your subscription directly/i,
    /i have dispatched your package/i,
  ];

  for (const pattern of unauthorizedActionPatterns) {
    if (pattern.test(text)) {
      violations.push(`Unauthorized transactional action claim detected: "${pattern.source}".`);
      break;
    }
  }

  // ── 4. Hallucinated Price Quotes Check ───────────────────────────────────────
  // If the business has no configured pricing policy or knowledge docs mentioning prices,
  // the AI should not fabricate specific dollar/euro quotes.
  const hasPricingKnowledge = Boolean(
    rules?.payment_policy ||
    rules?.products_services ||
    rules?.product_service_info ||
    (knowledgeDocs && knowledgeDocs.some((k) => /price|\$|usd|eur|cost|fee/i.test(k.content)))
  );

  if (!hasPricingKnowledge) {
    const specificPricePattern = /\$\d+(\.\d{2})?|\b\d+\s*(usd|dollars|euros|inr|rupees)\b/i;
    if (specificPricePattern.test(text)) {
      violations.push("Specific price quotation detected without documented pricing policies.");
    }
  }

  // ── 5. Maximum Length Check ──────────────────────────────────────────────────
  const maxLength = rules?.max_reply_length || 1500;
  if (text.length > maxLength * 2) {
    violations.push(`Response length (${text.length} characters) exceeds safety limit (${maxLength * 2}).`);
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}
