-- =============================================================================
-- Migration: 20260920000002_business_config_schema.sql
--
-- Business Information, Business Knowledge, Support Categories & Supervisor Schema
--
-- Adds:
--   1. businesses table extension: brand_name, description, contact details, timezone, currency
--   2. business_rules table extension: structured policies (refund, return, cancellation,
--      shipping, warranty, order, payment), brand voice, unknown question & after-hours behaviors
--   3. business_hours table: structured weekly operating hours per day
--   4. support_categories table: master catalog of 19 standard support categories
--   5. business_support_categories table: tenant-level category enablement & escalation toggles
--   6. gmail_accounts table extension: per-mailbox support toggles, signature, custom instructions
--   7. business_ai_instructions table: priority-ordered custom AI instructions
--
-- NON-BREAKING: Uses IF NOT EXISTS and sensible DEFAULTs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend businesses with Profile Information
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS brand_name      text,
  ADD COLUMN IF NOT EXISTS business_type   text,
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS website         text,
  ADD COLUMN IF NOT EXISTS contact_phone   text,
  ADD COLUMN IF NOT EXISTS address         text,
  ADD COLUMN IF NOT EXISTS city            text,
  ADD COLUMN IF NOT EXISTS state           text,
  ADD COLUMN IF NOT EXISTS country         text,
  ADD COLUMN IF NOT EXISTS timezone        text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS currency        text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS plan_tier       text NOT NULL DEFAULT 'STARTER',
  ADD COLUMN IF NOT EXISTS is_active       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS settings        jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Extend business_rules with Structured Policies & Voice Controls
-- ---------------------------------------------------------------------------
ALTER TABLE business_rules
  -- Policies
  ADD COLUMN IF NOT EXISTS refund_policy             text,
  ADD COLUMN IF NOT EXISTS cancellation_policy       text,
  ADD COLUMN IF NOT EXISTS return_policy             text,
  ADD COLUMN IF NOT EXISTS warranty_policy           text,
  ADD COLUMN IF NOT EXISTS shipping_policy           text,
  ADD COLUMN IF NOT EXISTS order_policy              text,
  ADD COLUMN IF NOT EXISTS payment_policy            text,
  ADD COLUMN IF NOT EXISTS product_service_info      text,
  -- Voice & Style
  ADD COLUMN IF NOT EXISTS greeting_preference       text DEFAULT 'Friendly greeting with customer name if available',
  ADD COLUMN IF NOT EXISTS sign_off_preference       text DEFAULT 'Warm professional closing with team sign-off',
  ADD COLUMN IF NOT EXISTS mention_business_name     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mention_support_team      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_writing_instructions text,
  -- Unknown Question Behavior: NO_REPLY | FALLBACK_RESPONSE | NOTIFY_TEAM | HUMAN_REVIEW
  ADD COLUMN IF NOT EXISTS unknown_question_behavior text NOT NULL DEFAULT 'FALLBACK_RESPONSE'
    CHECK (unknown_question_behavior IN ('NO_REPLY', 'FALLBACK_RESPONSE', 'NOTIFY_TEAM', 'HUMAN_REVIEW')),
  ADD COLUMN IF NOT EXISTS fallback_message          text NOT NULL DEFAULT 'Thank you for reaching out to us. We have received your message and our support team will review it shortly.',
  -- Business Hours Behavior: REPLY_NORMALLY | AFTER_HOURS_MESSAGE | DO_NOT_REPLY | ESCALATE
  ADD COLUMN IF NOT EXISTS after_hours_behavior      text NOT NULL DEFAULT 'REPLY_NORMALLY'
    CHECK (after_hours_behavior IN ('REPLY_NORMALLY', 'AFTER_HOURS_MESSAGE', 'DO_NOT_REPLY', 'ESCALATE')),
  ADD COLUMN IF NOT EXISTS respond_outside_hours     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS after_hours_message       text NOT NULL DEFAULT 'Thank you for contacting us. Our office is currently closed. We will respond during our next business hours.',
  -- Safety & Escalation Guardrails
  ADD COLUMN IF NOT EXISTS max_reply_length          integer NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS complaints_require_human  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunds_require_human     boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. business_hours
