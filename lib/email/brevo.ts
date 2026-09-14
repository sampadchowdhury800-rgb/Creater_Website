/**
 * Brevo Transactional Email Service (REST API v3)
 *
 * Exclusively executes server-side.
 * Used for delivering developer escalation reports from the AI Customer Support system.
 *
 * CRITICAL SECURITY RULES:
 * - NEVER import in client components.
 * - NEVER log or leak BREVO_API_KEY in error messages, console, or client responses.
 * - Senders and recipients are validated before any API dispatch.
 *
 * Endpoint: https://api.brevo.com/v3/smtp/email
 * Auth:     api-key header from process.env.BREVO_API_KEY
 */

// ─── Env accessor (inline — avoids circular import with lib/env.ts) ────────────
function getEnv(key: string): string | null {
  return process.env[key] ?? null;
}

export interface SendBrevoEmailOptions {
  toEmail?: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  subject: string;
  textContent: string;
  htmlContent: string;
  replyTo?: { email: string; name?: string };
}

export interface BrevoEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Reset the cached transport.
 * Maintained as a compatibility no-op for test suites.
 */
export function resetBrevoTransport(): void {
  // REST API uses stateless fetch — no singleton connection cache needed.
}

export async function sendBrevoEmail(
  options: SendBrevoEmailOptions
): Promise<BrevoEmailResult> {
  // ── Test / Mock mode for CI and offline test suites ──────────────────────
  if (process.env.BREVO_MOCK_MODE === "true") {
    return {
      success: true,
      messageId: `<mock-${Date.now()}@brevo.chowdhuryduo>`,
      statusCode: 201,
    };
  }

  // ── Resolve addresses ─────────────────────────────────────────────────────
  const recipientEmail = (
    options.toEmail ||
    getEnv("SUPPORT_EMAIL") ||
    "chowdhuryduo@gmail.com"
  ).trim();

  const senderEmail = (
    options.fromEmail ||
    getEnv("SUPPORT_FROM_EMAIL") ||
    ""
  ).trim();

  if (!senderEmail) {
    console.warn(
      "[Brevo Service] SUPPORT_FROM_EMAIL is not configured. Set a verified Brevo sender address."
    );
    return {
      success: false,
      error: "SENDER_NOT_CONFIGURED",
      statusCode: 500,
    };
  }

  // ── Resolve API Key ───────────────────────────────────────────────────────
  const apiKey = getEnv("BREVO_API_KEY");
  if (!apiKey || !apiKey.trim()) {
    console.warn(
      "[Brevo Service] BREVO_API_KEY is not configured. Email cannot be dispatched."
    );
    return {
      success: false,
      error: "BREVO_NOT_CONFIGURED",
      statusCode: 500,
    };
  }

  // ── Build Brevo v3 REST API payload ───────────────────────────────────────
  const payload: Record<string, any> = {
    sender: {
      name: options.fromName || "Chowdhury Duo Support System",
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail,
        name: options.toName || "Chowdhury Duo Developer Team",
      },
    ],
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent,
  };

  if (options.replyTo?.email) {
    payload.replyTo = {
      email: options.replyTo.email.trim(),
      name: options.replyTo.name || "Customer",
    };
  }

  // ── Dispatch via Brevo REST API ───────────────────────────────────────────
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey.trim(),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      return {
        success: true,
        messageId: data?.messageId || "unknown-id",
        statusCode: res.status,
      };
    }

    // Classify error responses without leaking keys
    const rawError = data?.message || data?.code || res.statusText;
    const sanitizedError = String(rawError).replace(
      /(?:xkeysib|xsmtpsib)-[^\s"']*/gi,
      "[REDACTED]"
    );

    console.error(`[Brevo Service] API request failed (${res.status}):`, sanitizedError);

    if (res.status === 401) {
      return {
        success: false,
        error: "BREVO_AUTH_FAILED",
        statusCode: 401,
      };
    }

    if (res.status === 400) {
      return {
        success: false,
        error: "INVALID_RECIPIENT_OR_SENDER",
        statusCode: 400,
      };
    }

    return {
      success: false,
      error: sanitizedError || "BREVO_API_ERROR",
      statusCode: res.status,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    const rawMsg = err?.message || String(err);
    const sanitizedMsg = rawMsg.replace(
      /(?:xkeysib|xsmtpsib)-[^\s"']*/gi,
      "[REDACTED]"
    );

    if (isTimeout) {
      console.error("[Brevo Service] Request timed out after 20s.");
      return {
        success: false,
        error: "TIMEOUT",
        statusCode: 504,
      };
    }

    console.error("[Brevo Service] Network error during email dispatch:", sanitizedMsg);
    return {
      success: false,
      error: "NETWORK_ERROR",
      statusCode: 500,
    };
  }
}
