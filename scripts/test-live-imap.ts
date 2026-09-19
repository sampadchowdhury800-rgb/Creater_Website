import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";
import { vaultDecrypt } from "../lib/crypto/vault";
import { listUnreadImapMessages, fetchImapMessage } from "../lib/integrations/providers/imap";

async function main() {
  console.log("=== TESTING LIVE IMAP FOR CONNECTED ACCOUNT ===");
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("Supabase client not available");
    return;
  }

  const { data: accounts, error: accErr } = await supabase
    .from("gmail_accounts")
    .select("id, business_id, email, app_password_enc, app_password_iv, app_password_tag, vault_version, status")
    .eq("status", "CONNECTED");

  if (accErr || !accounts || accounts.length === 0) {
    console.error("No connected accounts found:", accErr);
    return;
  }

  const account = accounts[0];
  console.log(`Checking account: ${account.email} (id: ${account.id})`);

  let appPassword = "";
  try {
    appPassword = vaultDecrypt({
      version: account.vault_version || 1,
      iv: account.app_password_iv,
      authTag: account.app_password_tag,
      encryptedValue: account.app_password_enc,
    });
    console.log("Vault decryption: SUCCESS (app password recovered safely without logging)");
  } catch (err: any) {
    console.error("Vault decryption FAILED:", err.message);
    return;
  }

  const creds = { email: account.email, appPassword };

  console.log("Calling listUnreadImapMessages({ maxResults: 10 })...");
  const listResult = await listUnreadImapMessages(creds, { maxResults: 10 });
  console.log("listUnreadImapMessages result success:", listResult.success);
  if (!listResult.success) {
    console.error("listUnreadImapMessages failed:", listResult.errorCode, listResult.errorMessage);
    return;
  }

  console.log(`Found ${listResult.messages?.length ?? 0} unread messages:`);
  for (const m of listResult.messages || []) {
    console.log(`- ID: ${m.id}, UID: ${m.uid}, Date: ${m.date}`);
    const details = await fetchImapMessage(creds, m.id, "metadata");
    if (details.success && details.message) {
      console.log(`  Subject: "${details.message.subject}", From: "${details.message.from}", Date: "${details.message.date}"`);
    } else {
      console.log(`  Failed to fetch details: ${details.errorMessage}`);
    }
  }

  console.log("=== IMAP CHECK COMPLETE ===");
}

main().catch((err) => {
  console.error("Test IMAP error:", err);
  process.exit(1);
});
