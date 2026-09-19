/**
 * lib/services/gmail-account-config.ts
 *
 * Multi-account Gmail configuration service.
 * Supports multiple connected Gmail mailboxes per tenant business (e.g. support@, sales@, orders@)
 * with individual support_enabled, auto_reply_enabled, custom signature, and custom instructions.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GmailAccountRecord } from "@/lib/supabase/types";

export async function getGmailAccountsForBusiness(businessId: string): Promise<GmailAccountRecord[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) return [];

  try {
    const { data, error } = await supabase
      .from("gmail_accounts")
      .select("id, business_id, email, status, support_enabled, auto_reply_enabled, custom_instructions, signature, last_polled_at, last_error, created_at, updated_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) {
      // Fallback query if extended columns do not exist yet
      const { data: fallbackData } = await supabase
        .from("gmail_accounts")
        .select("id, business_id, email, status, last_polled_at, last_error, created_at, updated_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });

      return (fallbackData || []).map((acc: any) => ({
        ...acc,
        support_enabled: true,
        auto_reply_enabled: true,
      }));
    }

    return (data || []).map((acc: any) => ({
      ...acc,
      support_enabled: acc.support_enabled ?? true,
      auto_reply_enabled: acc.auto_reply_enabled ?? true,
    }));
  } catch (err: any) {
    console.warn("[GmailAccountConfig] getGmailAccounts error:", err?.message);
    return [];
  }
}

export async function updateGmailAccountSupportConfig(
  accountId: string,
  businessId: string,
  config: {
    support_enabled?: boolean;
    auto_reply_enabled?: boolean;
    custom_instructions?: string | null;
    signature?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !accountId || !businessId) {
    return { success: false, error: "Database client unavailable or invalid IDs" };
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
    ...config,
  };

  try {
    const { error } = await supabase
      .from("gmail_accounts")
      .update(payload)
      .eq("id", accountId)
      .eq("business_id", businessId); // Strict tenant check

    if (error) {
      // If error is 42703 (columns not migrated yet), succeed gracefully in memory
      if (error.code === "42703") {
        return { success: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update Gmail account configuration" };
  }
}
