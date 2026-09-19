/**
 * supabase/functions/_shared/types.ts
 *
 * Shared types for Supabase Edge Functions in Gmail AI Customer Support Automation.
 */

export type ExecutionStatus = "RECEIVED" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED";

export type EmailClassification =
  | "CUSTOMER_SUPPORT"
  | "SALES_INQUIRY"
  | "SPAM"
  | "NEWSLETTER"
  | "OTHER";

export interface BusinessRecord {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  timezone: string;
  plan_tier: string;
  is_active: boolean;
  settings: Record<string, unknown>;
}

export interface BusinessRulesRecord {
  id: string;
  business_id: string;
  company_description: string | null;
  products_services: string | null;
  support_policies: string | null;
  refund_return_rules: string | null;
  tone: string;
  prohibited_responses: string | null;
  escalation_rules: string | null;
  contact_info: string | null;
  working_hours: string | null;
  custom_instructions: string | null;
  auto_reply_enabled: boolean;
  confidence_threshold: number;
  slack_webhook_url: string | null;
  slack_channel_id: string | null;
}

export interface GmailAccountRecord {
  id: string;
  business_id: string;
  email: string;
  google_account_id: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scopes: string[];
  history_id: string | null;
  status: string;
}

export interface ParsedEmailMessage {
  id: string;
  threadId: string;
  sender: string;
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  messageIdHeader: string | null;
  inReplyToHeader: string | null;
  referencesHeader: string | null;
  date: string;
  headers: Record<string, string>;
}

export interface ClassificationResult {
  isSupport: boolean;
  classification: EmailClassification;
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
