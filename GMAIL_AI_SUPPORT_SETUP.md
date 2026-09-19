# Gmail AI Customer Support Backend — Production Setup Guide

> **Architecture:** A dedicated, multi-tenant customer support automation system.
> The system polls connected customer Gmail mailboxes via **IMAP (`imap.gmail.com:993` with TLS)** on a 5-minute schedule, classifies messages with AI, retrieves business knowledge from Supabase Postgres, generates a grounded response, and sends the reply via **Gmail SMTP (`smtp.gmail.com:465` with TLS)**.
>
> **No Google Cloud Console. No Google Cloud Pub/Sub. No OAuth client IDs.**
> Authentication uses standard 16-character **Gmail App Passwords**, encrypted at rest using AES-256-GCM.
>
> **ONE internal secret** — `CHOWDHURY_DUO_GATEWAY_SECRET` — authenticates all internal calls,
> including the pg_cron → Vercel polling job.

---

## System Architecture

```
Supabase pg_cron (runs every 5 mins)
        │
        │ HTTP POST (pg_net) with x-cron-secret: CHOWDHURY_DUO_GATEWAY_SECRET
        ▼
Vercel Node.js Serverless Gateway: /api/internal/gateway/gmail/poll
        │
        ├─▶ Validates CHOWDHURY_DUO_GATEWAY_SECRET (single internal secret)
        ├─▶ Loads active accounts from Supabase `gmail_accounts` table
        ├─▶ In-memory AES-256-GCM decryption of customer App Passwords
        ├─▶ Connects to imap.gmail.com:993 with TLS via imapflow
        ├─▶ Filters out outbound emails sent by the business itself
        ├─▶ Atomically claims message in `automation_executions`
        │
        ▼ (for each new customer message)
AI Customer Support Pipeline (`lib/ai/support-engine.ts`)
        │
        ├─▶ 1. Classify Intent (Customer Support vs Sales vs Newsletter/Spam)
        ├─▶ 2. Retrieve Business Knowledge (from Supabase knowledge_documents)
        ├─▶ 3. Generate Grounded Reply (adhering to business rules, refund policies, tone)
        │
        ▼
Gmail SMTP Reply (`smtp.gmail.com:465` with TLS)
        │
        ├─▶ Sends thread-aware reply (In-Reply-To, References headers)
        ├─▶ Marks IMAP message as \Seen in INBOX
        ├─▶ Stores conversation and message records in Supabase
        ├─▶ Optional Slack notification to team channel
        └─▶ Records COMPLETED audit status in `automation_executions`
```

---

## Step 1 — Supabase Database Setup

### 1.1 Get your Supabase API credentials
From **Supabase Dashboard → Project Settings → API**:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Project URL (e.g. `https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret (server-side only) |

### 1.2 Run the schema migration
In **Supabase Dashboard → SQL Editor**, run the full contents of:

```
supabase/migrations/20260919000001_gmail_ai_support_schema.sql
```

This creates all required tables:
- `businesses`, `business_rules`, `gmail_accounts`
- `customers`, `conversations`, `messages`
- `knowledge_documents`, `automation_executions`
- Full-text search RPC `search_knowledge_text`
- Row-Level Security on all tables

> **Note:** `supabase db push` will also apply this migration if you have the Supabase CLI linked to the project.

---

## Step 2 — Schedule 5-Minute Polling via `pg_cron`

> **Authentication:** The pg_cron job uses `CHOWDHURY_DUO_GATEWAY_SECRET` — the same secret
> that secures all other internal Vercel endpoints. There is NO separate `CRON_SECRET`.

In **Supabase Dashboard → SQL Editor**, run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any old job if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-poll-gateway') THEN
    PERFORM cron.unschedule('gmail-poll-gateway');
  END IF;
END $$;

-- Schedule 5-minute polling
SELECT cron.schedule(
  'gmail-poll-gateway',
  '*/5 * * * *',
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
```

*(Replace `<YOUR_CHOWDHURY_DUO_GATEWAY_SECRET>` with your configured `CHOWDHURY_DUO_GATEWAY_SECRET` value.)*

---

## Step 3 — Environment Variables (Vercel)

Add the following to **Vercel Project Settings → Environment Variables**:

```env
# Supabase Project
SUPABASE_URL=https://udfqrlzsgkdbvungumto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Credential Encryption (AES-256-GCM) — required to decrypt stored App Passwords
AUTOMATION_VAULT_KEY=<64-hex-character-string>

# Internal Service Authentication — ONE secret for all internal calls
# pg_cron sends this in x-cron-secret header
# n8n sends this in x-internal-service-key header
CHOWDHURY_DUO_GATEWAY_SECRET=<your-64-hex-secret>

# AI Engine (OpenRouter recommended)
AI_SUPPORT_API_KEY=<your-openrouter-api-key>
AI_SUPPORT_MODEL=openrouter/free
AI_SUPPORT_BASE_URL=https://openrouter.ai/api/v1
```

> **Important:** `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` are **NOT** required in Vercel
> for production SaaS. Customer Gmail credentials are stored per-tenant in Supabase.

---

## Step 4 — Connect Customer Gmail Accounts

### 4.1 Generate a Gmail App Password
1. Enable **2-Step Verification** on the Gmail account: <https://myaccount.google.com/signinoptions/two-step-verification>
2. Generate an **App Password**: <https://myaccount.google.com/apppasswords>
3. Name it (e.g., `Chowdhury Duo Support`) and copy the 16-character string.

### 4.2 Connect the account via the API
Send a `POST` request to `/api/integrations/gmail/connect` (authenticated Clerk session required):

```bash
curl -X POST https://chowdhuryduo.in/api/integrations/gmail/connect \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=<your_clerk_session_cookie>" \
  -d '{
    "email": "support@yourbusiness.com",
    "appPassword": "abcdefghijklmnop"
  }'
```

The endpoint will:
1. Validate the credentials live against `imap.gmail.com:993`.
2. Encrypt the password using AES-256-GCM (`AUTOMATION_VAULT_KEY`).
3. Save the encrypted credential in Supabase `gmail_accounts`.
4. The pg_cron job will automatically poll the inbox every 5 minutes.
