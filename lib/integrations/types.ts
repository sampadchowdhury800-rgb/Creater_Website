/**
 * lib/integrations/types.ts
 *
 * Types and contracts for the Chowdhury Duo Secure Integration Gateway.
 * SERVER-SIDE ONLY.
 */

import type { IntegrationProvider, ConnectionStatus, GrantStatus, GatewayOperationStatus } from "@prisma/client";

export type { IntegrationProvider, ConnectionStatus, GrantStatus, GatewayOperationStatus };

export type SupportedGoogleCapability =
  | "GMAIL_SEND"
  | "GMAIL_READ_LIST"
  | "GMAIL_GET_MESSAGE"
  | "GMAIL_MODIFY"
  | "GMAIL_WATCH";

export type SupportedAiCapability =
  | "SUPPORT_AI";

export type SupportedCapability = SupportedGoogleCapability | SupportedAiCapability;

export interface CapabilityDefinition {
  capability: SupportedCapability;
  provider: IntegrationProvider;
  requiredScopes: readonly string[];
  description: string;
  allowedOperations: readonly string[];
}

export interface IntegrationRequirement {
  id: string; // Machine key, e.g. "gmail"
  provider: IntegrationProvider;
  capability: SupportedCapability;
  required: boolean;
  label: string;
  description: string;
}

export interface AutomationIntegrationRequirements {
  requirements: IntegrationRequirement[];
}

export interface GmailSendParameters {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
  references?: string;
}

export interface GmailReadListParameters {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  pageToken?: string;
}

export interface GmailGetMessageParameters {
  messageId: string;
  format?: "full" | "metadata";
}

export interface GmailModifyParameters {
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface GmailWatchParameters {
  topicName: string;
  labelIds?: string[];
  labelFilterBehavior?: "include" | "exclude";
}

export interface GmailListHistoryParameters {
  startHistoryId: string;
  maxResults?: number;
  labelId?: string;
  pageToken?: string;
}

export type GatewayActionParameters =
  | GmailSendParameters
  | GmailReadListParameters
  | GmailGetMessageParameters
  | GmailModifyParameters
  | GmailWatchParameters
  | GmailListHistoryParameters;

export interface GatewayRequestPayload {
  executionGrant: string;
  action: SupportedCapability;
  parameters: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface GatewayBusinessResponse {
  success: boolean;
  messageId?: string;
  threadId?: string;
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  message?: {
    id: string;
    threadId: string;
    snippet?: string;
    subject?: string;
    from?: string;
    date?: string;
    internalDate?: number;
    bodyText?: string;
    bodyHtml?: string;
  };
  labelsApplied?: string[];
  historyId?: string;
  expiration?: string;
  history?: any[];
  errorCode?: string;
  errorMessage?: string;
}
