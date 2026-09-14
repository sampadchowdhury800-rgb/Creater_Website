/**
 * lib/integrations/grant-service.ts
 *
 * Minting, atomic consumption, read-only validation, and lifecycle management
 * for AutomationExecutionGrants.
 * SERVER-SIDE ONLY.
 */

import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { prisma } from "../prisma";
import type { SupportedCapability } from "./types";
import { env } from "../env";

export const GRANT_TTL_MS = 5 * 60 * 1000; // 5-minute transient grant TTL

export interface MintGrantParams {
  clerkUserId: string;
  userAutomationId: string;
  automationExecutionId: string;
  integrationConnectionId: string;
  allowedCapability: SupportedCapability;
}

export interface MintGrantResult {
  rawGrantToken: string;
  expiresAt: Date;
}

export interface ConsumeGrantResult {
  success: boolean;
  grant?: any;
  errorCode?: "GRANT_INVALID" | "GRANT_EXPIRED" | "GRANT_ALREADY_CONSUMED";
  errorMessage?: string;
}

export interface ValidateGrantResult {
  valid: boolean;
  grant?: any;
  errorCode?:
    | "GRANT_INVALID"
    | "GRANT_EXPIRED"
    | "GRANT_ALREADY_FINALIZED"
    | "TENANT_MISMATCH"
    | "CAPABILITY_NOT_ALLOWED";
  errorMessage?: string;
}

/**
 * Computes the SHA-256 hash of a raw grant token.
 */
export function hashGrantToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Mints an ephemeral execution grant (5-minute TTL).
 * Scoped strictly to the specific customer, workspace, execution ID, and capability.
 */
export async function mintExecutionGrant(params: MintGrantParams): Promise<MintGrantResult> {
  const rawGrantToken = randomBytes(32).toString("hex");
  const grantTokenHash = hashGrantToken(rawGrantToken);
  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);

  await prisma.automationExecutionGrant.create({
    data: {
      grantTokenHash,
      clerkUserId: params.clerkUserId,
      userAutomationId: params.userAutomationId,
      automationExecutionId: params.automationExecutionId,
      integrationConnectionId: params.integrationConnectionId,
      allowedCapability: params.allowedCapability,
      status: "ISSUED",
      expiresAt,
    },
  });

  return { rawGrantToken, expiresAt };
}

/**
 * Validates an execution grant without burning it (read-only/idempotent).
 * Verifies token integrity, 5-minute expiration, non-terminal status,
 * tenant isolation, and capability authorization.
 */
export async function validateExecutionGrant(
  rawGrantToken: string,
  options?: {
    requiredTenantId?: string;
    requiredCapability?: SupportedCapability | string;
  }
): Promise<ValidateGrantResult> {
  if (!rawGrantToken || typeof rawGrantToken !== "string") {
    return {
      valid: false,
      errorCode: "GRANT_INVALID",
      errorMessage: "Execution grant token is required.",
    };
  }

  const grantTokenHash = hashGrantToken(rawGrantToken);
  const now = new Date();

  const grant = await prisma.automationExecutionGrant.findUnique({
    where: { grantTokenHash },
    include: {
      integrationConnection: true,
      userAutomation: {
        include: {
          automation: {
            select: { id: true, isExecutable: true, status: true, slug: true, title: true },
          },
        },
      },
      automationExecution: true,
    },
  });

  if (!grant) {
    return {
      valid: false,
      errorCode: "GRANT_INVALID",
      errorMessage: "Invalid execution grant.",
    };
  }

  if (grant.expiresAt.getTime() <= now.getTime()) {
    return {
      valid: false,
      errorCode: "GRANT_EXPIRED",
      errorMessage: "Execution grant has expired (5m TTL).",
    };
  }

  if (grant.status === "SUCCEEDED" || grant.status === "FAILED") {
    return {
      valid: false,
      errorCode: "GRANT_ALREADY_FINALIZED",
      errorMessage: "Execution grant has already been finalized.",
    };
  }

  if (options?.requiredTenantId && grant.clerkUserId !== options.requiredTenantId) {
    return {
      valid: false,
      errorCode: "TENANT_MISMATCH",
      errorMessage: "Tenant ID mismatch for execution grant.",
    };
  }

  if (options?.requiredCapability) {
    const isSupportPipelineGrant =
      grant.allowedCapability === "SUPPORT_AI" ||
      grant.allowedCapability === "SUPPORT_AUTOMATION" ||
      grant.allowedCapability.includes(options.requiredCapability);

    const matchesDirect = grant.allowedCapability === options.requiredCapability;

    if (!matchesDirect && !isSupportPipelineGrant) {
      return {
        valid: false,
        errorCode: "CAPABILITY_NOT_ALLOWED",
        errorMessage: `Grant allows capability "${grant.allowedCapability}", but "${options.requiredCapability}" is required.`,
      };
    }
  }

  return { valid: true, grant };
}

