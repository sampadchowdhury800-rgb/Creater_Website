/**
 * supabase/functions/gmail-check/index.ts
 *
 * NOTE / ARCHITECTURAL STATUS:
 * Gmail automation has transitioned to IMAP + SMTP with Gmail App Passwords.
 * Because hosted Supabase Edge Functions restrict outbound raw TCP ports (993/465),
 * scheduled polling runs in the existing Vercel Node.js Serverless runtime:
 *   Endpoint: /api/internal/gateway/gmail/poll
 *
 * This function returns 410 indicating the migration to the Vercel IMAP/SMTP gateway.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  return new Response(
    JSON.stringify({
      message: "Scheduled polling is handled by the Vercel Node.js gateway at /api/internal/gateway/gmail/poll via IMAP + SMTP.",
      status: 410,
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    }
  );
});
