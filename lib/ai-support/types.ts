/**
 * Types for the Chowdhury Duo AI Customer Support System.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  code: string;
  planType: string;
  priceINR: number;
  originalPriceINR: number | null;
  durationDays: number | null;
  trialDays: number | null;
  maintenanceEnabled: boolean;
  maintenancePriceINR: number;
  maintenanceInterval: string;
  maintenanceStartRule: string;
  isPopular: boolean;
  description: string | null;
}

export interface ConfigFieldSummary {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  isSensitive: boolean;
}

export interface AutomationProductSummary {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  description: string | null;
  features: string[];
  requirements: string[];
  integrations: string[];
  pricingType: string;
  isExecutable: boolean;
  plans: PlanSummary[];
  configFields: ConfigFieldSummary[];
}

export interface UserWorkspaceSummary {
  automationTitle: string;
  slug: string;
  status: string;
  hasSavedConfig: boolean;
  entitlementStatus: string;
  isLifetime: boolean;
  expiresAt: string | null;
  remainingDays: number | null;
  maintenanceStatus: string;
  lastExecutionStatus: string | null;
  lastExecutionAt: string | null;
  lastExecutionError?: string | null;
}

export interface AdminSupportKnowledge {
  supportEmail: string;
  emergencyNotice: string;
  faqs: Array<{ question: string; answer: string; category?: string }>;
  troubleshootingTips: string[];
  policies: {
    refundPolicy: string;
    maintenancePolicy: string;
    executionGuarantee: string;
  };
}

export interface KnowledgeContext {
  site: {
    name: string;
    tagline: string;
    shortDescription: string;
    founders: string[];
    contactEmail: string;
    url: string;
  };
  automations: AutomationProductSummary[];
  userWorkspace?: UserWorkspaceSummary[];
  adminKnowledge: AdminSupportKnowledge;
}

export interface AIProviderResponse {
  success: boolean;
  message?: string;
  error?: string;
  statusCode?: number;
}
