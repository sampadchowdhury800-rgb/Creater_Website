/**
 * lib/supabase/client.ts
 *
 * Browser-safe Supabase client using public URL and Anon Key.
 * NEVER exposes service role key to the browser.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function getBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase browser credentials not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}
