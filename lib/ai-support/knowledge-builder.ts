/**
 * Server-side knowledge context builder for the Chowdhury Duo AI Support Assistant.
 *
 * Gathers authoritative, live data from:
 * 1. Automation database records (PUBLISHED only, active plans, sanitized configSchema)
 * 2. Active AutomationPlan records (live pricing in INR, duration, maintenance)
 * 3. User-specific workspace context (authorized Clerk user only — strict IDOR isolation)
 * 4. Admin-managed support knowledge (from Setting table or verified defaults)
 * 5. Website brand configuration (siteConfig)
 *
 * All database queries use explicit `select` fields to prevent internal columns
 * (such as n8nWorkflowId, database credentials, or server secrets) from ever entering context.
 */

import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/siteConfig";
import { isConfigSchema, type ConfigSchema } from "@/lib/automation/validation";
import type {
  AutomationProductSummary,
  PlanSummary,
  ConfigFieldSummary,
  UserWorkspaceSummary,
  AdminSupportKnowledge,
  KnowledgeContext,
} from "./types";

/**
 * Default support knowledge provided by Chowdhury Duo.
 */
export const DEFAULT_ADMIN_SUPPORT_KNOWLEDGE: AdminSupportKnowledge = {
  supportEmail: siteConfig.email || "sampadchowdhury777@gmail.com",
  emergencyNotice: "AI Customer Support is live 24/7. Technical queries are grounded in real-time system state.",
  faqs: [
    {
      question: "How do I start using an automation after purchasing or claiming a trial?",
      answer:
        "1. Go to 'My Automations' in the top navigation. 2. Click 'Configure / Open Workspace' on the automation card. 3. Fill in all required configuration fields (such as your API keys or email parameters). 4. Click 'Save Configuration'. 5. If the automation is executable, click 'Run Automation' to trigger the workflow.",
      category: "Workflow",
    },
    {
      question: "What is the difference between Time-Limited access and Lifetime access?",
      answer:
        "Time-Limited plans grant execution rights for a specific duration (e.g., 30, 90, or 365 days). Once expired, you can renew. Lifetime plans grant perpetual access to execute the automation with no expiration date.",
      category: "Pricing & Plans",
    },
    {
      question: "How does maintenance pricing work?",
      answer:
        "Some automations include ongoing maintenance for third-party API updates, node compatibility, and bug fixes. If enabled on a plan, maintenance charges apply at the specified interval (monthly or yearly) and typically start after the included access period.",
      category: "Pricing & Plans",
    },
    {
      question: "Are my sensitive API keys and credentials secure?",
      answer:
        "Yes. All sensitive credentials entered in your workspace are encrypted using military-grade AES-256-GCM in an isolated cryptographic vault. Plaintext secret values are never visible in the browser, never logged, and never exposed to the AI assistant.",
      category: "Security",
    },
    {
      question: "Can I try an automation before purchasing?",
      answer:
        "Yes, products that offer a Free Trial allow you to activate and test all workflow capabilities with zero credit card commitment for the specified trial duration.",
      category: "Trials",
    },
  ],
  troubleshootingTips: [
    "If an automation fails with 'NOT_CONFIGURED', verify that you filled in all required fields and clicked 'Save Configuration' in your workspace.",
    "If execution returns 'ACCESS_EXPIRED', your trial or access pass has ended. Visit the product page to choose a renewal plan.",
    "If third-party API tokens expire, update them in the workspace configuration and click 'Save Configuration'.",
  ],
  policies: {
    refundPolicy:
      "Due to the digital nature of automation workflows and instant access to proprietary logic, refunds are handled on a case-by-case basis within 7 days of purchase if technical defects cannot be resolved by our team.",
    maintenancePolicy:
      "Active maintenance subscriptions ensure your automation receives immediate compatibility updates whenever external platforms (like Gmail, YouTube, or Instagram) update their APIs.",
    executionGuarantee:
      "Executable automations are powered by secure server-side workflow engines with automated retry logic and execution tracking.",
  },
};

/**
 * Sanitizes execution errors into customer-friendly troubleshooting context.
 * Strips raw URLs, node IDs, and database stack traces.
 */
function sanitizeExecutionError(rawError: string | null): string | null {
  if (!rawError) return null;
  const lower = rawError.toLowerCase();

  if (lower.includes("validation") || lower.includes("schema") || lower.includes("missing")) {
    return "Configuration is incomplete or has invalid parameter values. Please check your workspace configuration fields.";
  }
  if (lower.includes("auth") || lower.includes("401") || lower.includes("unauthorized") || lower.includes("token")) {
    return "Authentication failed with third-party service. Please verify that your API key/token in configuration is active and valid.";
  }
  if (lower.includes("rate") || lower.includes("429") || lower.includes("limit")) {
    return "External third-party API rate limit reached. Please wait a few minutes before triggering again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("504")) {
    return "Execution timed out while communicating with external services. Please try again.";
  }

  return "Workflow execution encountered an issue. Please verify all configuration parameters in your workspace.";
}

