/**
 * lib/integrations/providers/imap.ts
 *
 * IMAP provider module for connecting to Gmail via IMAP (imap.gmail.com:993).
 * Uses customer's Gmail address and 16-character App Password.
 *
 * SECURITY INVARIANTS:
 * - The App Password MUST NEVER be logged, included in error messages, or returned to clients/n8n.
 * - Connections are short-lived (connect -> operate -> logout) for serverless safety.
 * - Uses Gmail IMAP extensions (X-GM-EXT-1) for emailId (X-GM-MSGID) and threadId (X-GM-THRID).
 */

import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";

export interface GmailImapCredentials {
  email: string;
  appPassword: string;
}

export interface ImapMessageSummary {
  id: string;        // X-GM-MSGID or numeric UID
  threadId?: string; // X-GM-THRID
  uid: number;
  date: Date;
}

export interface ImapMessageDetails {
  id: string;
  threadId?: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
  internalDate?: number;
  bodyText?: string;
  bodyHtml?: string;
}

export interface ImapListResult {
  success: boolean;
  messages?: ImapMessageSummary[];
  errorCode?: string;
  errorMessage?: string;
}

export interface ImapFetchResult {
  success: boolean;
  message?: ImapMessageDetails;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Creates a configured ImapFlow client with logging disabled to ensure
 * credentials and sensitive payloads are never written to standard logs.
 */
function createImapClient(creds: GmailImapCredentials): ImapFlow {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: creds.email,
      pass: creds.appPassword,
    },
    logger: false, // Prevents any accidental credential logging by imapflow
  });
}

/**
 * Classifies an IMAP error safely without exposing credentials or internal secrets.
 */
function classifyImapError(err: any): { errorCode: string; errorMessage: string } {
  const msg = (err?.message || "").toLowerCase();
  const responseCode = (err?.responseCode || "").toLowerCase();

  if (
    responseCode.includes("authenticationfailed") ||
    msg.includes("authenticationfailed") ||
    msg.includes("invalid credentials") ||
    msg.includes("username and password not accepted")
  ) {
    return {
      errorCode: "CONNECTION_EXPIRED",
      errorMessage: "Gmail IMAP authentication failed. Please verify your Gmail address and App Password.",
    };
  }

  if (msg.includes("timed out") || msg.includes("timeout") || msg.includes("etimedout")) {
    return {
      errorCode: "UPSTREAM_TIMEOUT",
      errorMessage: "Connection to Gmail IMAP server timed out.",
    };
  }

  return {
    errorCode: "IMAP_ERROR",
    errorMessage: "Gmail IMAP operation failed. Please try again later.",
  };
}

/**
 * Tests whether the given Gmail address and App Password can successfully authenticate.
 */
export async function testImapConnection(
  creds: GmailImapCredentials
): Promise<{ success: boolean; error?: string }> {
  const client = createImapClient(creds);

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out")), 10000)
      ),
    ]);

    await client.logout().catch(() => {});
    return { success: true };
  } catch (err: any) {
    await client.logout().catch(() => {});
    const classified = classifyImapError(err);
    return {
      success: false,
      error: classified.errorMessage,
    };
  }
}

/**
 * Lists unread messages in INBOX received after the baseline timestamp.
 * Returns message summaries containing X-GM-MSGID and X-GM-THRID when available.
 */
