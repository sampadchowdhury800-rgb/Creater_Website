-- =============================================================================
-- Migration: 20260919000002_polling_scheduler_schema.sql
--
-- Gmail AI Support — pg_cron / pg_net Polling Scheduler Setup
--
-- This script is NOT run automatically by `supabase db push`.
-- It must be run manually via Supabase Dashboard → SQL Editor,
-- once per Supabase project, AFTER setting the CHOWDHURY_DUO_GATEWAY_SECRET
-- environment variable in your Vercel project.
--
-- AUTHENTICATION:
--   The pg_cron job sends CHOWDHURY_DUO_GATEWAY_SECRET in the x-cron-secret
--   HTTP header to the Vercel polling endpoint.
--   There is ONE secret for all internal service-to-service calls.
--   Do NOT configure a separate CRON_SECRET.
--
-- PRODUCTION URL:
--   Configured via NEXT_PUBLIC_SITE_URL (e.g. https://chowdhuryduo.in).
--   Replace the placeholder below before running.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor
--   2. The target URL is pre-configured to https://chowdhuryduo.in/api/internal/gateway/gmail/poll
--   3. Replace <YOUR_CHOWDHURY_DUO_GATEWAY_SECRET> with the value configured
--      in your Vercel Environment Variables → CHOWDHURY_DUO_GATEWAY_SECRET
--   4. Execute the SQL
-- =============================================================================

-- Enable required Supabase extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Remove any pre-existing job with this name (safe; no-op if absent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-poll-gateway') THEN
    PERFORM cron.unschedule('gmail-poll-gateway');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Schedule the Gmail polling job — every 1 minute
--
-- The job makes an HTTPS POST to the Vercel serverless function.
-- Authentication is via CHOWDHURY_DUO_GATEWAY_SECRET in x-cron-secret header.
-- No Gmail credentials are embedded in this job configuration.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'gmail-poll-gateway',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://chowdhuryduo.in/api/internal/gateway/gmail/poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CHOWDHURY_DUO_GATEWAY_SECRET>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ---------------------------------------------------------------------------
-- Verify the job was created (informational — check output)
-- ---------------------------------------------------------------------------
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname = 'gmail-poll-gateway';
