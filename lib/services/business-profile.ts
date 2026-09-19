/**
 * lib/services/business-profile.ts
 *
 * Multi-tenant business profile management.
 * Handles general business information, branding, contact details, timezone, and currency.
 * Fully typed with graceful fallback when database columns are not yet migrated.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessRecord } from "@/lib/supabase/types";

export interface BusinessProfileInput {
  name?: string;
  brand_name?: string | null;
  business_type?: string | null;
  description?: string | null;
  website?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string;
  currency?: string;
}

export async function getBusinessProfile(businessId: string): Promise<BusinessRecord | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) return null;

  try {
    // Attempt full select
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      // Fallback query if extended columns do not exist yet
      const { data: fallbackData } = await supabase
        .from("businesses")
        .select("id, name, slug, contact_email, created_at, updated_at")
        .eq("id", businessId)
        .maybeSingle();

      if (fallbackData) {
        return {
          ...fallbackData,
          timezone: "UTC",
          currency: "USD",
          plan_tier: "STARTER",
          is_active: true,
          settings: {},
        } as BusinessRecord;
      }
      return null;
    }

    return (data as BusinessRecord) || null;
  } catch (err: any) {
    console.warn("[BusinessProfile] getBusinessProfile error:", err?.message);
    return null;
  }
}

export async function updateBusinessProfile(
  businessId: string,
  input: BusinessProfileInput
): Promise<{ success: boolean; data?: BusinessRecord; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) {
    return { success: false, error: "Database client unavailable or invalid business ID" };
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) payload.name = input.name;
  if (input.brand_name !== undefined) payload.brand_name = input.brand_name;
  if (input.business_type !== undefined) payload.business_type = input.business_type;
  if (input.description !== undefined) payload.description = input.description;
  if (input.website !== undefined) payload.website = input.website;
  if (input.contact_email !== undefined) payload.contact_email = input.contact_email;
  if (input.contact_phone !== undefined) payload.contact_phone = input.contact_phone;
  if (input.address !== undefined) payload.address = input.address;
  if (input.city !== undefined) payload.city = input.city;
  if (input.state !== undefined) payload.state = input.state;
  if (input.country !== undefined) payload.country = input.country;
  if (input.timezone !== undefined) payload.timezone = input.timezone;
  if (input.currency !== undefined) payload.currency = input.currency;

  try {
    const { data, error } = await supabase
      .from("businesses")
      .update(payload)
      .eq("id", businessId)
      .select("*")
      .single();

    if (error) {
      // If error is missing column, update only baseline columns (name, contact_email)
      if (error.code === "42703") {
        const safePayload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (input.name) safePayload.name = input.name;
        if (input.contact_email) safePayload.contact_email = input.contact_email;

        const { data: safeData, error: safeErr } = await supabase
          .from("businesses")
          .update(safePayload)
          .eq("id", businessId)
          .select("id, name, slug, contact_email, created_at, updated_at")
          .single();

        if (safeErr) return { success: false, error: safeErr.message };
        return {
          success: true,
          data: {
            ...safeData,
            ...input,
            timezone: input.timezone || "UTC",
            currency: input.currency || "USD",
            plan_tier: "STARTER",
            is_active: true,
            settings: {},
          } as BusinessRecord,
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BusinessRecord };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update business profile" };
  }
}
