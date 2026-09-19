/**
 * supabase/functions/gmail-oauth/index.ts
 *
 * RETIRED & DECOMMISSIONED:
 * Google OAuth architecture has been completely replaced by
 * Gmail App Password (IMAP + SMTP) authentication.
 *
 * No Google Cloud Console, OAuth client IDs, client secrets, or OAuth redirect URIs are used.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  return new Response(
    JSON.stringify({
      error: "Gmail OAuth endpoint is permanently decommissioned. Gmail automation runs via Gmail App Password (IMAP + SMTP).",
      status: 410,
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    }
  );
});
