/**
 * lib/services/business-rules.ts
 *
 * Multi-tenant business rules and policies service.
 * Manages refund/return/cancellation/shipping/warranty/order policies,
 * brand voice, unknown question behaviors, after-hours behaviors, and safety guardrails.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessRulesRecord } from "@/lib/supabase/types";

export interface ExtendedBusinessRulesInput {
  company_description?: string | null;
  products_services?: string | null;
  support_policies?: string | null;
  refund_return_rules?: string | null;
  tone?: string;
  prohibited_responses?: string | null;
  escalation_rules?: string | null;
  contact_info?: string | null;
  working_hours?: string | null;
  custom_instructions?: string | null;
  auto_reply_enabled?: boolean;
  confidence_threshold?: number;
  slack_webhook_url?: string | null;
  slack_channel_id?: string | null;
  // Specific policies
  refund_policy?: string | null;
  cancellation_policy?: string | null;
  return_policy?: string | null;
  warranty_policy?: string | null;
  shipping_policy?: string | null;
  order_policy?: string | null;
  payment_policy?: string | null;
  product_service_info?: string | null;
  // Brand voice & instructions
  greeting_preference?: string | null;
  sign_off_preference?: string | null;
  mention_business_name?: boolean;
  mention_support_team?: boolean;
  custom_writing_instructions?: string | null;
  // Unknown & after-hours behaviors
  unknown_question_behavior?: "NO_REPLY" | "FALLBACK_RESPONSE" | "NOTIFY_TEAM" | "HUMAN_REVIEW";
  fallback_message?: string | null;
  after_hours_behavior?: "REPLY_NORMALLY" | "AFTER_HOURS_MESSAGE" | "DO_NOT_REPLY" | "ESCALATE";
  respond_outside_hours?: boolean;
  after_hours_message?: string | null;
  // Safety & escalation
  max_reply_length?: number;
  complaints_require_human?: boolean;
  refunds_require_human?: boolean;
}

export async function getBusinessRules(businessId: string): Promise<BusinessRulesRecord | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) return null;

  try {
    const { data, error } = await supabase
      .from("business_rules")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      console.warn("[BusinessRules] Error fetching full rules:", error.message);
      // Fallback query for core baseline columns
      const { data: fallbackData } = await supabase
        .from("business_rules")
        .select(`
          id, business_id, company_description, products_services, support_policies,
          refund_return_rules, tone, prohibited_responses, escalation_rules,
          contact_info, working_hours, custom_instructions, auto_reply_enabled,
          confidence_threshold, slack_webhook_url, slack_channel_id
        `)
        .eq("business_id", businessId)
        .maybeSingle();

      return fallbackData || null;
    }

    return (data as BusinessRulesRecord) || null;
  } catch (err: any) {
    console.error("[BusinessRules] getBusinessRules error:", err?.message);
    return null;
  }
}

export async function updateBusinessRules(
  businessId: string,
  input: ExtendedBusinessRulesInput
): Promise<{ success: boolean; data?: BusinessRulesRecord; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) {
    return { success: false, error: "Database client unavailable or invalid business ID" };
  }

  const payload: Record<string, any> = {
    business_id: businessId,
    updated_at: new Date().toISOString(),
    ...input,
  };

  try {
    const { data, error } = await supabase
      .from("business_rules")
      .upsert(payload, { onConflict: "business_id" })
      .select("*")
      .single();

    if (error) {
      // If error is 42703 (undefined column in schema), strip extended columns and upsert base fields
      if (error.code === "42703") {
        const basePayload: Record<string, any> = {
          business_id: businessId,
          updated_at: new Date().toISOString(),
        };
        const baseKeys = [
          "company_description",
          "products_services",
          "support_policies",
          "refund_return_rules",
          "tone",
          "prohibited_responses",
          "escalation_rules",
          "contact_info",
          "working_hours",
          "custom_instructions",
          "auto_reply_enabled",
          "confidence_threshold",
          "slack_webhook_url",
          "slack_channel_id",
        ];
        for (const key of baseKeys) {
          if (key in input) {
            basePayload[key] = (input as any)[key];
          }
        }

        const { data: baseData, error: baseErr } = await supabase
          .from("business_rules")
          .upsert(basePayload, { onConflict: "business_id" })
          .select("*")
          .single();

        if (baseErr) return { success: false, error: baseErr.message };
        return {
          success: true,
          data: {
            ...baseData,
            ...input,
          } as BusinessRulesRecord,
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BusinessRulesRecord };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update business rules" };
  }
}