/**
 * Retrieves published automations with active plans using explicit column selection.
 * Excludes internal columns like n8nWorkflowId.
 */
export async function getLiveAutomationsContext(searchQuery?: string): Promise<AutomationProductSummary[]> {
  try {
    const automations = await prisma.automation.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDesc: true,
        description: true,
        features: true,
        requirements: true,
        integrations: true,
        pricingType: true,
        isExecutable: true,
        configSchema: true,
        plans: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
            planType: true,
            price: true,
            originalPrice: true,
            durationDays: true,
            trialDays: true,
            maintenanceEnabled: true,
            maintenancePrice: true,
            maintenanceInterval: true,
            maintenanceStartRule: true,
            isPopular: true,
            description: true,
          },
          orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = automations.map((auto) => {
      // Format active plans
      const plans: PlanSummary[] = auto.plans.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        planType: p.planType,
        priceINR: p.price / 100,
        originalPriceINR: p.originalPrice ? p.originalPrice / 100 : null,
        durationDays: p.durationDays,
        trialDays: p.trialDays,
        maintenanceEnabled: p.maintenanceEnabled,
        maintenancePriceINR: p.maintenancePrice / 100,
        maintenanceInterval: p.maintenanceInterval,
        maintenanceStartRule: p.maintenanceStartRule,
        isPopular: p.isPopular,
        description: p.description,
      }));

      // Sanitize configSchema: summarize fields, NEVER expose user data or vault keys
      const configFields: ConfigFieldSummary[] = [];
      if (auto.configSchema && isConfigSchema(auto.configSchema)) {
        const schema = auto.configSchema as ConfigSchema;
        for (const field of schema.fields) {
          configFields.push({
            key: field.key,
            label: field.label,
            type: field.type,
            required: !!field.required,
            placeholder: field.placeholder,
            helpText: field.helpText,
            isSensitive: !!field.sensitive,
          });
        }
      }

      return {
        id: auto.id,
        title: auto.title,
        slug: auto.slug,
        shortDesc: auto.shortDesc,
        description: auto.description,
        features: auto.features || [],
        requirements: auto.requirements || [],
        integrations: auto.integrations || [],
        pricingType: auto.pricingType,
        isExecutable: auto.isExecutable,
        plans,
        configFields,
      };
    });

    // If search query provided and we have many products (> 12), prioritize matching items
    if (searchQuery && mapped.length > 12) {
      const q = searchQuery.toLowerCase();
      return mapped.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q) ||
          a.integrations.some((i) => i.toLowerCase().includes(q)) ||
          a.features.some((f) => f.toLowerCase().includes(q))
      );
    }

    return mapped;
  } catch (error) {
    console.error("[getLiveAutomationsContext] Failed to retrieve automations:", error);
    return [];
  }
}

/**
 * Retrieves the authenticated user's workspace context.
 * Strict IDOR isolation: clerkUserId must match the authenticated session.
 */
