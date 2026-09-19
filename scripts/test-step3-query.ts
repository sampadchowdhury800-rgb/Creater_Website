import * as dotenv from "dotenv";
dotenv.config();

import { getSupabaseServerClient } from "../lib/supabase/server";

async function main() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("No supabase client");
    return;
  }

  console.log("Running Step 3 query from app/api/internal/gateway/gmail/poll/route.ts...");
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

  const { data, error } = await query;
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
