/**
 * lib/supabase/server.ts
 *
 * Trusted Server-side Supabase Client.
 * Uses SUPABASE_SERVICE_ROLE_KEY to perform privileged operations across tenants.
 * SERVER-SIDE ONLY. Never import into client components.
 */

import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
