/**
 * lib/automation/vault-service.ts — Automation Secret Vault Service
 *
 * SERVER-SIDE ONLY. Orchestrates all read/write operations for sensitive
 * automation credential fields.
 *
 * RESPONSIBILITIES:
 *   1. saveUserSecrets()         — Verify ownership, encrypt sensitive fields,
 *                                  upsert into UserAutomationSecret, return safe config.
 *   2. getDecryptedSecretsForExecution() — Decrypt secrets in-memory for n8n dispatch.
 *   3. deleteUserSecret()        — Delete a single encrypted secret.
 *   4. getUserSecretStatus()     — Return safe status metadata (never plaintext).
 *   5. maskSensitiveInput()      — Strip sensitive fields before saving execution logs.
 *
 * IDOR PROTECTION:
 *   Every function that touches secrets verifies the full ownership chain:
 *     Clerk userId → UserAutomation.clerkUserId → UserAutomationSecret.userAutomationId
 *
 * NEVER:
 *   - Return plaintext secret values to callers outside this module.
 *   - Log plaintext secret values.
 *   - Accept clerkUserId from client input — always derive from Clerk session.
 */

import { prisma } from "@/lib/prisma";
import {
  vaultEncrypt,
  vaultDecrypt,
  buildSecretConfigPlaceholder,
  isSecretPlaceholder,
  type EncryptedPayload,
} from "@/lib/crypto/vault";
import { isConfigSchema, type ConfigSchema } from "@/lib/automation/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecretFieldStatus {
  key: string;
  configured: boolean;
  lastUpdated?: string;
}

export interface VaultSaveResult {
  success: boolean;
  error?: string;
  /** Safe config to store in UserAutomation.config (no plaintext secrets) */
  safeConfig?: Record<string, unknown>;
}

export interface VaultSecretsForExecution {
  /** Decrypted secrets keyed by field.key. Server-side use only. */
  secrets: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns fields from configSchema that are marked sensitive: true.
 */
function getSensitiveFieldKeys(configSchema: unknown): Set<string> {
  if (!isConfigSchema(configSchema)) return new Set();
  return new Set(
    configSchema.fields
      .filter((f) => f.sensitive === true)
      .map((f) => f.key)
  );
}

/**
 * Verifies that the given userAutomationId belongs to the given clerkUserId.
 *
 * Returns the UserAutomation record on success, or null on failure.
 *
 * IDOR: This must be called before any secret read/write/delete operation.
 */
async function verifyOwnership(clerkUserId: string, userAutomationId: string) {
  const userAutomation = await prisma.userAutomation.findUnique({
    where: { id: userAutomationId },
    include: {
      automation: {
        select: { configSchema: true, isExecutable: true },
      },
    },
  });

  if (!userAutomation) return null;

  // Strict ownership — never trust caller's clerkUserId claim beyond this check
  if (userAutomation.clerkUserId !== clerkUserId) return null;

  return userAutomation;
}

// ─── Save / Upsert Secrets ────────────────────────────────────────────────────

/**
 * Processes user-submitted configuration for a UserAutomation workspace.
 *
 * For SENSITIVE fields:
 *   - If the value is a non-empty string: encrypt and upsert into UserAutomationSecret.
 *     Replace the value in the returned safeConfig with a placeholder.
 *   - If the value is empty string, undefined, null, or "__KEEP_EXISTING__":
 *     Do NOT overwrite the existing secret. Preserve existing placeholder.
 *   - If the value is already a placeholder object: preserve it as-is.
 *
 * For NON-SENSITIVE fields:
 *   - Pass through normally into safeConfig.
 *
 * @param clerkUserId - Derived from Clerk session (never trust client input)
 * @param userAutomationId - The workspace to update
 * @param configSchema - The automation's schema (loaded from DB)
 * @param input - User-submitted form values
 * @returns VaultSaveResult with safeConfig (no plaintext secrets)
 */
export async function saveUserSecrets(
  clerkUserId: string,
  userAutomationId: string,
  configSchema: unknown,
  input: Record<string, unknown>
): Promise<VaultSaveResult> {
  // ─── Ownership verification ───────────────────────────────────────────────
  const userAutomation = await verifyOwnership(clerkUserId, userAutomationId);
  if (!userAutomation) {
    return { success: false, error: "Access denied." };
  }

  const sensitiveKeys = getSensitiveFieldKeys(configSchema);
  const existingConfig = (userAutomation.config ?? {}) as Record<string, unknown>;
  const safeConfig: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!sensitiveKeys.has(key)) {
      // Normal field — pass through
      safeConfig[key] = value;
      continue;
    }

    // Sensitive field handling
    const isKeepSentinel =
      value === "__KEEP_EXISTING__" ||
      value === "" ||
      value === null ||
      value === undefined;

    const isAlreadyPlaceholder = isSecretPlaceholder(value);

    if (isKeepSentinel || isAlreadyPlaceholder) {
      // Don't overwrite existing secret — preserve existing placeholder in config
      if (existingConfig[key] !== undefined) {
        safeConfig[key] = existingConfig[key];
      } else {
        // No existing secret — just leave the field absent from config
        // (do not store placeholder if no secret has been configured yet)
      }
      continue;
    }

    if (typeof value !== "string" || value.trim() === "") {
      // Reject non-string sensitive values
      return {
        success: false,
        error: `Sensitive field "${key}" must be a non-empty string value.`,
      };
    }

