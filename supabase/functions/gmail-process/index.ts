/**
 * supabase/functions/gmail-process/index.ts
 *
 * NOTE / ARCHITECTURAL STATUS:
 * Gmail processing has transitioned to the Vercel Node.js Serverless runtime
 * using Gmail IMAP + SMTP with Gmail App Passwords and the internal AI engine:
 *   Endpoint: /api/internal/gateway/gmail/poll
 *   AI Engine: lib/ai/support-engine.ts
 *
 * This function returns 410 indicating the migration to the Vercel gateway.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  return new Response(
    JSON.stringify({
      message: "Gmail AI processing is handled by the Vercel Node.js gateway at /api/internal/gateway/gmail/poll.",
      status: 410,
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    }
  );
});
