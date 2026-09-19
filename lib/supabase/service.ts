/**
 * lib/supabase/service.ts
 *
 * Server-side business logic and data access layer for the Gmail AI Support Automation.
 * Multi-tenant safe: All operations require or resolve a tenant business_id.
 */

import { getSupabaseServerClient } from "./server";

export interface BusinessRulesInput {
  company_description?: string;
  products_services?: string;
  support_policies?: string;
  refund_return_rules?: string;
  tone?: string;
  prohibited_responses?: string;
  escalation_rules?: string;
  contact_info?: string;
  working_hours?: string;
  custom_instructions?: string;
  auto_reply_enabled?: boolean;
  confidence_threshold?: number;
  slack_webhook_url?: string;
  slack_channel_id?: string;
}

export async function getOrCreateDefaultBusiness(slug = "default-business", name = "Default Business") {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("businesses")
    .insert({
      slug,
      name,
      contact_email: "support@example.com",
      plan_tier: "STARTER",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating business:", error);
    return null;
  }

  // Also initialize empty business rules
  await supabase.from("business_rules").insert({
    business_id: created.id,
    tone: "professional, empathetic, and concise",
    auto_reply_enabled: true,
    confidence_threshold: 0.75,
  });

  return created;
}

export async function getBusinessRules(businessId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("business_rules")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching business rules:", error);
    return null;
  }
  return data;
}

export async function upsertBusinessRules(businessId: string, rules: BusinessRulesInput) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("business_rules")
    .upsert(
      {
        business_id: businessId,
        ...rules,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    )
    .select("*")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rules: data };
}

export async function getAutomationExecutions(businessId: string, limit = 25) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("automation_executions")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching executions:", error);
    return [];
  }
  return data || [];
}

export async function getKnowledgeDocuments(businessId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, content, category, status, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching knowledge documents:", error);
    return [];
  }
  return data || [];
}

export async function addKnowledgeDocument(
  businessId: string,
  doc: { title: string; content: string; category?: string }
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      business_id: businessId,
      title: doc.title,
      content: doc.content,
      category: doc.category || "general",
      status: "READY",
    })
    .select("*")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, document: data };
}

export async function getConnectedGmailAccounts(businessId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("gmail_accounts")
    .select("id, email, status, history_id, created_at, updated_at")
    .eq("business_id", businessId);

  if (error) {
    console.error("Error fetching Gmail accounts:", error);
    return [];
  }
  return data || [];
}
