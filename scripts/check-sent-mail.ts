import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";
import { vaultDecrypt } from "../lib/crypto/vault";
import { ImapFlow } from "imapflow";

async function main() {
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

  const lock = await client.getMailboxLock("[Gmail]/Sent Mail");
  try {
    const sentUids = await client.search({ all: true }, { uid: true });
    console.log("Total messages in Sent Mail:", (sentUids as number[]).length);
    const recentSent = (sentUids as number[]).slice(-5);
    for (const uid of recentSent) {
      const msg = await client.fetchOne(String(uid), { uid: true, envelope: true, internalDate: true }, { uid: true });
      if (msg && typeof msg === "object") {
        const d = msg.internalDate instanceof Date ? msg.internalDate.toISOString() : String(msg.internalDate ?? "");
        console.log(`[SENT] UID ${msg.uid} | Date: ${d} | Subject: "${msg.envelope?.subject}" | To: "${msg.envelope?.to?.[0]?.address}"`);
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch(console.error);