-- Structured weekly operating hours (0 = Sunday .. 6 = Saturday)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_hours (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week   integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time     text NOT NULL DEFAULT '09:00',
  close_time    text NOT NULL DEFAULT '18:00',
  is_closed     boolean NOT NULL DEFAULT false,
  timezone      text NOT NULL DEFAULT 'UTC',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_biz ON business_hours (business_id);

-- ---------------------------------------------------------------------------
-- 4. support_categories
-- Master system catalog of categories that the AI triage engine can detect.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed standard categories
INSERT INTO support_categories (name, slug, description, is_system) VALUES
  ('Customer Support',      'customer_support',      'General support inquiries and customer questions', true),
  ('General Questions',     'general_questions',     'General questions about the company or service', true),
  ('Business Hours',        'business_hours',        'Operating hours, holiday schedules, working times', true),
  ('Product Questions',     'product_questions',     'Inquiries about products, features, specifications', true),
  ('Service Questions',     'service_questions',     'Questions regarding offered services and scopes', true),
  ('Pricing Questions',     'pricing_questions',     'Pricing rates, tiers, quotes, and fee structures', true),
  ('Order Questions',       'order_questions',       'Existing orders, order placement, order numbers', true),
  ('Shipping Questions',    'shipping_questions',    'Shipping methods, shipping rates, carrier options', true),
  ('Delivery Questions',    'delivery_questions',    'Tracking numbers, delivery dates, transit status', true),
  ('Returns',               'returns',               'Return requests, return labels, return eligibility', true),
  ('Refunds',               'refunds',               'Refund requests, money-back guarantees, chargebacks', true),
  ('Cancellations',         'cancellations',         'Order or service cancellation requests', true),
  ('Warranty',              'warranty',              'Warranty claims, coverage periods, repair policies', true),
  ('Complaints',            'complaints',            'Customer dissatisfaction, escalation, complaints', true),
  ('Product Availability',  'product_availability',  'Stock levels, replenishment dates, backorders', true),
  ('Appointment Questions', 'appointment_questions', 'Appointments, consultation schedules, calendar slots', true),
  ('Booking Questions',     'booking_questions',     'Reservations, booking confirmations, changes', true),
  ('Account Questions',     'account_questions',     'User login, password resets, profile settings', true),
  ('Other Questions',       'other',                 'Miscellaneous or unclassified inquiries', true)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. business_support_categories
-- Tenant-specific configuration for each category.
-- Controls whether AI handles it, auto-replies, or forces human review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_support_categories (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_slug         text NOT NULL REFERENCES support_categories(slug) ON DELETE CASCADE,
  enabled               boolean NOT NULL DEFAULT true,
  requires_human_review boolean NOT NULL DEFAULT false,
  auto_reply            boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, category_slug)
);

CREATE INDEX IF NOT EXISTS idx_biz_support_cats ON business_support_categories (business_id, category_slug);

-- ---------------------------------------------------------------------------
-- 6. Extend gmail_accounts for Multi-Account Configuration
-- ---------------------------------------------------------------------------
ALTER TABLE gmail_accounts
  ADD COLUMN IF NOT EXISTS support_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_instructions text,
  ADD COLUMN IF NOT EXISTS signature           text;

-- ---------------------------------------------------------------------------
-- 7. business_ai_instructions
-- Priority-ordered custom instructions and safety rules per tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_ai_instructions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  instruction_type text NOT NULL DEFAULT 'GENERAL'
                   CHECK (instruction_type IN ('GENERAL', 'TONE', 'POLICY', 'SAFETY', 'ESCALATION')),
  content          text NOT NULL,
  priority         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biz_ai_instructions ON business_ai_instructions (business_id, priority DESC);

-- ---------------------------------------------------------------------------
-- 8. Enable Row Level Security on New Tables
-- ---------------------------------------------------------------------------
ALTER TABLE business_hours             ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_ai_instructions   ENABLE ROW LEVEL SECURITY;
