/**
 * lib/integrations/providers/google.ts
 *
 * Fixed Google Gmail API client for Chowdhury Duo Integration Gateway.
 * NOT a generic HTTP proxy — executes strictly pre-defined capability actions.
 * SERVER-SIDE ONLY.
 */

import type {
  GmailSendParameters,
  GmailReadListParameters,
  GmailGetMessageParameters,
  GmailModifyParameters,
  GmailWatchParameters,
  GmailListHistoryParameters,
  GatewayBusinessResponse,
} from "../types";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Base64URL encoder conforming to RFC 4648 §5.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds an RFC 2822 compliant MIME message string.
 */
export function buildRfc2822Email(
  params: GmailSendParameters,
  fromEmail?: string,
  deterministicMessageId?: string
): string {
  const lines: string[] = [];

  if (fromEmail) {
    lines.push(`From: ${fromEmail}`);
  }
  lines.push(`To: ${params.to.join(", ")}`);
  if (params.cc && params.cc.length > 0) {
    lines.push(`Cc: ${params.cc.join(", ")}`);
  }
  if (params.bcc && params.bcc.length > 0) {
    lines.push(`Bcc: ${params.bcc.join(", ")}`);
  }
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(params.subject, "utf8").toString("base64")}?=`);

  if (deterministicMessageId) {
    lines.push(`Message-ID: <${deterministicMessageId}@chowdhuryduo.com>`);
  }
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    lines.push(`References: ${params.references}`);
  }

  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(params.bodyHtml);

  return lines.join("\r\n");
}

/**
 * Sanitizes Google API errors into safe application errors.
 * Guarantees that raw access tokens or headers are NEVER leaked.
 */
export function sanitizeGoogleApiError(
  statusOrError: number | unknown,
  errorData?: unknown
): GatewayBusinessResponse {
  let status = typeof statusOrError === "number" ? statusOrError : 500;
  let googleMessage = "";

  if (typeof statusOrError !== "number" && statusOrError instanceof Error) {
    googleMessage = statusOrError.message;
    if (googleMessage.includes("401")) status = 401;
    else if (googleMessage.includes("429")) status = 429;
    else if (googleMessage.includes("403")) status = 403;
  } else if (errorData && typeof errorData === "object") {
    const obj = errorData as Record<string, any>;
    googleMessage = obj.error?.message || "";
  }

  if (status === 401) {
    return { success: false, errorCode: "CONNECTION_EXPIRED", errorMessage: "Google authorization expired or revoked." };
  }
  if (status === 429 || (status === 403 && googleMessage.toLowerCase().includes("quota"))) {
    return { success: false, errorCode: "GMAIL_RATE_LIMITED", errorMessage: "Google email sending quota exceeded." };
  }
  if (status === 403) {
    return { success: false, errorCode: "CAPABILITY_NOT_ALLOWED", errorMessage: "Insufficient Gmail permissions for this operation." };
  }

  return {
    success: false,
    errorCode: "GMAIL_API_ERROR",
    errorMessage: "Google Gmail operation failed. Please verify recipient and try again.",
  };
}

/**
 * Searches Gmail for an email sent with a specific deterministic Message-ID (for crash recovery).
 */
export async function checkGmailMessageSentByIdempotencyKey(
  accessToken: string,
  idempotencyKey: string
): Promise<{ found: boolean; messageId?: string; threadId?: string }> {
  try {
    const query = `rfc822msgid:${idempotencyKey}@chowdhuryduo.com`;
    const url = `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=1`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return { found: false };

    const data = await res.json();
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      return {
        found: true,
        messageId: data.messages[0].id,
        threadId: data.messages[0].threadId,
      };
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

/**
 * Executes the GMAIL_SEND capability operation.
 */
export async function executeGmailSend(
  accessToken: string,
  params: GmailSendParameters,
  fromEmail?: string,
  deterministicMessageId?: string
): Promise<GatewayBusinessResponse> {
  const rawEmail = buildRfc2822Email(params, fromEmail, deterministicMessageId);
  const rawBase64 = base64UrlEncode(rawEmail);

  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: rawBase64 }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    const data = (await response.json()) as { id: string; threadId: string };
    return {
      success: true,
      messageId: data.id,
      threadId: data.threadId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out during send.",
    };
  }
}

/**
 * Executes the GMAIL_READ_LIST capability operation.
 */
export async function executeGmailReadList(
  accessToken: string,
  params: GmailReadListParameters
): Promise<GatewayBusinessResponse> {
  const url = new URL(`${GMAIL_API_BASE}/messages`);
  if (params.maxResults) url.searchParams.set("maxResults", String(params.maxResults));
  if (params.query) url.searchParams.set("q", params.query);
  if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);
  if (params.labelIds && params.labelIds.length > 0) {
    for (const label of params.labelIds) {
      url.searchParams.append("labelIds", label);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    const data = await response.json();
    return {
      success: true,
      messages: data.messages || [],
      nextPageToken: data.nextPageToken,
    };
  } catch {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out while fetching messages.",
    };
  }
}

/**
 * Executes the GMAIL_GET_MESSAGE capability operation.
 */
export async function executeGmailGetMessage(
  accessToken: string,
  params: GmailGetMessageParameters
): Promise<GatewayBusinessResponse> {
  const url = `${GMAIL_API_BASE}/messages/${params.messageId}?format=${params.format || "metadata"}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    const data = await response.json();
    const headers = data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;

    const bodies = extractBodyFromPayload(data.payload);

    return {
      success: true,
      message: {
        id: data.id,
        threadId: data.threadId,
        snippet: data.snippet,
        subject: getHeader("subject"),
        from: getHeader("from"),
        date: getHeader("date"),
        internalDate: data.internalDate ? Number(data.internalDate) : undefined,
        bodyText: bodies.text,
        bodyHtml: bodies.html,
      },
    };
  } catch {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out.",
    };
  }
}

