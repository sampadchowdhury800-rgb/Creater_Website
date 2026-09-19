/**
 * lib/services/business-hours.ts
 *
 * Structured business hours and timezone calculation service.
 * Supports individual opening/closing hours per day of week (0=Sunday .. 6=Saturday)
 * and evaluates whether an incoming email arrived within or outside business hours.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessHoursRecord } from "@/lib/supabase/types";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function getDefaultBusinessHours(businessId: string, timezone = "UTC"): BusinessHoursRecord[] {
  return [
    { business_id: businessId, day_of_week: 0, open_time: "09:00", close_time: "18:00", is_closed: true, timezone },
    { business_id: businessId, day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false, timezone },
    { business_id: businessId, day_of_week: 2, open_time: "09:00", close_time: "18:00", is_closed: false, timezone },
    { business_id: businessId, day_of_week: 3, open_time: "09:00", close_time: "18:00", is_closed: false, timezone },
    { business_id: businessId, day_of_week: 4, open_time: "09:00", close_time: "18:00", is_closed: false, timezone },
    { business_id: businessId, day_of_week: 5, open_time: "09:00", close_time: "18:00", is_closed: false, timezone },
    { business_id: businessId, day_of_week: 6, open_time: "09:00", close_time: "18:00", is_closed: true, timezone },
  ];
}

export async function getBusinessHours(businessId: string): Promise<BusinessHoursRecord[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) return getDefaultBusinessHours(businessId);

  try {
    const { data, error } = await supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", businessId)
      .order("day_of_week", { ascending: true });

    if (error || !data || data.length === 0) {
      return getDefaultBusinessHours(businessId);
    }

    // Merge with defaults in case any days are missing
    const defaultHours = getDefaultBusinessHours(businessId);
    return defaultHours.map((def) => {
      const found = data.find((d: any) => d.day_of_week === def.day_of_week);
      return found || def;
    });
  } catch {
    return getDefaultBusinessHours(businessId);
  }
}

export async function updateBusinessHours(
  businessId: string,
  hours: Array<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean; timezone?: string }>
): Promise<{ success: boolean; data?: BusinessHoursRecord[]; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) {
    return { success: false, error: "Database client unavailable or invalid business ID" };
  }

  const rows = hours.map((h) => ({
    business_id: businessId,
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed,
    timezone: h.timezone || "UTC",
    updated_at: new Date().toISOString(),
  }));

  try {
    const { data, error } = await supabase
      .from("business_hours")
      .upsert(rows, { onConflict: "business_id,day_of_week" })
      .select("*")
      .order("day_of_week", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BusinessHoursRecord[] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update business hours" };
  }
}

/**
 * Evaluates whether a given date/time is within the configured business hours.
 * Uses Intl.DateTimeFormat to reliably resolve local day of week and hour/minute in the tenant timezone.
 */
export function isWithinBusinessHours(
  hours: BusinessHoursRecord[],
  timezone = "UTC",
  date: Date = new Date()
): { isWithin: boolean; reason: string; localTimeStr: string } {
  if (!hours || hours.length === 0) {
    return { isWithin: true, reason: "No business hours configured; default open", localTimeStr: date.toISOString() };
  }

  try {
    // Format date components into the tenant's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value || "";
    const hourPart = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minutePart = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const currentDayOfWeek = weekdayMap[weekdayPart] ?? date.getDay();
    const daySchedule = hours.find((h) => h.day_of_week === currentDayOfWeek);

    const currentTimeMinutes = hourPart * 60 + minutePart;
    const timeFormatted = `${String(hourPart).padStart(2, "0")}:${String(minutePart).padStart(2, "0")}`;

    if (!daySchedule) {
      return {
        isWithin: false,
        reason: `No schedule found for day ${currentDayOfWeek}`,
        localTimeStr: `${weekdayPart} ${timeFormatted} (${timezone})`,
      };
    }

    if (daySchedule.is_closed) {
      return {
        isWithin: false,
        reason: `Business is closed on ${DAY_NAMES[currentDayOfWeek]}`,
        localTimeStr: `${weekdayPart} ${timeFormatted} (${timezone})`,
      };
    }

    const [openH, openM] = daySchedule.open_time.split(":").map((v) => parseInt(v, 10));
    const [closeH, closeM] = daySchedule.close_time.split(":").map((v) => parseInt(v, 10));

    const openMinutes = (openH || 0) * 60 + (openM || 0);
    const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

    const isWithin = currentTimeMinutes >= openMinutes && currentTimeMinutes <= closeMinutes;

    return {
      isWithin,
      reason: isWithin
        ? `Open: ${daySchedule.open_time} - ${daySchedule.close_time}`
        : `Outside hours (Open ${daySchedule.open_time} - ${daySchedule.close_time})`,
      localTimeStr: `${weekdayPart} ${timeFormatted} (${timezone})`,
    };
  } catch (err: any) {
    console.warn("[BusinessHours] Timezone conversion failed, using fallback:", err?.message);
    return { isWithin: true, reason: "Timezone calculation fallback", localTimeStr: date.toISOString() };
  }
}
