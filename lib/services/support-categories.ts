/**
 * lib/services/support-categories.ts
 *
 * Configurable support scope service.
 * Determines what types of customer emails the automation is allowed to handle,
 * whether auto-reply is permitted, and whether human escalation is required.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupportCategoryRecord, BusinessSupportCategoryRecord } from "@/lib/supabase/types";

export const SYSTEM_CATEGORIES: SupportCategoryRecord[] = [
  { id: "cat-1",  name: "Customer Support",      slug: "customer_support",      description: "General support inquiries and customer questions", is_system: true },
  { id: "cat-2",  name: "General Questions",     slug: "general_questions",     description: "General questions about the company or service", is_system: true },
  { id: "cat-3",  name: "Business Hours",        slug: "business_hours",        description: "Operating hours, holiday schedules, working times", is_system: true },
  { id: "cat-4",  name: "Product Questions",     slug: "product_questions",     description: "Inquiries about products, features, specifications", is_system: true },
  { id: "cat-5",  name: "Service Questions",     slug: "service_questions",     description: "Questions regarding offered services and scopes", is_system: true },
  { id: "cat-6",  name: "Pricing Questions",     slug: "pricing_questions",     description: "Pricing rates, tiers, quotes, and fee structures", is_system: true },
  { id: "cat-7",  name: "Order Questions",       slug: "order_questions",       description: "Existing orders, order placement, order numbers", is_system: true },
  { id: "cat-8",  name: "Shipping Questions",    slug: "shipping_questions",    description: "Shipping methods, shipping rates, carrier options", is_system: true },
  { id: "cat-9",  name: "Delivery Questions",    slug: "delivery_questions",    description: "Tracking numbers, delivery dates, transit status", is_system: true },
  { id: "cat-10", name: "Returns",               slug: "returns",               description: "Return requests, return labels, return eligibility", is_system: true },
  { id: "cat-11", name: "Refunds",               slug: "refunds",               description: "Refund requests, money-back guarantees, chargebacks", is_system: true },
  { id: "cat-12", name: "Cancellations",         slug: "cancellations",         description: "Order or service cancellation requests", is_system: true },
  { id: "cat-13", name: "Warranty",              slug: "warranty",              description: "Warranty claims, coverage periods, repair policies", is_system: true },
  { id: "cat-14", name: "Complaints",            slug: "complaints",            description: "Customer dissatisfaction, escalation, complaints", is_system: true },
  { id: "cat-15", name: "Product Availability",  slug: "product_availability",  description: "Stock levels, replenishment dates, backorders", is_system: true },
  { id: "cat-16", name: "Appointment Questions", slug: "appointment_questions", description: "Appointments, consultation schedules, calendar slots", is_system: true },
  { id: "cat-17", name: "Booking Questions",     slug: "booking_questions",     description: "Reservations, booking confirmations, changes", is_system: true },
  { id: "cat-18", name: "Account Questions",     slug: "account_questions",     description: "User login, password resets, profile settings", is_system: true },
  { id: "cat-19", name: "Other Questions",       slug: "other",                 description: "Miscellaneous or unclassified inquiries", is_system: true },
];

export async function getSupportCategories(): Promise<SupportCategoryRecord[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return SYSTEM_CATEGORIES;

  try {
    const { data, error } = await supabase
      .from("support_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return SYSTEM_CATEGORIES;
    }

    return data as SupportCategoryRecord[];
  } catch {
    return SYSTEM_CATEGORIES;
  }
}

export async function getBusinessSupportCategories(
  businessId: string
): Promise<BusinessSupportCategoryRecord[]> {
  const supabase = getSupabaseServerClient();
  const allCategories = await getSupportCategories();

  if (!supabase || !businessId) {
    return allCategories.map((cat) => ({
      business_id: businessId,
      category_slug: cat.slug,
      enabled: true,
      requires_human_review: cat.slug === "complaints" || cat.slug === "refunds",
      auto_reply: true,
      category: cat,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("business_support_categories")
      .select("*")
      .eq("business_id", businessId);

    if (error || !data) {
      return allCategories.map((cat) => ({
        business_id: businessId,
        category_slug: cat.slug,
        enabled: true,
        requires_human_review: cat.slug === "complaints" || cat.slug === "refunds",
        auto_reply: true,
        category: cat,
      }));
    }

    // Merge configured rows with all system categories so every category is represented
    return allCategories.map((cat) => {
      const existing = data.find((d: any) => d.category_slug === cat.slug);
      if (existing) {
        return {
          ...existing,
          category: cat,
        };
      }
      return {
        business_id: businessId,
        category_slug: cat.slug,
        enabled: true,
        requires_human_review: cat.slug === "complaints" || cat.slug === "refunds",
        auto_reply: true,
        category: cat,
      };
    });
  } catch {
    return allCategories.map((cat) => ({
      business_id: businessId,
      category_slug: cat.slug,
      enabled: true,
      requires_human_review: cat.slug === "complaints" || cat.slug === "refunds",
      auto_reply: true,
      category: cat,
    }));
  }
}

export async function updateBusinessSupportCategory(
  businessId: string,
  categorySlug: string,
  config: { enabled?: boolean; requires_human_review?: boolean; auto_reply?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) {
    return { success: false, error: "Database client unavailable or invalid business ID" };
  }

  const payload: Record<string, any> = {
    business_id: businessId,
    category_slug: categorySlug,
    updated_at: new Date().toISOString(),
    ...config,
  };

  try {
    const { error } = await supabase
      .from("business_support_categories")
      .upsert(payload, { onConflict: "business_id,category_slug" });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update category" };
  }
}

/**
 * Checks whether an incoming email of a given category should be automatically answered.
 */
export async function shouldHandleEmailCategory(
  businessId: string,
  categorySlug: string
): Promise<{
  enabled: boolean;
  requiresHumanReview: boolean;
  autoReply: boolean;
  reason: string;
}> {
  const categories = await getBusinessSupportCategories(businessId);
  const normalizedSlug = categorySlug.toLowerCase().trim().replace(/[\s-]+/g, "_");

  const match =
    categories.find((c) => c.category_slug === normalizedSlug) ||
    categories.find((c) => c.category_slug === "customer_support");

  if (!match) {
    return {
      enabled: true,
      requiresHumanReview: false,
      autoReply: true,
      reason: `Default handling for category '${categorySlug}'`,
    };
  }

  if (!match.enabled) {
    return {
      enabled: false,
      requiresHumanReview: match.requires_human_review,
      autoReply: false,
      reason: `Support category '${match.category_slug}' is disabled for this business.`,
    };
  }

  return {
    enabled: true,
    requiresHumanReview: match.requires_human_review,
    autoReply: match.auto_reply,
    reason: `Support category '${match.category_slug}' is enabled (autoReply=${match.auto_reply}, humanReview=${match.requires_human_review}).`,
  };
}
