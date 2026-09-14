/**
 * Developer Escalation Service for Chowdhury Duo AI Customer Support.
 *
 * Handles:
 * 1. Cryptographic Support Reference ID generation (format: CD-XXXXXX)
 * 2. Structured escalation report generation (HTML and Plain Text)
 * 3. Deep redaction and secret sanitization
 * 4. In-memory escalation rate limiting and duplicate prevention
 */

import { sanitizeOutput } from "./guardrails";
import type { ChatMessage } from "./types";

export interface CustomerContext {
  isAuthenticated: boolean;
  name?: string | null;
  email?: string | null;
  userId?: string | null;
}

export interface AutomationEscalationContext {
  id?: string | null;
  title?: string | null;
  slug?: string | null;
  pricingType?: string | null;
  activePlansSummary?: string | null;
  safeExecutionStatus?: string | null;
  safeExecutionError?: string | null;
}

export interface EscalationReportData {
  referenceId: string;
  timestamp: string;
  customer: CustomerContext;
  automation?: AutomationEscalationContext;
  originalQuestion: string;
  conversation: ChatMessage[];
  problemSummary: string;
  troubleshootingProvided: string[];
  verifiedInformation: string[];
  unverifiedInformation: string[];
  recommendedAction: string;
}

/**
 * Generates a customer-facing support reference ID.
 * Format: CD-XXXXXX (where X is an unambiguous alphanumeric character)
 */
export function generateReferenceId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CD-${randomPart}`;
}

/**
 * Deeply scrubs all potential secret tokens, keys, passwords, connection strings,
 * and sensitive infrastructure credentials from escalation text.
 */
export function sanitizeEscalationContent(content: string): string {
  if (!content) return "";

  // 1. Run through the core AI output sanitizer (removes database URLs, rzp keys, vault hex keys)
  let scrubbed = sanitizeOutput(content);

  // 2. Extra regex scrubbers for bearer tokens, Brevo keys, and credential headers
  scrubbed = scrubbed.replace(/xkeysib-[a-zA-Z0-9_-]+/g, "[REDACTED_BREVO_KEY]");
  scrubbed = scrubbed.replace(/sk-or-v1-[a-zA-Z0-9_-]+/g, "[REDACTED_OPENROUTER_KEY]");
  scrubbed = scrubbed.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]");
  scrubbed = scrubbed.replace(/password\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, "password: [REDACTED]");
  scrubbed = scrubbed.replace(/secret\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, "secret: [REDACTED]");
  scrubbed = scrubbed.replace(/n8n_internal_[a-zA-Z0-9_]+/gi, "[REDACTED_INTERNAL_ID]");

  return scrubbed;
}

/**
 * Builds the plain text structured developer report.
 */
export function buildEscalationTextReport(data: EscalationReportData): string {
  const customerName = data.customer.name || (data.customer.isAuthenticated ? "Authenticated User" : "Anonymous Visitor");
  const customerEmail = data.customer.email || "Not provided / Anonymous";
  const authStatus = data.customer.isAuthenticated ? "Authenticated (Clerk verified)" : "Unauthenticated (Guest)";

  const autoTitle = data.automation?.title || "General / Unspecified Automation";
  const autoSlug = data.automation?.slug ? `(Slug: ${data.automation.slug})` : "";
  const plansSummary = data.automation?.activePlansSummary || "N/A";
  const execStatus = data.automation?.safeExecutionStatus
    ? `Status: ${data.automation.safeExecutionStatus}${data.automation.safeExecutionError ? ` (Note: ${data.automation.safeExecutionError})` : ""}`
    : "No execution record in context";

  const conversationHistory = data.conversation
    .slice(-8) // Take last 8 turns maximum
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  const text = `
----------------------------------------------------------------------
CHOWDHURY DUO — SUPPORT ESCALATION REPORT
----------------------------------------------------------------------
Support Reference ID : ${data.referenceId}
Timestamp            : ${data.timestamp}

CUSTOMER INFORMATION
--------------------
- Name                  : ${customerName}
- Contact Email         : ${customerEmail}
- Authentication Status : ${authStatus}

AUTOMATION CONTEXT
------------------
- Automation            : ${autoTitle} ${autoSlug}
- Available Plans       : ${plansSummary}
- Safe Execution Info   : ${execStatus}

CUSTOMER'S ORIGINAL QUESTION
----------------------------
${data.originalQuestion}

WHAT THE AI UNDERSTOOD THE PROBLEM TO BE
----------------------------------------
${data.problemSummary}

WHAT TROUBLESHOOTING STEPS THE AI PROVIDED
------------------------------------------
${data.troubleshootingProvided.length > 0 ? data.troubleshootingProvided.map((s, i) => `${i + 1}. ${s}`).join("\n") : "No specific automated troubleshooting steps were applicable."}

