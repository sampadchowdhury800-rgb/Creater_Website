/**
 * Guardrails and security boundary for the Chowdhury Duo AI Support Assistant.
 *
 * Provides:
 * 1. Prompt Injection & Jailbreak Pre-screening
 * 2. Blatant Off-Topic Domain Screening (with smart pass-through for mixed queries)
 * 3. Output Sanitization (scrubbing secrets, keys, connection strings)
 */

export const STANDARD_REFUSAL_MESSAGE =
  "I am the official Chowdhury Duo customer support assistant. I can only assist with questions regarding Chowdhury Duo's website, automation marketplace, products, pricing plans, workspace configuration, execution, and product support. How can I help you with our automations today?";

/**
 * Patterns that indicate adversarial prompt injection or system prompt extraction.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+|your\s+|any\s+)?(previous|prior|above)?\s*(instructions|prompts|rules)\b/i,
  /\b(reveal|print|show|display|give|dump)\s+(me\s+)?(your\s+)?((hidden\s+)?(instructions|system\s+prompt|prompt|context)|role\s+definition|internal\s+instructions)\b/i,
  /\b(act|pretend|simulate|roleplay)\s+as\s+(an?\s+)?(unrestricted|jailbroken|dan|evil|base)\s+(ai|chatgpt|model|bot)\b/i,
  /\b(forget|discard|override|bypass|disable)\s+(your\s+)?(rules|guidelines|restrictions|constraints)\b/i,
  /\b(show|dump|give|reveal|tell|print)\s+(me\s+)?(the\s+|your\s+|all\s+)?(database|all\s+users|(all\s+)?api\s*keys?|secrets?|passwords?|tokens?|env(ironment)?(\s*variables)?)\b/i,
  /\b(give|show|reveal|tell)\s+(me\s+)?(your\s+|the\s+)?api\s*keys?\b/i,
  /\b(show|give|dump|reveal|print)\s+(me\s+)?(all\s+)?environment\s+variables\b/i,
  /\b(show|reveal|give)\s+(me\s+)?(another|other|all)\s+(users?|customers?)('s)?\s+(automations?|data|workspace|secrets?|keys?)\b/i,
  /\b(print|dump)\s+all\s+database\s+records\b/i,
  /\btell\s+me\s+(the\s+)?(database\s+password|admin\s+password|vault\s+key)\b/i,
  /\b(n8n\s+credentials|n8n\s+api\s*key)\b/i,
  /\b(what\s+is\s+your|what\s+are\s+your)\s+(exact\s+)?(system\s+prompt|initial\s+prompt|base\s+instructions)\b/i,
  /\bmode:\s*developer\b/i,
  /\bDAN\s+mode\b/i,
];

/**
 * Common off-topic triggers that are completely unrelated to Chowdhury Duo.
 */
const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(weather\s+in|weather\s+today|temperature\s+outside|forecast\s+for|what\s+is\s+the\s+weather)\b/i,
  /\b(cricket\s+match|who\s+won\s+the\s+match|football\s+score|ipl\s+score|what\s+happened\s+in\s+cricket)\b/i,
  /\bwrite\s+(a\s+)?(poem|sonnet|haiku|short\s+story|song|lyrics|rap)\b/i,
  /\b(do\s+my|help\s+(me\s+)?with\s+my)\s+(homework|college\s+assignment|assignment|essay|thesis)\b/i,
  /\bwrite\s+(python|javascript|java|c\+\+|rust|html)\s+(code|game|program|script\s+for\s+a\s+game)\b/i,
  /\b(what\s+is\s+bitcoin|cryptocurrency\s+price|buy\s+ethereum|stock\s+tips|crypto\s+question)\b/i,
  /\btell\s+(me\s+)?a\s+joke\b/i,
  /\b(who\s+is\s+the\s+president|political\s+party|election\s+results)\b/i,
  /\b(relationship\s+advice|dating\s+advice|how\s+to\s+impress\s+a\s+girl)\b/i,
  /\btranslate\s+(this\s+sentence|into\s+french|into\s+spanish|into\s+german)\b/i,
  /\bhow\s+to\s+(hack|crack|bypass|exploit|ddos)\b/i,
];

