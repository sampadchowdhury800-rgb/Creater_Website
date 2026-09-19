/**
 * supabase/functions/_shared/google-api.ts
 *
 * Dedicated Gmail API client for Supabase Edge Functions.
 * Handles token refresh, email fetching/parsing, MIME response building, sending, and labeling.
 */

import { ParsedEmailMessage } from "./types.ts";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Base64URL encoder conforming to RFC 4648 §5.
 */
export function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes Base64URL string to UTF-8 text.
 */
export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch {
    return atob(base64);
  }
}

/**
 * Refreshes an expired Google OAuth access token using a refresh token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Extracts plain text and HTML from a Gmail message payload.
 */
function extractBodyFromPayload(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  if (!payload) return { text, html };

  if (payload.body?.data) {
    const decoded = base64UrlDecode(payload.body.data);
    if (payload.mimeType === "text/html") {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += base64UrlDecode(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html += base64UrlDecode(part.body.data);
      } else if (part.parts) {
        const nested = extractBodyFromPayload(part);
        text += nested.text;
        html += nested.html;
      }
    }
  }

  if (!text && html) {
    // Strip HTML tags for clean fallback text
    text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return { text: text.trim(), html: html.trim() };
}

/**
 * Fetches a single message by ID and parses its headers and body.
 */
export async function fetchGmailMessage(
  accessToken: string,
  messageId: string
): Promise<ParsedEmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/${messageId}?format=full`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch Gmail message ${messageId}: ${err}`);
  }

  const data = await response.json();
  const headersList: Array<{ name: string; value: string }> = data.payload?.headers || [];
  const headersMap: Record<string, string> = {};

  for (const h of headersList) {
    headersMap[h.name.toLowerCase()] = h.value;
  }

  const sender = headersMap["from"] || "unknown";
  const recipient = headersMap["to"] || "unknown";
  const subject = headersMap["subject"] || "(no subject)";
  const date = headersMap["date"] || new Date().toISOString();
  const messageIdHeader = headersMap["message-id"] || null;
  const inReplyToHeader = headersMap["in-reply-to"] || null;
  const referencesHeader = headersMap["references"] || null;

  const { text, html } = extractBodyFromPayload(data.payload);

  return {
    id: data.id,
    threadId: data.threadId || data.id,
    sender,
    recipient,
    subject,
    bodyText: text,
    bodyHtml: html || `<p>${text}</p>`,
    messageIdHeader,
    inReplyToHeader,
    referencesHeader,
    date,
    headers: headersMap,
  };
}

/**
 * Lists new messages from Gmail history since a given startHistoryId.
 * Returns both the messages list and the latest historyId seen.
 */
export async function listGmailHistory(
  accessToken: string,
  startHistoryId: string
): Promise<{ messages: Array<{ id: string; threadId: string }>; latestHistoryId: string | null }> {
  const url = `${GMAIL_API_BASE}/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&labelId=INBOX`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    // historyId may be too old — caller should fall back to listRecentInboxMessages
    const errText = await response.text();
    console.warn(`Gmail history.list failed (${response.status}): ${errText}`);
    return { messages: [], latestHistoryId: null };
  }

  const data = await response.json();
  const messageList: Array<{ id: string; threadId: string }> = [];
  const seenIds = new Set<string>();

  if (Array.isArray(data.history)) {
    for (const record of data.history) {
      if (record.messagesAdded) {
        for (const item of record.messagesAdded) {
          if (item.message?.id && !seenIds.has(item.message.id)) {
            seenIds.add(item.message.id);
            messageList.push({
              id: item.message.id,
              threadId: item.message.threadId || item.message.id,
            });
          }
        }
      }
    }
  }

  const latestHistoryId: string | null = data.historyId ?? null;
  return { messages: messageList, latestHistoryId };
}

/**
 * Fetches recent INBOX messages (first-run fallback when no history_id is stored).
 * Uses Gmail messages.list with a 24-hour time window.
 * Returns up to `maxResults` messages and the latest historyId for future delta checks.
 */
export async function listRecentInboxMessages(
  accessToken: string,
  maxResults = 50
): Promise<{ messages: Array<{ id: string; threadId: string }>; latestHistoryId: string | null }> {
  // q=in:inbox newer_than:1d — narrow window to avoid processing stale mail on first run
  const q = encodeURIComponent("in:inbox newer_than:1d");
  const url = `${GMAIL_API_BASE}/messages?q=${q}&maxResults=${maxResults}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.warn(`Gmail messages.list failed (${response.status}): ${errText}`);
    return { messages: [], latestHistoryId: null };
  }

  const data = await response.json();
  const messages: Array<{ id: string; threadId: string }> = (data.messages || []).map(
    (m: { id: string; threadId: string }) => ({ id: m.id, threadId: m.threadId || m.id })
  );

  // Fetch the current historyId from the profile so future polls are efficient
  let latestHistoryId: string | null = null;
  try {
    const profileRes = await fetch(`${GMAIL_API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      latestHistoryId = profile.historyId ?? null;
    }
  } catch {
    // Non-fatal — next run will retry
  }

  return { messages, latestHistoryId };
}

/**
 * Sends a reply email via Gmail API preserving threads and headers.
 */
export async function sendGmailReply(
  accessToken: string,
  options: {
    fromEmail: string;
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    threadId: string;
    inReplyTo?: string | null;
    references?: string | null;
  }
): Promise<{ id: string; threadId: string }> {
  const subjectLine = options.subject.toLowerCase().startsWith("re:")
    ? options.subject
    : `Re: ${options.subject}`;

  const mimeLines: string[] = [
    `From: ${options.fromEmail}`,
    `To: ${options.to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subjectLine)))}?=`,
    `MIME-Version: 1.0`,
  ];

  if (options.inReplyTo) {
    mimeLines.push(`In-Reply-To: ${options.inReplyTo}`);
  }
  if (options.references) {
    mimeLines.push(`References: ${options.references}`);
  } else if (options.inReplyTo) {
    mimeLines.push(`References: ${options.inReplyTo}`);
  }

  mimeLines.push(`Content-Type: text/html; charset=UTF-8`);
  mimeLines.push(`Content-Transfer-Encoding: 7bit`);
  mimeLines.push(``);
  mimeLines.push(options.bodyHtml);

  const rawMime = mimeLines.join("\r\n");
  const encodedRaw = base64UrlEncode(rawMime);

  const url = `${GMAIL_API_BASE}/messages/send`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodedRaw,
      threadId: options.threadId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send Gmail reply (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Modifies message labels in Gmail (e.g. mark as read or add custom status labels).
 */
export async function modifyGmailLabels(
  accessToken: string,
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<void> {
  const url = `${GMAIL_API_BASE}/messages/${messageId}/modify`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addLabelIds,
      removeLabelIds,
    }),
  });
}
