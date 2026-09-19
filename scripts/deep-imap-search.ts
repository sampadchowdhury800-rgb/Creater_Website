import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";
import { vaultDecrypt } from "../lib/crypto/vault";
import { ImapFlow } from "imapflow";

async function main() {
  console.log("=== DEEP SEARCH FOR 23:44 IST EMAIL ===");
  const supabase = getSupabaseServerClient();
  const { data: accounts } = await supabase!
    .from("gmail_accounts")
    .select("id, email, app_password_enc, app_password_iv, app_password_tag, vault_version")
    .eq("status", "CONNECTED");

  const account = accounts![0];
  const appPassword = vaultDecrypt({
    version: account.vault_version || 1,
    iv: account.app_password_iv,
    authTag: account.app_password_tag,
    encryptedValue: account.app_password_enc,
  });

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: account.email, pass: appPassword },
    logger: false,
  });

  await client.connect();

  // Check mailboxes
  const mailboxes = await client.list();
  console.log("Available Mailboxes:", mailboxes.map(m => m.path));

  // Check INBOX status
  const inboxStatus = await client.status("INBOX", { messages: true, unseen: true, uidNext: true });
  console.log("INBOX status:", inboxStatus);

  // Search INBOX for last 20 messages regardless of read/unread
  const lock = await client.getMailboxLock("INBOX");
  try {
    const allUidsRaw = await client.search({ all: true }, { uid: true });
    const allUids: number[] = Array.isArray(allUidsRaw) ? allUidsRaw : [];
    console.log("Total messages in INBOX:", allUids.length);
    const recentUids = allUids.slice(-15);
    console.log("Recent 15 UIDs in INBOX:", recentUids);

    for (const uid of recentUids) {
      const msg = await client.fetchOne(String(uid), {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
      }, { uid: true });
      if (msg && typeof msg === "object") {
        const d = msg.internalDate instanceof Date ? msg.internalDate.toISOString() : String(msg.internalDate ?? "");
        console.log(`UID ${msg.uid} | Flags: ${Array.from(msg.flags || []).join(",")} | Date: ${d} | Subject: "${msg.envelope?.subject}" | From: "${msg.envelope?.from?.[0]?.address}" | To: "${msg.envelope?.to?.[0]?.address}"`);
      }
    }
  } finally {
    lock.release();
  }

  // Also check Spam just in case!
  try {
    const spamPath = mailboxes.find(m => m.path.toLowerCase().includes("spam"))?.path;
    if (spamPath) {
      const spamLock = await client.getMailboxLock(spamPath);
      try {
        const spamUidsRaw = await client.search({ all: true }, { uid: true });
        const spamUids: number[] = Array.isArray(spamUidsRaw) ? spamUidsRaw : [];
        console.log(`Total messages in ${spamPath}:`, spamUids.length);
        const recentSpam = spamUids.slice(-5);
        for (const uid of recentSpam) {
          const msg = await client.fetchOne(String(uid), { uid: true, envelope: true, internalDate: true }, { uid: true });
          if (msg && typeof msg === "object") {
            const d = msg.internalDate instanceof Date ? msg.internalDate.toISOString() : String(msg.internalDate ?? "");
            console.log(`[SPAM] UID ${msg.uid} | Date: ${d} | Subject: "${msg.envelope?.subject}" | From: "${msg.envelope?.from?.[0]?.address}"`);
          }
        }
      } finally {
        spamLock.release();
      }
    }
  } catch (e: any) {
    console.log("Spam check error:", e.message);
  }

  await client.logout();
  console.log("=== DEEP SEARCH COMPLETE ===");
}

main().catch(console.error);