/**
 * Legitimate domain signals for Chowdhury Duo and the automation marketplace.
 */
const DOMAIN_SIGNALS: RegExp[] = [
  /\b(automation|automations|marketplace|chowdhury|duo|workspace|n8n|workflow|workflows|plan|plans|pricing|price|cost|trial|lifetime|maintenance|buy|cart|order|entitlement|execute|execution|run|configure|configuration|config)\b/i,
  /\b(gmail|youtube|instagram|lead|funnel|webhook|api\s*key|credential|license)\b/i,
];

export interface GuardrailCheckResult {
  blocked: boolean;
  reason?: "INJECTION" | "OFF_TOPIC";
  message?: string;
  isMixed?: boolean;
}

/**
 * Pre-screens user input for adversarial attacks or explicit off-topic questions.
 * Smart handling: If an off-topic query also mentions Chowdhury Duo products, it is flagged as mixed
 * and forwarded to the model so the model can refuse the off-topic part while answering the product part.
 */
export function checkInputGuardrails(userInput: string): GuardrailCheckResult {
  const trimmed = userInput.trim();
  if (!trimmed) {
    return { blocked: false };
  }

  // 1. Check for prompt injection attempts (ALWAYS blocked immediately)
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        reason: "INJECTION",
        message: STANDARD_REFUSAL_MESSAGE,
      };
    }
  }

  // 2. Check for off-topic domain violations
  let matchesOffTopic = false;
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      matchesOffTopic = true;
      break;
    }
  }

  if (matchesOffTopic) {
    // Check if it's a mixed query containing legitimate Chowdhury Duo domain signals
    const hasDomainSignal = DOMAIN_SIGNALS.some((sig) => sig.test(trimmed));
    if (hasDomainSignal) {
      // Mixed query: allow it through so system prompt can refuse the off-topic part
      // and answer the Chowdhury Duo part.
      return { blocked: false, isMixed: true };
    }

    // Purely off-topic: block immediately
    return {
      blocked: true,
      reason: "OFF_TOPIC",
      message: STANDARD_REFUSAL_MESSAGE,
    };
  }

  return { blocked: false };
}

/**
 * Patterns of secrets that must NEVER leak in AI output under any circumstances.
 */
const SECRET_LEAK_PATTERNS: RegExp[] = [
  /postgresql:\/\/[^\s"']+/gi,
  /postgres:\/\/[^\s"']+/gi,
  /rzp_(test|live)_[a-zA-Z0-9]{14,}/gi,
  /\b[A-Za-z0-9_-]{24,}:[A-Za-z0-9_-]{24,}\b/g, // Key:Secret pairs
  /sk_test_[a-zA-Z0-9_-]{20,}/gi,
  /sk_live_[a-zA-Z0-9_-]{20,}/gi,
  /pk_test_[a-zA-Z0-9_-]{20,}/gi,
  /pk_live_[a-zA-Z0-9_-]{20,}/gi,
  /\b[0-9a-fA-F]{64}\b/g, // 32-byte hex keys (e.g. vault keys, session secrets)
];

/**
 * Sanitizes model output to ensure no secrets or database credentials accidentally leak.
 */
export function sanitizeOutput(output: string): string {
  let sanitized = output;

  for (const pattern of SECRET_LEAK_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED_SECURE_TOKEN]");
  }

  // Ensure system prompt or internal role directives are not echoed
  sanitized = sanitized.replace(/ROLE:\s*You are Chowdhury Duo/gi, "[REDACTED]");
  sanitized = sanitized.replace(/MISSION:\s*Help customers/gi, "[REDACTED]");

  return sanitized;
}