WHAT THE AI COULD VERIFY (FROM DATABASE)
----------------------------------------
${data.verifiedInformation.length > 0 ? data.verifiedInformation.map((v) => `• ${v}`).join("\n") : "No verified database records matched."}

WHAT THE AI COULD NOT VERIFY
----------------------------
${data.unverifiedInformation.length > 0 ? data.unverifiedInformation.map((u) => `• ${u}`).join("\n") : "None specified."}

RECOMMENDED NEXT ACTION FOR DEVELOPER
-------------------------------------
${data.recommendedAction}

RELEVANT CONVERSATION CONTEXT (LAST TURNS)
------------------------------------------
${conversationHistory}
----------------------------------------------------------------------
`.trim();

  return sanitizeEscalationContent(text);
}

/**
 * Builds the HTML structured developer report for Brevo email dispatch.
 */
export function buildEscalationHtmlReport(data: EscalationReportData): string {
  const customerName = data.customer.name || (data.customer.isAuthenticated ? "Authenticated User" : "Anonymous Visitor");
  const customerEmail = data.customer.email || "Not provided / Anonymous";
  const authStatus = data.customer.isAuthenticated ? "Authenticated (Clerk verified)" : "Unauthenticated (Guest)";

  const autoTitle = data.automation?.title || "General / Unspecified Automation";
  const autoSlug = data.automation?.slug ? `(Slug: ${data.automation.slug})` : "";
  const plansSummary = data.automation?.activePlansSummary || "N/A";
  const execStatus = data.automation?.safeExecutionStatus
    ? `Status: ${data.automation.safeExecutionStatus}${data.automation.safeExecutionError ? ` (Note: ${data.automation.safeExecutionError})` : ""}`
    : "No execution record in context";

  const conversationHistoryHtml = data.conversation
    .slice(-8)
    .map(
      (m) =>
        `<div style="margin-bottom: 12px; padding: 10px; border-radius: 6px; background-color: ${
          m.role === "user" ? "#f1f5f9" : "#e0f2fe"
        };">
          <strong style="color: ${m.role === "user" ? "#334155" : "#0284c7"}; font-size: 11px; text-transform: uppercase;">${
          m.role
        }:</strong>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #1e293b; white-space: pre-wrap;">${sanitizeEscalationContent(
            m.content
          )}</p>
        </div>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Chowdhury Duo Support Escalation - ${data.referenceId}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f8fafc; padding: 24px; margin: 0;">
  <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <div style="background: #0f172a; padding: 24px; color: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #38bdf8;">CHOWDHURY DUO — SUPPORT ESCALATION</h1>
      </div>
      <div style="margin-top: 10px; font-size: 13px; color: #94a3b8;">
        <span>Reference ID: <strong style="color: #f8fafc; font-family: monospace;">${data.referenceId}</strong></span>
        <span style="margin: 0 8px;">•</span>
        <span>${data.timestamp}</span>
      </div>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <!-- Customer Information -->
      <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 0;">Customer Information</h2>
        <table style="width: 100%; font-size: 13px;">
          <tr><td style="width: 160px; color: #64748b; padding: 4px 0;">Name:</td><td style="font-weight: 600; color: #0f172a;">${sanitizeEscalationContent(customerName)}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Contact Email:</td><td>${sanitizeEscalationContent(customerEmail)}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Auth Status:</td><td><span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #ecfdf5; color: #047857;">${authStatus}</span></td></tr>
        </table>
      </div>

      <!-- Automation Context -->
      <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 0;">Automation & Product Context</h2>
        <table style="width: 100%; font-size: 13px;">
          <tr><td style="width: 160px; color: #64748b; padding: 4px 0;">Automation:</td><td style="font-weight: 600; color: #0f172a;">${sanitizeEscalationContent(autoTitle)} ${sanitizeEscalationContent(autoSlug)}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Live Plans:</td><td>${sanitizeEscalationContent(plansSummary)}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Safe Execution Info:</td><td>${sanitizeEscalationContent(execStatus)}</td></tr>
        </table>
      </div>

      <!-- Problem and Steps -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 0;">Original Query & Problem Breakdown</h2>
        <div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 6px 6px 0;">
          <strong style="font-size: 12px; color: #0369a1; text-transform: uppercase;">Customer Query:</strong>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #0f172a;">${sanitizeEscalationContent(data.originalQuestion)}</p>
        </div>

        <div style="margin-bottom: 16px;">
          <strong style="font-size: 13px; color: #334155;">Problem Understood by AI:</strong>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">${sanitizeEscalationContent(data.problemSummary)}</p>
        </div>

        <div style="margin-bottom: 16px;">
          <strong style="font-size: 13px; color: #334155;">AI Troubleshooting Steps Provided:</strong>
          <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
            ${data.troubleshootingProvided.map((step) => `<li>${sanitizeEscalationContent(step)}</li>`).join("")}
          </ul>
        </div>
      </div>

      <!-- Verified vs Unverified -->
      <div style="margin-bottom: 24px; display: flex; gap: 16px;">
        <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px;">
          <strong style="font-size: 12px; color: #166534; text-transform: uppercase;">Verified Database Info:</strong>
          <ul style="margin: 6px 0 0 0; padding-left: 18px; font-size: 12px; color: #166534;">
            ${data.verifiedInformation.map((v) => `<li>${sanitizeEscalationContent(v)}</li>`).join("")}
          </ul>
        </div>
        <div style="flex: 1; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px;">
          <strong style="font-size: 12px; color: #9a3412; text-transform: uppercase;">Unverified / Needed:</strong>
          <ul style="margin: 6px 0 0 0; padding-left: 18px; font-size: 12px; color: #9a3412;">
            ${data.unverifiedInformation.map((u) => `<li>${sanitizeEscalationContent(u)}</li>`).join("")}
          </ul>
        </div>
      </div>

      <!-- Recommended Action -->
      <div style="margin-bottom: 24px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px;">
        <strong style="font-size: 12px; color: #1e40af; text-transform: uppercase;">Recommended Developer Action:</strong>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #1e3a8a;">${sanitizeEscalationContent(data.recommendedAction)}</p>
      </div>

      <!-- Conversation History -->
      <div>
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 0;">Recent Conversation Context</h2>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; max-height: 280px; overflow-y: auto;">
          ${conversationHistoryHtml}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
      This report was generated securely by Chowdhury Duo AI Support Escalation System. No passwords or secret keys are retained or transmitted.
    </div>
  </div>
