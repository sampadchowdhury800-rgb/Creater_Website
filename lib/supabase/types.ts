/**
 * lib/supabase/types.ts
 *
 * TypeScript types for the Gmail AI Support Supabase database tables and automation.
 * Supports multi-tenant business profiles, business policies, structured business hours,
 * support category triage, and supervisor decisions.
 */

export type ExecutionStatus = "RECEIVED" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED";

export type EmailClassification =
  | "CUSTOMER_SUPPORT"
  | "SALES_INQUIRY"
  | "SPAM"
  | "NEWSLETTER"
  | "OTHER";

export type UnknownQuestionBehavior =
  | "NO_REPLY"
  | "FALLBACK_RESPONSE"
  | "NOTIFY_TEAM"
  | "HUMAN_REVIEW";

export type AfterHoursBehavior =
  | "REPLY_NORMALLY"
  | "AFTER_HOURS_MESSAGE"
  | "DO_NOT_REPLY"
  | "ESCALATE";

export interface BusinessRecord {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  brand_name?: string | null;
  business_type?: string | null;
  description?: string | null;
  website?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string;
  currency?: string;
  plan_tier?: string;
  is_active?: boolean;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessRulesRecord {
  id?: string;
  business_id?: string;
  company_description?: string | null;
  products_services?: string | null;
  support_policies?: string | null;
  refund_return_rules?: string | null;
  tone?: string;
  prohibited_responses?: string | null;
  escalation_rules?: string | null;
  contact_info?: string | null;
  working_hours?: string | null;
  custom_instructions?: string | null;
  auto_reply_enabled?: boolean;
  confidence_threshold?: number;
  slack_webhook_url?: string | null;
  slack_channel_id?: string | null;
  // Extended policies
  refund_policy?: string | null;
  cancellation_policy?: string | null;
  return_policy?: string | null;
  warranty_policy?: string | null;
  shipping_policy?: string | null;
  order_policy?: string | null;
  payment_policy?: string | null;
  product_service_info?: string | null;
  // Brand voice & style
  greeting_preference?: string | null;
  sign_off_preference?: string | null;
  mention_business_name?: boolean;
  mention_support_team?: boolean;
  custom_writing_instructions?: string | null;
  // Unknown questions & after hours
  unknown_question_behavior?: UnknownQuestionBehavior;
  fallback_message?: string | null;
  after_hours_behavior?: AfterHoursBehavior;
  respond_outside_hours?: boolean;
  after_hours_message?: string | null;
  // Guardrails
  max_reply_length?: number;
  complaints_require_human?: boolean;
  refunds_require_human?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessHoursRecord {
  id?: string;
  business_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday ... 6=Saturday
  open_time: string; // HH:MM (24h)
  close_time: string; // HH:MM (24h)
  is_closed: boolean;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupportCategoryRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system?: boolean;
  created_at?: string;
}

export interface BusinessSupportCategoryRecord {
  id?: string;
  business_id: string;
  category_slug: string;
  enabled: boolean;
  requires_human_review: boolean;
  auto_reply: boolean;
  category?: SupportCategoryRecord;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessAiInstructionRecord {
  id?: string;
  business_id: string;
  instruction_type: "GENERAL" | "TONE" | "POLICY" | "SAFETY" | "ESCALATION";
  content: string;
  priority: number;
  created_at?: string;
  updated_at?: string;
}

export interface GmailAccountRecord {
  id: string;
  business_id: string;
  email: string;
  google_account_id?: string | null;
  access_token_enc?: string | null;
  refresh_token_enc?: string | null;
  token_expires_at?: string | null;
  scopes?: string[];
  history_id?: string | null;
  status: string;
  support_enabled?: boolean;
  auto_reply_enabled?: boolean;
  custom_instructions?: string | null;
  signature?: string | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ParsedEmailMessage {
  id: string;
  threadId: string;
  sender: string;
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  messageIdHeader?: string | null;
  inReplyToHeader?: string | null;
  referencesHeader?: string | null;
  date?: string;
  headers?: Record<string, string>;
}

export interface ClassificationResult {
  isSupport: boolean;
  classification: EmailClassification;
  categorySlug?: string;
  confidence: number;
  reasoning: string;
}

export interface KnowledgeDocumentMatch {
  id: string;
  title: string;
  content: string;
  category?: string;
  similarity?: number;
  rank?: number;
}

export interface GenerationResult {
  replyHtml: string;
  replyText: string;
  reasoning: string;
  confidence: number;
}

export interface SupervisorDecision {
  action: "AUTO_REPLY" | "FALLBACK" | "AFTER_HOURS" | "HUMAN_REVIEW" | "SKIP";
  category: string;
  confidence: number;
  replyText?: string;
  replyHtml?: string;
  reasoning: string;
  humanReviewReason?: string;
}
