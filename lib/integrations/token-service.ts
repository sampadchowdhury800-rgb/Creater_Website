/**
 * lib/integrations/token-service.ts
 *
 * Concurrency-safe token management, AES-256-GCM decryption,
 * fenced lease refresh engine, and disconnect handling.
 * SERVER-SIDE ONLY.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { vaultEncrypt, vaultDecrypt, type EncryptedPayload } from "@/lib/crypto/vault";

// Legacy Google OAuth credentials (direct process.env — not routed through env module)
const LEGACY_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? null;
const LEGACY_GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? null;

export { getGmailAppPassword } from "./gmail-credential-service";
export type { GmailCredentials } from "./gmail-credential-service";

const LEASE_DURATION_MS = 25000; // 25-second lease
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5-minute pre-expiration refresh buffer
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export class ReconnectRequiredError extends Error {
  constructor(message = "Google authorization expired or was revoked. Please reconnect.") {
    super(message);
    this.name = "ReconnectRequiredError";
  }
}

export class IntegrationConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationConnectionError";
  }
}

/**
 * Attempts to acquire an atomic 25-second refresh lease on an IntegrationConnection.
 */
async function acquireRefreshLease(
  connectionId: string
): Promise<{ acquired: boolean; fenceToken?: string; version?: number }> {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
  const fenceToken = randomUUID();

  const updateResult = await prisma.integrationConnection.updateMany({
    where: {
      id: connectionId,
      OR: [
        { refreshLockUntil: null },
        { refreshLockUntil: { lt: now } },
      ],
    },
    data: {
      refreshLockUntil: leaseExpiresAt,
      refreshLockToken: fenceToken,
    },
  });

  if (updateResult.count !== 1) {
    return { acquired: false };
  }

  const connection = await prisma.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
    select: { tokenVersion: true },
  });

  return { acquired: true, fenceToken, version: connection.tokenVersion };
}

/**
 * Releases the refresh lease and atomically saves new tokens with stale-worker fencing.
 */
async function releaseRefreshLeaseWithUpdate(
  connectionId: string,
  fenceToken: string,
  expectedVersion: number,
  newEncryptedTokens: {
    accessToken: EncryptedPayload;
    refreshToken?: EncryptedPayload;
    tokenExpiresAt: Date;
    scopes?: string[];
  }
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    accessTokenEncrypted: newEncryptedTokens.accessToken.encryptedValue,
    accessTokenIv: newEncryptedTokens.accessToken.iv,
    accessTokenAuthTag: newEncryptedTokens.accessToken.authTag,
    tokenExpiresAt: newEncryptedTokens.tokenExpiresAt,
    tokenVersion: { increment: 1 },
    refreshLockUntil: null,
    refreshLockToken: null,
    lastRefreshedAt: new Date(),
    status: "CONNECTED",
    errorMessage: null,
  };

  // INVARIANT 13: Never overwrite valid refresh token with null/undefined when Google omits it
  if (newEncryptedTokens.refreshToken) {
    updateData.refreshTokenEncrypted = newEncryptedTokens.refreshToken.encryptedValue;
    updateData.refreshTokenIv = newEncryptedTokens.refreshToken.iv;
    updateData.refreshTokenAuthTag = newEncryptedTokens.refreshToken.authTag;
  }

  if (newEncryptedTokens.scopes && newEncryptedTokens.scopes.length > 0) {
    updateData.scopes = newEncryptedTokens.scopes;
  }

  const updated = await prisma.integrationConnection.updateMany({
    where: {
      id: connectionId,
      refreshLockToken: fenceToken,
      tokenVersion: expectedVersion, // Stale worker fence
    },
    data: updateData as any,
  });

  return updated.count === 1;
}

/**
 * Releases the lease without updating tokens (e.g. on network failure).
 */
async function releaseRefreshLeaseOnError(
  connectionId: string,
  fenceToken: string,
  errorStatus?: "EXPIRED" | "ERROR",
  errorMessage?: string
): Promise<void> {
  const data: Record<string, unknown> = {
    refreshLockUntil: null,
    refreshLockToken: null,
  };
  if (errorStatus) {
    data.status = errorStatus;
  }
  if (errorMessage) {
    data.errorMessage = errorMessage;
  }

  await prisma.integrationConnection.updateMany({
    where: {
      id: connectionId,
      refreshLockToken: fenceToken,
    },
    data: data as any,
  });
}

/**
 * Resolves, decrypts, and if necessary, refreshes a Google OAuth access token.
 *
 * GUARANTEES:
 * 1. Decrypted tokens are returned in memory only — never logged, never cached in outer scope.
 * 2. Token refresh is concurrency-safe across serverless/worker instances.
 * 3. Stale workers whose lease expired cannot overwrite newer tokens.
 * 4. Existing refresh tokens are preserved when Google omits refresh_token in response.
 * 5. Invalid grant immediately marks connection EXPIRED.
 */
