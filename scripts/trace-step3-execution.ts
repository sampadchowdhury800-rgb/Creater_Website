import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";
import { prisma } from "../lib/prisma";
import { vaultDecrypt } from "../lib/crypto/vault";
import { listUnreadImapMessages, fetchImapMessage, markImapMessageSeen } from "../lib/integrations/providers/imap";
import { classifyEmailIntent, retrieveBusinessKnowledge, generateGroundedReply, sendSlackNotification } from "../lib/ai/support-engine";
import { sendSmtpReply } from "../lib/integrations/providers/smtp";

async function main() {
  console.log("=== TRACING STEP 3 EXECUTION ===");
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("No supabase client");
    return;
  }

  const query = supabase
    .from("gmail_accounts")
    .select(`
      id,
      business_id,
      email,
      app_password_enc,
      app_password_iv,
      app_password_tag,
      vault_version,
      status,
      business:businesses (
        id,
        name,
        slug,
        rules:business_rules (
          tone,
          support_policies,
          refund_return_rules,
          prohibited_responses,
          working_hours,
          custom_instructions,
          auto_reply_enabled,
          confidence_threshold,
          slack_webhook_url,
          slack_channel_id
        )
      )
    `)
    .eq("status", "CONNECTED");

  const { data: accounts, error: accErr } = await query;
  if (accErr || !accounts || accounts.length === 0) {
    console.error("Accounts error:", accErr);
    return;
  }

  for (const account of accounts) {
    console.log(`Processing account: ${account.email} (id: ${account.id})`);
    const business = Array.isArray(account.business) ? account.business[0] : account.business;
    const rules = business?.rules ? (Array.isArray(business.rules) ? business.rules[0] : business.rules) : null;

    let appPassword = "";
    try {
      appPassword = vaultDecrypt({
        version: account.vault_version || 1,
        iv: account.app_password_iv,
        authTag: account.app_password_tag,
        encryptedValue: account.app_password_enc,
      });
      console.log("Vault decryption: SUCCESS");
    } catch (e: any) {
      console.error("Vault decryption FAILED:", e.message);
      continue;
    }

    const creds = { email: account.email, appPassword };

    console.log("Listing unread messages...");
    const listResult = await listUnreadImapMessages(creds, { maxResults: 10 });
    console.log("listResult success:", listResult.success, "count:", listResult.messages?.length);

    if (!listResult.success || !Array.isArray(listResult.messages)) {
      console.error("Failed to list messages:", listResult.errorMessage);
      continue;
    }

    for (const msg of listResult.messages) {
      console.log(`\nEvaluating message id: ${msg.id}, threadId: ${msg.threadId}, uid: ${msg.uid}, date: ${msg.date}`);
      const messageId = String(msg.id);
      const threadId = String(msg.threadId || msg.id);

      // Deduplication check
      const { data: existingExecution, error: exErr } = await supabase
        .from("automation_executions")
        .select("id, status")
        .eq("business_id", account.business_id)
        .eq("gmail_message_id", messageId)
        .maybeSingle();

      console.log(`Existing execution for msg ${messageId}:`, existingExecution, "error:", exErr);

      if (
        existingExecution &&
        (existingExecution.status === "COMPLETED" ||
          existingExecution.status === "PROCESSING" ||
          existingExecution.status === "SKIPPED")
      ) {
        console.log(`Skipping msg ${messageId} because existingExecution.status = ${existingExecution.status}`);
        continue;
      }

      console.log(`Would process message ${messageId}!`);
    }
  }
}

main().catch(console.error);
