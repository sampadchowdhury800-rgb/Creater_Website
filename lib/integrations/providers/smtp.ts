/**
 * lib/integrations/providers/smtp.ts
 *
 * Outbound SMTP provider module for sending customer support replies
 * using Gmail's SMTP server (smtp.gmail.com:465).
 * Uses customer's Gmail address and 16-character App Password.
 *
 * SECURITY INVARIANTS:
 * - The App Password MUST NEVER be logged or leaked into error messages.
 * - Idempotency is supported via deterministic message headers.
 */

import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { GmailImapCredentials } from "./imap";

export interface SmtpReplyParams {
  from?: string;
  to: string | string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  inReplyTo?: string;
  references?: string;
  idempotencyKey?: string;
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Classifies an SMTP error without leaking any credential information.
 */
function classifySmtpError(err: any): { errorCode: string; errorMessage: string } {
  const code = (err?.code || "").toUpperCase();
  const msg = (err?.message || "").toLowerCase();
  const response = (err?.response || "").toLowerCase();

  if (code === "EAUTH" || response.includes("535") || msg.includes("invalid credentials")) {
    return {
      errorCode: "CONNECTION_EXPIRED",
      errorMessage: "Gmail SMTP authentication failed. Please verify your Gmail address and App Password.",
    };
  }

  if (
    code === "ETIMEDOUT" ||
    code === "ETIME" ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  ) {
    return {
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Gmail SMTP server timed out.",
    };
  }

  if (
    response.includes("550") &&
    (response.includes("quota") || response.includes("limit") || msg.includes("quota"))
  ) {
    return {
      errorCode: "GMAIL_RATE_LIMITED",
      errorMessage: "Gmail sending quota or rate limit exceeded.",
    };
  }

  return {
    errorCode: "SMTP_SEND_FAILED",
    errorMessage: "Failed to send email reply via Gmail SMTP.",
  };
}

/**
 * Sends an email reply via Gmail SMTP.
 */
export async function sendSmtpReply(
  creds: GmailImapCredentials,
  params: SmtpReplyParams
): Promise<SmtpSendResult> {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL/TLS
    auth: {
      user: creds.email,
      pass: creds.appPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const fromAddress = params.from || creds.email;
  const plainText =
    params.bodyText ||
    params.bodyHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();

  // Construct standard RFC 2822 headers
  const mailOptions: Mail.Options = {
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    html: params.bodyHtml,
    text: plainText,
  };

  if (params.inReplyTo) {
    mailOptions.inReplyTo = params.inReplyTo;
  }

  if (params.references) {
    mailOptions.references = params.references;
  }

  if (params.idempotencyKey) {
    mailOptions.headers = {
      ...(mailOptions.headers || {}),
      "X-Idempotency-Key": params.idempotencyKey,
      "Message-ID": `<${params.idempotencyKey}@chowdhuryduo.com>`,
    };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      threadId: params.inReplyTo || undefined,
    };
  } catch (err: any) {
    const classified = classifySmtpError(err);
    console.warn("[SMTP Provider] sendSmtpReply failed", {
      errorCode: classified.errorCode,
    });
    return {
      success: false,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
    };
  } finally {
    transporter.close();
  }
}
