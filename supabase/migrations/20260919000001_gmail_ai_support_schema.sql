-- =============================================================================
-- Migration: 20260919000001_gmail_ai_support_schema.sql
--
-- Gmail AI Customer Support Backend — Core Schema
--
-- Architecture:
--   Supabase pg_cron → Vercel /api/internal/gateway/gmail/poll
--   → Gmail IMAP (imapflow) → AI pipeline → Gmail SMTP (nodemailer)
--
-- NO Google Cloud Console. NO OAuth. NO Pub/Sub.
-- Authentication uses Gmail App Passwords encrypted via AES-256-GCM in Vercel.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Prerequisites
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------------------------------------------------------------------------
-- businesses
-- One record per SaaS tenant / connected Gmail customer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,          -- Clerk user ID or custom slug
  name        text NOT NULL,
  contact_email text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- business_rules
-- Per-tenant AI behaviour and auto-reply configuration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  company_description   text,
  products_services     text,
  support_policies      text,
  refund_return_rules   text,
  tone                  text DEFAULT 'professional',
  prohibited_responses  text,
  escalation_rules      text,
  contact_info          text,
  working_hours         text,
  custom_instructions   text,
  auto_reply_enabled    boolean NOT NULL DEFAULT true,
  confidence_threshold  numeric(4,3) NOT NULL DEFAULT 0.75,
  slack_webhook_url     text,
  slack_channel_id      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

-- ---------------------------------------------------------------------------
-- gmail_accounts
-- Per-tenant Gmail mailbox credentials.
-- App Password is encrypted at rest using AES-256-GCM (Vercel AUTOMATION_VAULT_KEY).
-- NEVER stores plaintext credentials.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email             text NOT NULL,
  -- AES-256-GCM encrypted App Password components (all base64-encoded)
  app_password_enc  text NOT NULL,           -- ciphertext
  app_password_iv   text NOT NULL,           -- 12-byte IV
  app_password_tag  text NOT NULL,           -- 16-byte GCM auth tag
  vault_version     integer NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'CONNECTED'
                    CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SUSPENDED')),
  last_polled_at    timestamptz,
  last_error        text,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);

-- ---------------------------------------------------------------------------
-- customers
-- Inbound email senders (auto-created on first contact).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email         text NOT NULL,
  name          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);

-- ---------------------------------------------------------------------------
-- conversations
-- One row per Gmail thread per business.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id       uuid REFERENCES customers(id) ON DELETE SET NULL,
  gmail_thread_id   text NOT NULL,
  subject           text,
  status            text NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN', 'AUTO_REPLIED', 'PENDING_APPROVAL', 'CLOSED', 'ESCALATED')),
  category          text,
  confidence_score  numeric(4,3),
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, gmail_thread_id)
);

-- ---------------------------------------------------------------------------
-- messages
-- Individual emails within a conversation (inbound + AI-sent replies).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id   uuid REFERENCES conversations(id) ON DELETE SET NULL,
  gmail_message_id  text,
  role              text NOT NULL
                    CHECK (role IN ('CUSTOMER', 'AI_DRAFT', 'HUMAN_AGENT', 'SYSTEM')),
  sender            text,
  recipient         text,
  subject           text,
  body_text         text,
  body_html         text,
  status            text NOT NULL DEFAULT 'RECEIVED'
                    CHECK (status IN ('RECEIVED', 'SENT', 'DRAFT', 'FAILED')),
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- knowledge_documents
-- Business-specific knowledge base used by the AI for grounded replies.
-- Supports both pgvector similarity search and full-text search.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title         text NOT NULL,
  content       text NOT NULL,
  category      text,
  tags          text[],
  embedding     vector(1536),              -- Optional: pgvector embeddings for semantic search
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Full-text search index on knowledge_documents
CREATE INDEX IF NOT EXISTS idx_knowledge_fts
  ON knowledge_documents
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE INDEX IF NOT EXISTS idx_knowledge_business
  ON knowledge_documents (business_id);

-- ---------------------------------------------------------------------------
-- automation_executions
-- Audit log for every email the poller processes.
-- Unique constraint on (business_id, gmail_message_id) provides atomic
-- deduplication: a duplicate INSERT will fail, preventing double-processing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_executions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  gmail_account_id  uuid REFERENCES gmail_accounts(id) ON DELETE SET NULL,
  conversation_id   uuid REFERENCES conversations(id) ON DELETE SET NULL,
  gmail_message_id  text NOT NULL,
  gmail_thread_id   text,
  trigger_type      text NOT NULL DEFAULT 'SCHEDULED_POLL'
                    CHECK (trigger_type IN ('SCHEDULED_POLL', 'MANUAL', 'WEBHOOK')),
  status            text NOT NULL DEFAULT 'PROCESSING'
                    CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- DEDUPLICATION CONSTRAINT: prevents double-processing of the same message per tenant
  CONSTRAINT uq_executions_business_message UNIQUE (business_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_executions_business_status
  ON automation_executions (business_id, status);

-- ---------------------------------------------------------------------------
-- RPC: search_knowledge_text
-- Full-text search for business knowledge documents.
-- Called by the AI pipeline during knowledge retrieval.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_knowledge_text(
  p_business_id uuid,
  p_query       text,
  p_limit       integer DEFAULT 5
)
RETURNS TABLE (
  id       uuid,
  title    text,
  content  text,
  category text,
  rank     real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kd.id,
    kd.title,
    kd.content,
    kd.category,
    ts_rank(
      to_tsvector('english', coalesce(kd.title, '') || ' ' || coalesce(kd.content, '')),
      plainto_tsquery('english', p_query)
    ) AS rank
  FROM knowledge_documents kd
  WHERE
    kd.business_id = p_business_id
    AND to_tsvector('english', coalesce(kd.title, '') || ' ' || coalesce(kd.content, ''))
        @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Enable RLS on all tables. Service-role key (used by Vercel) bypasses RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE businesses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
