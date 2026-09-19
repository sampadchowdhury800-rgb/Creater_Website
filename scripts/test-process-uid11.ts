import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";
import { vaultDecrypt } from "../lib/crypto/vault";
import { fetchImapMessage } from "../lib/integrations/providers/imap";
import {
  classifyEmailIntent,
  retrieveBusinessKnowledge,
  generateGroundedReply,
} from "../lib/ai/support-engine";
import { sendSmtpReply } from "../lib/integrations/providers/smtp";

async function main() {
  console.log("=== SIMULATING PIPELINE FOR TEST EMAIL (UID 11) ===");

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("No supabase client");
    return;
  }

  // 1. Get Account
  const { data: accounts } = await supabase
    .from("gmail_accounts")
    .select(`
      id,
      business_id,
      email,
      app_password_enc,
      app_password_iv,
      app_password_tag,
      vault_version,
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
          confidence_threshold
        )
      )
    `)
    .eq("email", "vivecode999@gmail.com")
    .single();

  if (!accounts) {
    console.error("Account not found");
    return;
  }

  const business = Array.isArray(accounts.business) ? accounts.business[0] : accounts.business;
  const rules = business?.rules ? (Array.isArray(business.rules) ? business.rules[0] : business.rules) : null;
  console.log("Business rules:", JSON.stringify(rules, null, 2));

  // Decrypt App Password
  const appPassword = vaultDecrypt({
    version: accounts.vault_version || 1,
    iv: accounts.app_password_iv,
    authTag: accounts.app_password_tag,
    encryptedValue: accounts.app_password_enc,
  });

  const creds = { email: accounts.email, appPassword };

  // Fetch UID 11
  console.log("\n1. Fetching message UID 11...");
  const fetchRes = await fetchImapMessage(creds, "11", "full");
  console.log("Fetch success:", fetchRes.success);
  if (!fetchRes.success || !fetchRes.message) {
    console.error("Failed to fetch message:", fetchRes.errorMessage);
    return;
  }

  const msg = fetchRes.message;
  console.log("Message fetched:");
  console.log(`- From: ${msg.from}`);
  console.log(`- Subject: ${msg.subject}`);
  console.log(`- Body Text: "${msg.bodyText}"`);
  console.log(`- Date: ${msg.date}`);

  const parsedEmail = {
    id: msg.id,
    threadId: msg.threadId || msg.id,
    sender: msg.from || "unknown",
    recipient: accounts.email,
    subject: msg.subject || "",
    bodyText: msg.bodyText || "",
    bodyHtml: msg.bodyHtml || "",
    date: msg.date,
  };

  // 2. Classify Intent
  console.log("\n2. Classifying Intent with Gmail Support AI...");
  try {
    const classification = await classifyEmailIntent(parsedEmail, rules);
    console.log("Classification result:", JSON.stringify(classification, null, 2));

    if (classification.classification !== "CUSTOMER_SUPPORT") {
      console.log(`STOPPED: Email was classified as ${classification.classification}, NOT CUSTOMER_SUPPORT!`);
      return;
    }

    // 3. Retrieve Knowledge
    console.log("\n3. Retrieving business knowledge...");
    const knowledgeDocs = await retrieveBusinessKnowledge(parsedEmail, accounts.business_id, supabase);
    console.log(`Knowledge docs found: ${knowledgeDocs.length}`);

    // 4. Generate Grounded Reply
    console.log("\n4. Generating Grounded Reply...");
    const generated = await generateGroundedReply(parsedEmail, rules, knowledgeDocs);
    console.log("Generated Reply:", JSON.stringify(generated, null, 2));

    const threshold = rules?.confidence_threshold ?? 0.75;
    const shouldSend = rules?.auto_reply_enabled !== false && generated.confidence >= threshold;
    console.log(`Should Send: ${shouldSend} (confidence: ${generated.confidence}, threshold: ${threshold})`);

  } catch (err: any) {
    console.error("AI Pipeline FAILED with error:", err.message);
    console.error(err.stack);
  }
}

main().catch(console.error);