export async function getValidAccessToken(
  connectionId: string,
  expectedClerkUserId?: string
): Promise<string> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new IntegrationConnectionError("Integration connection record not found.");
  }

  if (expectedClerkUserId && connection.clerkUserId !== expectedClerkUserId) {
    throw new IntegrationConnectionError("Access denied: Connection does not belong to user.");
  }

  if (connection.status === "DISCONNECTED") {
    throw new IntegrationConnectionError("This account was disconnected. Please reconnect.");
  }

  if (connection.status === "EXPIRED") {
    throw new ReconnectRequiredError();
  }

  const now = new Date();
  const isExpiringSoon = connection.tokenExpiresAt.getTime() <= now.getTime() + EXPIRY_BUFFER_MS;

  // If token is still valid with > 5 min buffer, decrypt and return immediately
  if (!isExpiringSoon && connection.accessTokenEncrypted) {
    try {
      return vaultDecrypt({
        version: connection.vaultVersion,
        iv: connection.accessTokenIv,
        authTag: connection.accessTokenAuthTag,
        encryptedValue: connection.accessTokenEncrypted,
      });
    } catch {
      // If decryption fails, fall through to refresh
    }
  }

  // Token is expired or expiring soon — execute fenced refresh
  const lease = await acquireRefreshLease(connectionId);

  if (!lease.acquired) {
    // Another worker is actively refreshing. Wait 1500ms and re-query DB for fresh token.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const refreshed = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
    });
    if (refreshed && refreshed.status === "CONNECTED" && refreshed.tokenExpiresAt.getTime() > now.getTime()) {
      return vaultDecrypt({
        version: refreshed.vaultVersion,
        iv: refreshed.accessTokenIv,
        authTag: refreshed.accessTokenAuthTag,
        encryptedValue: refreshed.accessTokenEncrypted,
      });
    }
    throw new IntegrationConnectionError("Token refresh in progress by another worker. Please retry.");
  }

  const { fenceToken, version } = lease;

  try {
    // Decrypt existing refresh token
    const refreshToken = vaultDecrypt({
      version: connection.vaultVersion,
      iv: connection.refreshTokenIv,
      authTag: connection.refreshTokenAuthTag,
      encryptedValue: connection.refreshTokenEncrypted,
    });

    const clientId = LEGACY_GOOGLE_CLIENT_ID;
    const clientSecret = LEGACY_GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new IntegrationConnectionError("Google OAuth client is not configured.");
    }

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(10000), // 10s strict timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = (errorData as Record<string, unknown>).error;

      if (errorCode === "invalid_grant") {
        await releaseRefreshLeaseOnError(connectionId, fenceToken!, "EXPIRED", "Google authorization revoked.");
        throw new ReconnectRequiredError();
      }

      await releaseRefreshLeaseOnError(connectionId, fenceToken!, "ERROR", "Failed to refresh token with Google.");
      throw new IntegrationConnectionError(`Upstream token refresh failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number; // seconds
      refresh_token?: string;
      scope?: string;
    };

    const newAccessTokenEncrypted = vaultEncrypt(data.access_token);
    const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

    let newRefreshTokenEncrypted: EncryptedPayload | undefined = undefined;
    if (data.refresh_token && data.refresh_token.trim()) {
      newRefreshTokenEncrypted = vaultEncrypt(data.refresh_token.trim());
    }

    const newScopes = data.scope ? data.scope.split(" ").filter(Boolean) : undefined;

    const saved = await releaseRefreshLeaseWithUpdate(connectionId, fenceToken!, version!, {
      accessToken: newAccessTokenEncrypted,
      refreshToken: newRefreshTokenEncrypted,
      tokenExpiresAt: newExpiresAt,
      scopes: newScopes,
    });

    if (!saved) {
      // Stale worker write rejected — another worker must have refreshed in the meantime
      console.warn(`[TokenService] Stale refresh write rejected for connection ${connectionId}.`);
    }

    return data.access_token;
  } catch (err) {
    if (err instanceof ReconnectRequiredError || err instanceof IntegrationConnectionError) {
      throw err;
    }
    await releaseRefreshLeaseOnError(connectionId, fenceToken!, "ERROR", "Network or runtime error during refresh.");
    throw new IntegrationConnectionError("Failed to refresh Google authorization.");
  }
}

/**
 * Disconnects an integration connection, scrubs credentials, and unlinks workspaces.
 */
export async function disconnectIntegration(
  clerkUserId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, clerkUserId },
  });

  if (!connection) {
    return { success: false, error: "Connection not found." };
  }

  // Best-effort Google revocation
  try {
    if (connection.refreshTokenEncrypted && connection.status !== "DISCONNECTED") {
      const refreshToken = vaultDecrypt({
        version: connection.vaultVersion,
        iv: connection.refreshTokenIv,
        authTag: connection.refreshTokenAuthTag,
        encryptedValue: connection.refreshTokenEncrypted,
      });

      await fetch(GOOGLE_REVOKE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  } catch {
    // Fail-closed locally even if Google revoke fails
  }

  // Find all affected workspaces before deleting bindings
  const affectedBindings = await prisma.userAutomationIntegration.findMany({
    where: { integrationConnectionId: connectionId },
    select: { userAutomationId: true },
  });

  // Scrub tokens and mark DISCONNECTED in transaction
  await prisma.$transaction([
    prisma.userAutomationIntegration.deleteMany({
      where: { integrationConnectionId: connectionId },
    }),
    prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        status: "DISCONNECTED",
        accessTokenEncrypted: "",
        accessTokenIv: "",
        accessTokenAuthTag: "",
        refreshTokenEncrypted: "",
        refreshTokenIv: "",
        refreshTokenAuthTag: "",
        errorMessage: "Disconnected by user.",
      },
    }),
  ]);

  // If any affected workspace now has no active integrations, revert to NOT_CONFIGURED
  for (const binding of affectedBindings) {
    const remainingCount = await prisma.userAutomationIntegration.count({
      where: { userAutomationId: binding.userAutomationId },
    });
    if (remainingCount === 0) {
      await prisma.userAutomation.update({
        where: { id: binding.userAutomationId },
        data: { status: "NOT_CONFIGURED" },
      });
    }
  }

  return { success: true };
}