    // Encrypt and upsert into vault
    try {
      const payload: EncryptedPayload = vaultEncrypt(value);

      await prisma.userAutomationSecret.upsert({
        where: {
          userAutomationId_key: {
            userAutomationId,
            key,
          },
        },
        create: {
          userAutomationId,
          key,
          encryptedValue: payload.encryptedValue,
          iv: payload.iv,
          authTag: payload.authTag,
          version: payload.version,
          metadata: { hint: "configured" },
        },
        update: {
          encryptedValue: payload.encryptedValue,
          iv: payload.iv,
          authTag: payload.authTag,
          version: payload.version,
          metadata: { hint: "configured" },
        },
      });

      // Store safe placeholder in config (never the plaintext value)
      safeConfig[key] = buildSecretConfigPlaceholder(new Date());
    } catch (err) {
      // Log error server-side but NEVER log the value
      console.error(`[VaultService] Failed to encrypt secret for key "${key}":`, err);
      return {
        success: false,
        error: "Failed to securely store sensitive credential. Please try again.",
      };
    }
  }

  return { success: true, safeConfig };
}

// ─── Get Decrypted Secrets for Execution ─────────────────────────────────────

/**
 * Retrieves and decrypts all secrets for a UserAutomation.
 *
 * FOR SERVER-SIDE EXECUTION USE ONLY.
 * Do NOT pass the result (or any part of it) to the browser, client components,
 * API responses, or logs.
 *
 * Callers MUST independently verify ownership before calling this function.
 * (ExecutionService already does this via authorizeAutomationExecution.)
 *
 * @param userAutomationId - The workspace to retrieve secrets for
 * @returns Record of { fieldKey: decryptedPlaintext } — keep in server memory only
 * @throws If decryption fails (wrong key, tampering)
 */
export async function getDecryptedSecretsForExecution(
  userAutomationId: string
): Promise<Record<string, string>> {
  const secrets = await prisma.userAutomationSecret.findMany({
    where: { userAutomationId },
  });

  const decrypted: Record<string, string> = {};

  for (const secret of secrets) {
    try {
      const payload: EncryptedPayload = {
        version: secret.version,
        iv: secret.iv,
        authTag: secret.authTag,
        encryptedValue: secret.encryptedValue,
      };

      // vaultDecrypt throws on tampering or wrong key
      decrypted[secret.key] = vaultDecrypt(payload);
    } catch (err) {
      // Log the key name (non-sensitive) but NOT the value or payload details
      console.error(
        `[VaultService] Failed to decrypt secret for key "${secret.key}" ` +
          `in userAutomationId "${userAutomationId}":`,
        err instanceof Error ? err.message : "Unknown error"
      );
      throw new Error(
        `Credential decryption failed for field "${secret.key}". ` +
          "Please reconfigure this credential."
      );
    }
  }

  return decrypted;
}

// ─── Delete a Single Secret ───────────────────────────────────────────────────

/**
 * Deletes a single encrypted secret, verified by ownership.
 *
 * @param clerkUserId - Server-derived Clerk user ID
 * @param userAutomationId - The workspace
 * @param key - The field key of the secret to delete
 */
export async function deleteUserSecret(
  clerkUserId: string,
  userAutomationId: string,
  key: string
): Promise<{ success: boolean; error?: string }> {
  // Ownership check
  const owned = await verifyOwnership(clerkUserId, userAutomationId);
  if (!owned) {
    return { success: false, error: "Access denied." };
  }

  try {
    await prisma.userAutomationSecret.deleteMany({
      where: { userAutomationId, key },
    });
    return { success: true };
  } catch (err) {
    console.error(`[VaultService] Failed to delete secret for key "${key}":`, err);
    return { success: false, error: "Failed to delete credential." };
  }
}

// ─── Get Secret Status (Safe Metadata Only) ───────────────────────────────────

/**
 * Returns safe status metadata for all configured secrets in a UserAutomation.
 * NEVER returns plaintext values.
 *
 * @param clerkUserId - Server-derived Clerk user ID
 * @param userAutomationId - The workspace
 * @returns Array of { key, configured, lastUpdated } — safe to send to client
 */
export async function getUserSecretStatuses(
  clerkUserId: string,
  userAutomationId: string
): Promise<SecretFieldStatus[]> {
  const owned = await verifyOwnership(clerkUserId, userAutomationId);
  if (!owned) return [];

  const secrets = await prisma.userAutomationSecret.findMany({
    where: { userAutomationId },
    select: {
      key: true,
      updatedAt: true,
    },
  });

  return secrets.map((s) => ({
    key: s.key,
    configured: true,
    lastUpdated: s.updatedAt.toISOString(),
  }));
}

// ─── Mask Sensitive Fields for Execution Logs ─────────────────────────────────

/**
 * Strips sensitive field values from the execution input before persisting
 * to AutomationExecution.input in the database.
 *
 * Replaces sensitive fields with "[REDACTED]" so that execution history
 * records never contain plaintext credentials.
 *
 * @param input - Raw execution input
 * @param configSchema - The automation's config schema
 * @returns Sanitized input safe to store in DB / return to client
 */
export function maskSensitiveInput(
  input: Record<string, unknown>,
  configSchema: unknown
): Record<string, unknown> {
  const sensitiveKeys = getSensitiveFieldKeys(configSchema);
  if (sensitiveKeys.size === 0) return input;

  const masked: Record<string, unknown> = { ...input };
  for (const key of sensitiveKeys) {
    if (key in masked) {
      masked[key] = "[REDACTED]";
    }
  }
  return masked;
}

// ─── Schema Helper ────────────────────────────────────────────────────────────

/**
 * Returns true if the given configSchema has at least one sensitive field.
 */
export function schemaHasSensitiveFields(configSchema: unknown): boolean {
  if (!isConfigSchema(configSchema)) return false;
  return configSchema.fields.some((f) => f.sensitive === true);
}
