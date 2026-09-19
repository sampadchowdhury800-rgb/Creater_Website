/**
 * supabase/functions/_shared/supabase-client.ts
 *
 * Provides initialized Supabase client for Edge Functions with service role access.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
