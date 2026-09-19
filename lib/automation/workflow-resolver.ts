/**
 * lib/automation/workflow-resolver.ts
 *
 * Environment-aware resolver for n8n workflow IDs.
 *
 * ARCHITECTURAL CONTEXT:
 * - Local development n8n and Railway production n8n have different workflow IDs
 *   for the same logical automation (e.g. Gmail Customer Support Agent).
 * - The Neon PostgreSQL database is shared between local development and production.
 * - Storing a single static workflow ID in the database would break one environment.
 * - This resolver allows:
 *     1. Explicit env var overrides (N8N_GMAIL_WORKFLOW_ID, N8N_WORKFLOW_ID_OVERRIDES).
 *     2. Automatic environment-aware resolution:
 *        - Production (NODE_ENV=production, VERCEL=1, N8N_ENV=production):
 *          Resolves Railway production workflow IDs (e.g. gPkQTl6FhMZmBFdd).
 *        - Local development / test:
 *          Resolves local workflow IDs (e.g. AESai9x1nAP41VKO from DB).
 *     3. Safe fallback to the DB-persisted n8nWorkflowId.
 */

export interface AutomationIdentifier {
  id?: string;
  slug?: string;
  n8nWorkflowId?: string | null;
}

export interface ResolveWorkflowOptions {
  /** Explicitly override the detected environment (useful for unit/integration tests) */
  targetEnv?: "production" | "development";
}

/**
 * Known production workflow mappings for Railway n8n instance.
 * Maps automation slug or local workflow ID -> Railway production workflow ID.
 */
const PRODUCTION_WORKFLOW_MAP: Record<string, string> = {
  "gmail-customer-support-agent": "gPkQTl6FhMZmBFdd",
  "AESai9x1nAP41VKO": "gPkQTl6FhMZmBFdd",
};

/**
 * Determines whether the current process is running in production.
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.N8N_ENV === "production"
  );
}

/**
 * Resolves the appropriate n8n workflow ID for an automation based on the current environment.
 */
export function resolveAutomationWorkflowId(
  automation: AutomationIdentifier | null | undefined,
  options?: ResolveWorkflowOptions
): string | null {
  if (!automation) return null;

  const dbWorkflowId = automation.n8nWorkflowId?.trim() || null;
  const slug = automation.slug?.trim() || "";

  // 1. Check dedicated specific env vars
  if (slug === "gmail-customer-support-agent" || dbWorkflowId === "AESai9x1nAP41VKO") {
    if (process.env.N8N_GMAIL_WORKFLOW_ID) {
      return process.env.N8N_GMAIL_WORKFLOW_ID.trim();
    }
  }

  // 2. Check JSON override map if provided
  if (process.env.N8N_WORKFLOW_ID_OVERRIDES) {
    try {
      const overrides = JSON.parse(process.env.N8N_WORKFLOW_ID_OVERRIDES);
      if (slug && overrides[slug]) return overrides[slug];
      if (dbWorkflowId && overrides[dbWorkflowId]) return overrides[dbWorkflowId];
    } catch {
      console.warn("[workflow-resolver] Failed to parse N8N_WORKFLOW_ID_OVERRIDES env var");
    }
  }

  // 3. Determine environment
  const isProd = options?.targetEnv
    ? options.targetEnv === "production"
    : isProductionEnvironment();

  // 4. Production resolution
  if (isProd) {
    if (slug && PRODUCTION_WORKFLOW_MAP[slug]) {
      return PRODUCTION_WORKFLOW_MAP[slug];
    }
    if (dbWorkflowId && PRODUCTION_WORKFLOW_MAP[dbWorkflowId]) {
      return PRODUCTION_WORKFLOW_MAP[dbWorkflowId];
    }
  }

  // 5. Development / local / default: use the database-stored workflow ID
  return dbWorkflowId;
}