/**
 * Extracts plain text and HTML bodies from Gmail message payload parts recursively.
 */
function extractBodyFromPayload(payload: any): { text?: string; html?: string } {
  if (!payload) return {};
  let text = "";
  let html = "";

  function walkParts(part: any) {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64url").toString("utf8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        walkParts(subPart);
      }
    }
  }

  if (payload.body?.data) {
    if (payload.mimeType === "text/html") {
      html = Buffer.from(payload.body.data, "base64url").toString("utf8");
    } else {
      text = Buffer.from(payload.body.data, "base64url").toString("utf8");
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      walkParts(part);
    }
  }

  return { text: text.trim() || undefined, html: html.trim() || undefined };
}

/**
 * Executes the GMAIL_MODIFY capability operation.
 */
export async function executeGmailModify(
  accessToken: string,
  params: GmailModifyParameters
): Promise<GatewayBusinessResponse> {
  const url = `${GMAIL_API_BASE}/messages/${params.messageId}/modify`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds: params.addLabelIds || [],
        removeLabelIds: params.removeLabelIds || [],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.id,
      labelsApplied: data.labelIds,
    };
  } catch {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out.",
    };
  }
}

/**
 * Executes the GMAIL_WATCH capability operation (sets up push notifications).
 */
export async function executeGmailWatch(
  accessToken: string,
  params: GmailWatchParameters
): Promise<GatewayBusinessResponse> {
  const url = `${GMAIL_API_BASE}/watch`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicName: params.topicName,
        labelIds: params.labelIds || ["INBOX"],
        labelFilterBehavior: params.labelFilterBehavior || "include",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    const data = await response.json();
    return {
      success: true,
      historyId: String(data.historyId),
      expiration: String(data.expiration),
    };
  } catch {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out while setting up watch.",
    };
  }
}

/**
 * Stops Gmail push notifications for the connected mailbox.
 */
export async function executeGmailStopWatch(
  accessToken: string
): Promise<GatewayBusinessResponse> {
  const url = `${GMAIL_API_BASE}/stop`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    return {
      success: true,
    };
  } catch {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out while stopping watch.",
    };
  }
}

/**
 * Lists history changes in Gmail since startHistoryId.
 */
export async function executeGmailListHistory(
  accessToken: string,
  params: GmailListHistoryParameters
): Promise<GatewayBusinessResponse> {
  const queryParams = new URLSearchParams({
    startHistoryId: params.startHistoryId,
  });

  if (params.maxResults) {
    queryParams.set("maxResults", String(Math.min(params.maxResults, 100)));
  }
  if (params.labelId) {
    queryParams.set("labelId", params.labelId);
  }
  if (params.pageToken) {
    queryParams.set("pageToken", params.pageToken);
  }

  const url = `${GMAIL_API_BASE}/history?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return sanitizeGoogleApiError(response.status, errorData);
    }

    const data = await response.json();
    return {
      success: true,
      history: data.history || [],
      nextPageToken: data.nextPageToken,
      historyId: String(data.historyId),
    };
  } catch {
    return {
      success: false,
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Google timed out while fetching history.",
    };
  }
}