</body>
</html>
`.trim();

  return html;
}

// ─── Rate Limiting & Cooldown Protection ──────────────────────────────────────
interface EscalationLimitRecord {
  count: number;
  lastEscalationTime: number;
  lastQuestionHash: string;
}

const escalationLimits = new Map<string, EscalationLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ESCALATIONS_PER_WINDOW = 3;
const COOLDOWN_PERIOD_MS = 30 * 1000; // 30 seconds minimum between requests

export interface EscalationCheckResult {
  allowed: boolean;
  reason?: "RATE_LIMITED" | "COOLDOWN_ACTIVE" | "DUPLICATE_SUBMISSION";
  message?: string;
  retryAfterSeconds?: number;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

/**
 * Checks whether an escalation request is allowed from the given client key (IP or user ID).
 * Protects against bot spam, accidental double-clicks, and duplicate queries.
 */
export function checkEscalationLimit(
  clientKey: string,
  questionText: string
): EscalationCheckResult {
  const now = Date.now();
  const qHash = hashString(questionText.trim().toLowerCase());
  const record = escalationLimits.get(clientKey);

  if (!record) {
    escalationLimits.set(clientKey, {
      count: 1,
      lastEscalationTime: now,
      lastQuestionHash: qHash,
    });
    return { allowed: true };
  }

  // Check window expiry
  if (now - record.lastEscalationTime > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.lastEscalationTime = now;
    record.lastQuestionHash = qHash;
    return { allowed: true };
  }

  // Check minimum cooldown (e.g. 30s)
  const timeSinceLast = now - record.lastEscalationTime;
  if (timeSinceLast < COOLDOWN_PERIOD_MS) {
    const remainingSecs = Math.ceil((COOLDOWN_PERIOD_MS - timeSinceLast) / 1000);
    return {
      allowed: false,
      reason: "COOLDOWN_ACTIVE",
      message: `Please wait ${remainingSecs} seconds before submitting another escalation request.`,
      retryAfterSeconds: remainingSecs,
    };
  }

  // Check identical duplicate
  if (record.lastQuestionHash === qHash && timeSinceLast < 5 * 60 * 1000) {
    return {
      allowed: false,
      reason: "DUPLICATE_SUBMISSION",
      message:
        "This support query has already been submitted to our developer. Please allow our team time to review it.",
    };
  }

  // Check max per window
  if (record.count >= MAX_ESCALATIONS_PER_WINDOW) {
    return {
      allowed: false,
      reason: "RATE_LIMITED",
      message:
        "You have submitted multiple escalation requests recently. Please wait a few minutes before submitting another.",
      retryAfterSeconds: Math.ceil(
        (RATE_LIMIT_WINDOW_MS - timeSinceLast) / 1000
      ),
    };
  }

  record.count += 1;
  record.lastEscalationTime = now;
  record.lastQuestionHash = qHash;
  return { allowed: true };
}