export async function getUserWorkspaceContext(
  clerkUserId: string | null | undefined
): Promise<UserWorkspaceSummary[]> {
  if (!clerkUserId) return [];

  try {
    const userAutomations = await prisma.userAutomation.findMany({
      where: { clerkUserId },
      select: {
        id: true,
        status: true,
        config: true,
        automation: {
          select: { title: true, slug: true },
        },
        entitlements: {
          where: {
            status: { in: ["ACTIVE", "TRIAL", "GRACE_PERIOD", "EXPIRED"] },
          },
          select: {
            status: true,
            isLifetime: true,
            expiresAt: true,
            maintenanceStatus: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        executions: {
          select: {
            status: true,
            createdAt: true,
            error: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const now = new Date();

    return userAutomations.map((ua) => {
      const entitlement = ua.entitlements[0] || null;
      const lastExecution = ua.executions[0] || null;

      let remainingDays: number | null = null;
      if (entitlement?.expiresAt) {
        const diffMs = entitlement.expiresAt.getTime() - now.getTime();
        remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        automationTitle: ua.automation.title,
        slug: ua.automation.slug,
        status: ua.status,
        hasSavedConfig: ua.config !== null,
        entitlementStatus: entitlement?.status || "NO_ACTIVE_ENTITLEMENT",
        isLifetime: !!entitlement?.isLifetime,
        expiresAt: entitlement?.expiresAt ? entitlement.expiresAt.toISOString() : null,
        remainingDays,
        maintenanceStatus: entitlement?.maintenanceStatus || "NOT_APPLICABLE",
        lastExecutionStatus: lastExecution?.status || null,
        lastExecutionAt: lastExecution?.createdAt ? lastExecution.createdAt.toISOString() : null,
        lastExecutionError: sanitizeExecutionError(lastExecution?.error || null),
      };
    });
  } catch (error) {
    console.error("[getUserWorkspaceContext] Error loading user workspace:", error);
    return [];
  }
}

/**
 * Retrieves admin-managed support knowledge from Setting table or fallback defaults.
 */
export async function getAdminSupportKnowledge(): Promise<AdminSupportKnowledge> {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ["support_knowledge", "supportEmail", "emergencyNotice", "supportNotes", "contactEmail"],
        },
      },
      select: { key: true, value: true },
    });

    const settingMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);

    let knowledge: AdminSupportKnowledge = { ...DEFAULT_ADMIN_SUPPORT_KNOWLEDGE };

    // 1. If structured support_knowledge JSON is present, merge it
    if (settingMap.support_knowledge) {
      try {
        const parsed = JSON.parse(settingMap.support_knowledge);
        knowledge = {
          supportEmail: parsed.supportEmail || knowledge.supportEmail,
          emergencyNotice: parsed.emergencyNotice || knowledge.emergencyNotice,
          faqs: Array.isArray(parsed.faqs) ? parsed.faqs : knowledge.faqs,
          troubleshootingTips: Array.isArray(parsed.troubleshootingTips)
            ? parsed.troubleshootingTips
            : knowledge.troubleshootingTips,
          policies: parsed.policies || knowledge.policies,
        };
      } catch {
        // Fall back to defaults
      }
    }

    // 2. Overlay individual settings if set
    if (settingMap.supportEmail) knowledge.supportEmail = settingMap.supportEmail;
    else if (settingMap.contactEmail) knowledge.supportEmail = settingMap.contactEmail;

    if (settingMap.emergencyNotice) knowledge.emergencyNotice = settingMap.emergencyNotice;

    if (settingMap.supportNotes) {
      knowledge.troubleshootingTips = [
        ...knowledge.troubleshootingTips,
        ...settingMap.supportNotes.split("\n").filter((l) => l.trim().length > 0),
      ];
    }

    return knowledge;
  } catch (err) {
    console.warn("[getAdminSupportKnowledge] Could not load custom support settings, using defaults.");
  }

  return DEFAULT_ADMIN_SUPPORT_KNOWLEDGE;
}

/**
 * Assembles full KnowledgeContext object.
 */
export async function buildKnowledgeContext(
  clerkUserId?: string | null,
  searchQuery?: string
): Promise<KnowledgeContext> {
  const [automations, userWorkspace, adminKnowledge] = await Promise.all([
    getLiveAutomationsContext(searchQuery),
    getUserWorkspaceContext(clerkUserId),
    getAdminSupportKnowledge(),
  ]);

  return {
    site: {
      name: siteConfig.name,
      tagline: siteConfig.tagline,
      shortDescription: siteConfig.shortDescription,
      founders: [siteConfig.founder, siteConfig.coFounder].filter(Boolean),
      contactEmail: siteConfig.email,
      url: siteConfig.url,
    },
    automations,
    userWorkspace: userWorkspace.length > 0 ? userWorkspace : undefined,
    adminKnowledge,
  };
}

/**
 * Formats the KnowledgeContext into a clean, concise Markdown payload for the LLM prompt.
 * Emphasizes that Live Database Data is the supreme source of truth.
 */
export function formatKnowledgeForPrompt(ctx: KnowledgeContext): string {
  const lines: string[] = [];

  lines.push("### CHOWDHURY DUO APPLICATION & MARKETPLACE LIVE DATA");
  lines.push(`Company: ${ctx.site.name}`);
  lines.push(`Tagline: ${ctx.site.tagline}`);
  lines.push(`Founders: ${ctx.site.founders.join(", ")}`);
  lines.push(`Support Email: ${ctx.adminKnowledge.supportEmail}`);
  lines.push("");

  // Automations & Dynamic Pricing
  lines.push("#### AVAILABLE AUTOMATIONS & LIVE PRICING (AUTHORITATIVE DB RECORDS — HIGHEST AUTHORITY):");
  if (ctx.automations.length === 0) {
    lines.push("No automations currently published.");
  } else {
    for (const auto of ctx.automations) {
      lines.push(`- **${auto.title}** (Slug: \`${auto.slug}\`)`);
      if (auto.shortDesc) lines.push(`  Description: ${auto.shortDesc}`);
      if (auto.features.length > 0) lines.push(`  Features: ${auto.features.join("; ")}`);
      if (auto.integrations.length > 0) lines.push(`  Integrations: ${auto.integrations.join(", ")}`);
      if (auto.requirements.length > 0) lines.push(`  Prerequisites/Requirements: ${auto.requirements.join("; ")}`);
      lines.push(`  Executable Workflow: ${auto.isExecutable ? "Yes (via workspace)" : "No (packaged deliverable)"}`);

      // Active Plans & Dynamic Prices
      if (auto.plans.length > 0) {
        lines.push("  Available Plans (Live DB — Absolute Source of Truth):");
        for (const p of auto.plans) {
          let planDesc = `    * Plan: "${p.name}" (Code: ${p.code}) | Price: ₹${p.priceINR}`;
          if (p.originalPriceINR && p.originalPriceINR > p.priceINR) {
            planDesc += ` (Original: ₹${p.originalPriceINR})`;
          }
          if (p.planType === "LIFETIME") {
            planDesc += " | Duration: LIFETIME ACCESS";
          } else if (p.planType === "TRIAL") {
            planDesc += ` | Free Trial: ${p.trialDays} days`;
          } else if (p.durationDays) {
            planDesc += ` | Duration: ${p.durationDays} days`;
          }
          if (p.maintenanceEnabled) {
            planDesc += ` | Maintenance: ₹${p.maintenancePriceINR}/${p.maintenanceInterval.toLowerCase()} (${p.maintenanceStartRule})`;
          }
          if (p.isPopular) planDesc += " [POPULAR]";
          lines.push(planDesc);
        }
      } else {
        lines.push("  Pricing: Contact team / default one-time");
      }

      // Configuration Schema
      if (auto.configFields.length > 0) {
        lines.push("  Required/Configurable Workspace Fields:");
        for (const f of auto.configFields) {
          let fieldDesc = `    * ${f.label} (\`${f.key}\`, type: ${f.type}) - ${f.required ? "REQUIRED" : "Optional"}`;
          if (f.isSensitive) fieldDesc += " [SENSITIVE CREDENTIAL - Stored in Encrypted Vault]";
          if (f.helpText) fieldDesc += ` (${f.helpText})`;
          lines.push(fieldDesc);
        }
      } else {
        lines.push("  Workspace Fields: No custom fields required.");
      }
      lines.push("");
    }
  }

  // User Workspace (if authenticated)
  if (ctx.userWorkspace && ctx.userWorkspace.length > 0) {
    lines.push("#### AUTHENTICATED USER'S OWNED WORKSPACE STATE (STRICTLY PRIVATE TO CURRENT USER):");
    for (const uw of ctx.userWorkspace) {
      lines.push(`- Automation: "${uw.automationTitle}" (\`/my-automations/${uw.slug}\`)`);
      lines.push(`  Workspace Config Status: ${uw.status} (Config Saved: ${uw.hasSavedConfig ? "Yes" : "No"})`);
      lines.push(`  Entitlement Status: ${uw.entitlementStatus} (Lifetime: ${uw.isLifetime ? "Yes" : "No"})`);
      if (uw.remainingDays !== null) lines.push(`  Access Remaining: ${uw.remainingDays} days`);
      if (uw.lastExecutionStatus) {
        lines.push(`  Last Execution Status: ${uw.lastExecutionStatus} at ${uw.lastExecutionAt}`);
      }
      if (uw.lastExecutionError) {
        lines.push(`  Last Execution Note: ${uw.lastExecutionError}`);
      }
    }
    lines.push("");
  }

  // Admin Support Knowledge & FAQs
  lines.push("#### OFFICIAL SUPPORT FAQS & POLICIES (SUPPLEMENTAL):");
  for (const faq of ctx.adminKnowledge.faqs) {
    lines.push(`Q: ${faq.question}`);
    lines.push(`A: ${faq.answer}`);
  }
  if (ctx.adminKnowledge.troubleshootingTips && ctx.adminKnowledge.troubleshootingTips.length > 0) {
    lines.push("Troubleshooting Tips:");
    for (const tip of ctx.adminKnowledge.troubleshootingTips) {
      lines.push(`- ${tip}`);
    }
  }
  lines.push(`Refund Policy: ${ctx.adminKnowledge.policies.refundPolicy}`);
  lines.push(`Maintenance Policy: ${ctx.adminKnowledge.policies.maintenancePolicy}`);

  return lines.join("\n");
}