export async function listUnreadImapMessages(
  creds: GmailImapCredentials,
  options: { since?: Date; maxResults?: number } = {}
): Promise<ImapListResult> {
  const client = createImapClient(creds);
  const maxResults = Math.min(Math.max(1, options.maxResults || 10), 50);

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out")), 10000)
      ),
    ]);

    const lock = await client.getMailboxLock("INBOX");
    const summaries: ImapMessageSummary[] = [];

    try {
      // Build search query: unread messages, optionally since date
      const searchQuery: any = { seen: false };
      if (options.since) {
        searchQuery.since = options.since;
      }

      const searchResults = await client.search(searchQuery, { uid: true });
      const unseenUids = Array.isArray(searchResults) ? searchResults : [];

      // Also fetch recent mailbox messages so emails marked seen by email clients are not missed
      const recentSearch = await client.search({ all: true }, { uid: true });
      const allUids = Array.isArray(recentSearch) ? recentSearch : [];
      const recentWindowUids = allUids.slice(-maxResults);

      const targetUidsSet = new Set<number>([...unseenUids, ...recentWindowUids]);
      const targetUids = Array.from(targetUidsSet).slice(-maxResults);
      if (targetUids.length > 0) {
        for (const uid of targetUids) {
          const fetchRes = await client.fetchOne(
            String(uid),
            { uid: true, envelope: true, internalDate: true, threadId: true },
            { uid: true }
          );

          if (fetchRes && typeof fetchRes === "object") {
            const rawId = (fetchRes as any).emailId || String(fetchRes.uid);
            const rawThreadId = (fetchRes as any).threadId || rawId;
            const receivedDate =
              fetchRes.internalDate instanceof Date
                ? fetchRes.internalDate
                : fetchRes.envelope?.date instanceof Date
                ? fetchRes.envelope.date
                : options.since || new Date();

            summaries.push({
              id: rawId,
              threadId: rawThreadId,
              uid: fetchRes.uid,
              date: receivedDate,
            });
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout().catch(() => {});
    return {
      success: true,
      messages: summaries,
    };
  } catch (err: any) {
    await client.logout().catch(() => {});
    const classified = classifyImapError(err);
    console.warn("[IMAP Provider] listUnreadImapMessages failed", {
      errorCode: classified.errorCode,
    });
    return {
      success: false,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
    };
  }
}

/**
 * Fetches full or metadata details for a message by its Gmail Message ID (or IMAP UID).
 */
export async function fetchImapMessage(
  creds: GmailImapCredentials,
  messageId: string,
  format: "full" | "metadata" = "metadata"
): Promise<ImapFetchResult> {
  const client = createImapClient(creds);

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out")), 10000)
      ),
    ]);

    const lock = await client.getMailboxLock("INBOX");
    let targetUid: number | null = null;

    try {
      // 1. Try finding message by Gmail extension X-GM-MSGID
      try {
        const msgIdSearch = await client.search(
          { emailId: messageId } as any,
          { uid: true }
        );
        if (Array.isArray(msgIdSearch) && msgIdSearch.length > 0) {
          targetUid = msgIdSearch[0];
        }
      } catch {
        // Server might not support X-GM-MSGID search syntax directly
      }

      // 2. If not found and messageId is numeric, try searching by UID
      if (!targetUid && /^\d+$/.test(messageId)) {
        const uidNum = parseInt(messageId, 10);
        try {
          const uidSearch = await client.search({ uid: String(uidNum) } as any, { uid: true });
          if (Array.isArray(uidSearch) && uidSearch.includes(uidNum)) {
            targetUid = uidNum;
          }
        } catch {
          // Ignore search error
        }
      }

      // 3. Fallback: Search all unread or recent messages in INBOX to match emailId
      if (!targetUid) {
        const recentSearch = await client.search({ all: true }, { uid: true });
        if (Array.isArray(recentSearch) && recentSearch.length > 0) {
          // Check last 50 messages
          const candidateUids = recentSearch.slice(-50);
          for (const candUid of candidateUids.reverse()) {
            const peek = await client.fetchOne(
              String(candUid),
              { uid: true, threadId: true },
              { uid: true }
            );
            if (peek && ((peek as any).emailId === messageId || String(peek.uid) === messageId)) {
              targetUid = candUid;
              break;
            }
          }
        }
      }

      if (!targetUid) {
        return {
          success: false,
          errorCode: "NOT_FOUND",
          errorMessage: "Email message not found in mailbox.",
        };
      }

      const fetchQuery: any = {
        uid: true,
        envelope: true,
        internalDate: true,
        threadId: true,
      };

      if (format === "full") {
        fetchQuery.source = true;
      }

      const rawMsg = await client.fetchOne(String(targetUid), fetchQuery, { uid: true });
      if (!rawMsg) {
        return {
          success: false,
          errorCode: "NOT_FOUND",
          errorMessage: "Email message data could not be retrieved.",
        };
      }

      const finalId = (rawMsg as any).emailId || String(rawMsg.uid);
      const finalThreadId = (rawMsg as any).threadId || finalId;
      const internalDateNum =
        rawMsg.internalDate instanceof Date
          ? rawMsg.internalDate.getTime()
          : undefined;

      let subject = rawMsg.envelope?.subject || "";
      let from = rawMsg.envelope?.from?.[0]?.address || "";
      let date =
        rawMsg.envelope?.date instanceof Date
          ? rawMsg.envelope.date.toISOString()
          : typeof rawMsg.envelope?.date === "string"
          ? rawMsg.envelope.date
          : undefined;
      let bodyText = "";
      let bodyHtml = "";
      let snippet = "";

      if (format === "full" && rawMsg.source) {
        try {
          const parsed: ParsedMail = await simpleParser(rawMsg.source);
          if (parsed.subject) subject = parsed.subject;
          if (parsed.from?.text) from = parsed.from.text;
          else if (parsed.from?.value?.[0]?.address) from = parsed.from.value[0].address;

          if (parsed.date) {
            date = parsed.date instanceof Date ? parsed.date.toISOString() : String(parsed.date);
          }
          bodyText = parsed.text || "";
          bodyHtml = typeof parsed.html === "string" ? parsed.html : "";

          const cleanSnippet = (bodyText || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200);
          snippet = cleanSnippet;
        } catch (parseErr: any) {
          console.warn("[IMAP Provider] Failed to parse RFC822 message source", {
            error: parseErr?.message,
          });
        }
      }

      return {
        success: true,
        message: {
          id: finalId,
          threadId: finalThreadId,
          subject,
          from,
          date,
          internalDate: internalDateNum,
          bodyText,
          bodyHtml,
          snippet,
        },
      };
    } finally {
      lock.release();
    }
  } catch (err: any) {
    await client.logout().catch(() => {});
    const classified = classifyImapError(err);
    console.warn("[IMAP Provider] fetchImapMessage failed", {
      errorCode: classified.errorCode,
    });
    return {
      success: false,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Marks an IMAP message as seen / read in the INBOX.
 */
export async function markImapMessageSeen(
  creds: GmailImapCredentials,
  uidOrEmailId: string | number
): Promise<boolean> {
  const client = createImapClient(creds);
  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out")), 10000)
      ),
    ]);

    const lock = await client.getMailboxLock("INBOX");
    try {
      let targetUid: number | null = typeof uidOrEmailId === "number" ? uidOrEmailId : null;
      if (!targetUid && /^\d+$/.test(String(uidOrEmailId))) {
        targetUid = parseInt(String(uidOrEmailId), 10);
      }

      if (!targetUid) {
        try {
          const search = await client.search({ emailId: String(uidOrEmailId) } as any, { uid: true });
          if (Array.isArray(search) && search.length > 0) {
            targetUid = search[0];
          }
        } catch {}
      }

      if (targetUid) {
        await client.messageFlagsAdd(String(targetUid), ["\\Seen"], { uid: true });
        return true;
      }
      return false;
    } finally {
      lock.release();
    }
  } catch (err) {
    console.warn("[IMAP Provider] markImapMessageSeen failed (non-fatal):", err);
    return false;
  } finally {
    await client.logout().catch(() => {});
  }
}