/**
 * Transitions an active grant to PROCESSING state without burning/finalizing it.
 */
export async function markGrantProcessing(
  grantId: string,
  clientIp?: string
): Promise<void> {
  const now = new Date();
  await prisma.automationExecutionGrant.updateMany({
    where: {
      id: grantId,
      status: "ISSUED",
    },
    data: {
      status: "PROCESSING",
      processingStartedAt: now,
      consumedByIp: clientIp || null,
    },
  }).catch(() => {});
}

/**
 * Atomically consumes an execution grant via PostgreSQL row locking (`updateMany`).
 * Ensures concurrent or replayed single-step requests can NEVER double-consume the grant.
 */
export async function atomicallyConsumeGrant(
  rawGrantToken: string,
  clientIp?: string
): Promise<ConsumeGrantResult> {
  if (!rawGrantToken || typeof rawGrantToken !== "string") {
    return { success: false, errorCode: "GRANT_INVALID", errorMessage: "Execution grant token is required." };
  }

  const grantTokenHash = hashGrantToken(rawGrantToken);
  const now = new Date();

  const result = await prisma.automationExecutionGrant.updateMany({
    where: {
      grantTokenHash,
      status: "ISSUED",
      expiresAt: { gt: now },
    },
    data: {
      status: "PROCESSING",
      consumedAt: now,
      consumedByIp: clientIp || null,
      processingStartedAt: now,
    },
  });

  if (result.count !== 1) {
    const existing = await prisma.automationExecutionGrant.findUnique({
      where: { grantTokenHash },
      select: { status: true, expiresAt: true },
    });

    if (!existing) {
      return { success: false, errorCode: "GRANT_INVALID", errorMessage: "Invalid execution grant." };
    }
    if (existing.expiresAt.getTime() <= now.getTime()) {
      return { success: false, errorCode: "GRANT_EXPIRED", errorMessage: "Execution grant has expired (5m TTL)." };
    }
    return {
      success: false,
      errorCode: "GRANT_ALREADY_CONSUMED",
      errorMessage: "Execution grant was already consumed.",
    };
  }

  const grant = await prisma.automationExecutionGrant.findUniqueOrThrow({
    where: { grantTokenHash },
    include: {
      integrationConnection: true,
      userAutomation: {
        include: {
          automation: {
            select: { id: true, isExecutable: true, status: true },
          },
        },
      },
    },
  });

  return { success: true, grant };
}

/**
 * Marks an execution grant as SUCCEEDED or FAILED upon completion.
 */
export async function finalizeGrant(grantId: string, status: "SUCCEEDED" | "FAILED"): Promise<void> {
  await prisma.automationExecutionGrant.update({
    where: { id: grantId },
    data: { status, consumedAt: new Date() },
  }).catch(() => {});
}

/**
 * Constant-time comparison for gateway shared secret authentication.
 * Supports dual-secret rotation (current,retiring).
 */
export function verifyGatewaySharedSecret(
  headerSecret: string | null,
  secretOverride?: string
): boolean {
  if (!headerSecret || typeof headerSecret !== "string") return false;

  const configuredSecret = secretOverride || env.CHOWDHURY_DUO_GATEWAY_SECRET;
  if (!configuredSecret) {
    return false;
  }

  const candidateBuffer = Buffer.from(headerSecret, "utf8");
  const allowedSecrets = configuredSecret.split(",").map((s) => s.trim()).filter(Boolean);

  for (const validSecret of allowedSecrets) {
    const validBuffer = Buffer.from(validSecret, "utf8");
    if (candidateBuffer.length === validBuffer.length && timingSafeEqual(candidateBuffer, validBuffer)) {
      return true;
    }
  }

  return false;
}
