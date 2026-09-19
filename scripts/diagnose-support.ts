import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";

async function main() {
  console.log("=== DIAGNOSTIC REPORT START ===");
  console.log("Checking environment variables presence (no values revealed):");
  console.log("SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
  console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("CHOWDHURY_DUO_GATEWAY_SECRET exists:", !!process.env.CHOWDHURY_DUO_GATEWAY_SECRET);
  console.log("AUTOMATION_VAULT_KEY exists:", !!process.env.AUTOMATION_VAULT_KEY);
  console.log("GMAIL_SUPPORT_AI_API_KEY exists:", !!process.env.GMAIL_SUPPORT_AI_API_KEY);
  console.log("GMAIL_SUPPORT_AI_BASE_URL:", process.env.GMAIL_SUPPORT_AI_BASE_URL || "(default)");
  console.log("GMAIL_SUPPORT_AI_MODEL:", process.env.GMAIL_SUPPORT_AI_MODEL || "(default)");
  console.log("AI_SUPPORT_API_KEY exists:", !!process.env.AI_SUPPORT_API_KEY);
  console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
  console.log("NEXT_PUBLIC_SITE_URL:", process.env.NEXT_PUBLIC_SITE_URL || "(not set)");

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("CRITICAL: getSupabaseServerClient() returned null! SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
    return;
  }
  console.log("Supabase client initialized successfully.");

  // 1. Check businesses
  const { data: businesses, error: bizErr } = await supabase
    .from("businesses")
    .select("id, name, slug, contact_email, created_at");
  if (bizErr) console.error("businesses error:", bizErr);
  else console.log("Businesses:", JSON.stringify(businesses, null, 2));

  // 2. Check gmail_accounts
  const { data: accounts, error: accErr } = await supabase
    .from("gmail_accounts")
    .select("id, business_id, email, status, last_polled_at, last_error, error_message, created_at, updated_at");
  if (accErr) console.error("gmail_accounts error:", accErr);
  else console.log("Gmail Accounts:", JSON.stringify(accounts, null, 2));

  // 3. Check business_rules
  const { data: rules, error: rulesErr } = await supabase
    .from("business_rules")
    .select("id, business_id, company_description, tone, auto_reply_enabled, confidence_threshold, created_at");
  if (rulesErr) console.error("business_rules error:", rulesErr);
  else console.log("Business Rules:", JSON.stringify(rules, null, 2));

  // 4. Check customers
  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .select("id, business_id, email, name, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (custErr) console.error("customers error:", custErr);
  else console.log("Customers (recent 10):", JSON.stringify(customers, null, 2));

  // 5. Check conversations
  const { data: convos, error: convErr } = await supabase
    .from("conversations")
    .select("id, business_id, customer_id, gmail_thread_id, subject, status, category, confidence_score, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (convErr) console.error("conversations error:", convErr);
  else console.log("Conversations (recent 10):", JSON.stringify(convos, null, 2));

  // 6. Check messages
  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select("id, conversation_id, role, sender, recipient, subject, status, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (msgErr) console.error("messages error:", msgErr);
  else console.log("Messages (recent 10):", JSON.stringify(messages, null, 2));

  // 7. Check automation_executions
  const { data: executions, error: execErr } = await supabase
    .from("automation_executions")
    .select("id, business_id, gmail_account_id, gmail_message_id, trigger_type, status, error_message, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (execErr) console.error("automation_executions error:", execErr);
  else console.log("Recent Executions (recent 10):", JSON.stringify(executions, null, 2));

  // 8. Check knowledge_documents
  const { data: knowledge, error: kErr } = await supabase
    .from("knowledge_documents")
    .select("id, business_id, title, category, created_at")
    .limit(10);
  if (kErr) console.error("knowledge_documents error:", kErr);
  else console.log("Knowledge Docs count:", knowledge?.length ?? 0);

  // 9. Check pg_cron and pg_net if accessible via rpc or if available
  // Let's test if there is a query endpoint or rpc
  console.log("=== DIAGNOSTIC REPORT END ===");
}

main().catch((err) => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
