-- =============================================================================
-- Migration: 20260920000001_update_polling_schedule_1min.sql
--
-- Gmail AI Support — Update pg_cron Schedule: 5 minutes → 1 minute
--
-- PURPOSE:
--   Changes the Gmail polling job from every 5 minutes to every 1 minute.
--   This reduces the maximum scheduler polling interval.
--
-- IMPORTANT — LATENCY NOTE:
--   Changing to a 1-minute schedule reduces the MAXIMUM scheduler interval.
--   It does NOT guarantee a one-minute end-to-end reply time.
--   Additional latency sources: AI inference, IMAP fetch, DB operations, SMTP.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Execute this SQL as-is — no placeholders to replace.
--   3. Verify the output: schedule should show '* * * * *', active = true.
--
-- PREREQUISITE:
--   The gmail-poll-gateway job must already exist.
--   If it does not, run 20260919000002_polling_scheduler_schema.sql first
--   (with your domain and gateway secret filled in).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Safely remove the existing job (no-op if already absent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-poll-gateway') THEN
    PERFORM cron.unschedule('gmail-poll-gateway');
    RAISE NOTICE 'Unscheduled existing gmail-poll-gateway job.';
  ELSE
    RAISE NOTICE 'No existing gmail-poll-gateway job found — will create fresh.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Re-schedule with 1-minute interval
--
-- Target URL points to canonical production website: https://chowdhuryduo.in
-- Replace <YOUR_CHOWDHURY_DUO_GATEWAY_SECRET> with the value configured
-- in your Vercel Environment Variables → CHOWDHURY_DUO_GATEWAY_SECRET
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
-- Verify the result — check output before closing SQL Editor
-- ---------------------------------------------------------------------------
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname = 'gmail-poll-gateway';

-- Expected output:
--   jobname             | schedule    | active | jobid
--   gmail-poll-gateway  | * * * * *   | t      | <some_id>
