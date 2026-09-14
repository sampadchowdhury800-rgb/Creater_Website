/**
 * User automation configuration save action.
 *
 * SECURITY:
 * - Clerk auth: getCurrentUserId() server-side only.
 * - Ownership: UserAutomation must belong to the authenticated user.
 * - Schema validation: input is validated against Automation.configSchema
 *   (loaded from DB — client cannot redefine allowed fields).
 * - SENSITIVE FIELDS (sensitive: true in configSchema):
 *     → Encrypted via AES-256-GCM (lib/crypto/vault.ts)
 *     → Stored in UserAutomationSecret table (not in UserAutomation.config)
 *     → UserAutomation.config receives only a safe placeholder:
 *         { __isSecret: true, configured: true, lastUpdated: "..." }
 * - NON-SENSITIVE FIELDS:
 *     → Stored as JSON in UserAutomation.config (unchanged from previous behavior)
 *
 * PLAINTEXT SENTINEL:
 *   If a sensitive field value is "" / null / undefined / "__KEEP_EXISTING__",
 *   the existing secret is NOT overwritten. This allows partial config updates
 *   without re-entering credentials every time.
 */
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { validateExecutionInput } from "@/lib/automation/validation";
import { saveUserSecrets } from "@/lib/automation/vault-service";

export interface SaveConfigResult {
  success: boolean;
  error?: string;
}

/**
 * Saves user configuration for a UserAutomation workspace.
 *
 * Sensitive fields are encrypted and stored in UserAutomationSecret.
 * Non-sensitive fields are stored in UserAutomation.config.
 *
 * @param userAutomationId - The ID of the UserAutomation record to update.
 * @param config - The user-supplied configuration values.
 */
export async function saveUserAutomationConfig(
  userAutomationId: string,
  config: Record<string, unknown>
): Promise<SaveConfigResult> {
  // ─── Auth ────────────────────────────────────────────────────────────────────
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return { success: false, error: "Authentication required." };
  }

  if (!userAutomationId || typeof userAutomationId !== "string") {
    return { success: false, error: "Invalid request." };
  }

  try {
    // ─── Ownership + schema load ──────────────────────────────────────────────
    const userAutomation = await prisma.userAutomation.findUnique({
      where: { id: userAutomationId },
      include: {
        automation: {
          select: { configSchema: true, isExecutable: true },
        },
      },
    });

    if (!userAutomation) {
      return { success: false, error: "Automation workspace not found." };
    }

    // IDOR protection
    if (userAutomation.clerkUserId !== clerkUserId) {
      return { success: false, error: "Access denied." };
    }

    const configSchema = userAutomation.automation?.configSchema;

    // ─── Schema validation ────────────────────────────────────────────────────
    // Validate the input against the Automation's configSchema loaded from DB.
    // The browser cannot redefine which fields are allowed or required.
    //
    // Note: For sensitive fields, the validator sees either a string value
    // (first-time entry) or a placeholder object (keep-existing). Both are
    // considered "present" for required-field validation purposes, which is
    // handled in the vault-service layer below.
    const validationResult = validateExecutionInput(configSchema, config);

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.errorMessage ?? "Invalid configuration.",
      };
    }

    // ─── Vault: separate sensitive from normal fields ──────────────────────────
    // saveUserSecrets() handles:
    //   - Sensitive field encryption → UserAutomationSecret (upsert)
    //   - Returning safeConfig with placeholders for sensitive fields
    //   - Verifying ownership (redundant here but defense-in-depth)
    const vaultResult = await saveUserSecrets(
      clerkUserId,
      userAutomationId,
      configSchema,
      config
    );

    if (!vaultResult.success) {
      return { success: false, error: vaultResult.error ?? "Failed to save credentials." };
    }

    // safeConfig has sensitive fields replaced with placeholders
    const safeConfig = vaultResult.safeConfig ?? config;

    // ─── Save config ──────────────────────────────────────────────────────────
    // Only update config. Do not overwrite status unless transitioning from NOT_CONFIGURED.
    await prisma.userAutomation.update({
      where: { id: userAutomationId },
      data: {
        config: safeConfig as any,
        // Promote from NOT_CONFIGURED to ACTIVE once the user saves a config
        status:
          userAutomation.status === "NOT_CONFIGURED" ? "ACTIVE" : userAutomation.status,
      },
    });

    return { success: true };
  } catch (error) {
    // SECURITY: Do not log config values — they may contain sensitive input before
    // the vault layer has had a chance to strip them.
    console.error("[saveUserAutomationConfig] Unexpected error during config save.");
    return { success: false, error: "Failed to save configuration. Please try again." };
  }
}
