/**
 * lib/integrations/gmail-credential-service.ts
 *
 * Secure retrieval and decryption of stored Gmail credentials (email + App Password).
 *
 * SECURITY INVARIANTS:
 * - Credentials are stored encrypted at rest using AES-256-GCM via the vault module.
 * - Decrypted App Passwords are kept in-memory only and never logged or serialized.
 * - Tenant isolation is strictly enforced via expectedClerkUserId checks.
 * - accessTokenEncrypted is used as encrypted credential storage; it is NOT an OAuth token.
 */

import { prisma } from "@/lib/prisma";
import { vaultDecrypt } from "@/lib/crypto/vault";

export class IntegrationConnectionError extends Error {
  public errorCode: string;
  constructor(message: string, errorCode: string = "INTEGRATION_ERROR") {
    super(message);
    this.name = "IntegrationConnectionError";
    this.errorCode = errorCode;
  }
}

export interface GmailCredentials {
  email: string;
  appPassword: string;
}

/**
 * Retrieves and decrypts the Gmail credentials for a given connection ID.
 *
 * @param connectionId The ID of the IntegrationConnection record.
 * @param expectedClerkUserId Optional Clerk user ID for tenant isolation verification.
 * @returns An object containing the Gmail address and decrypted App Password.
 * @throws IntegrationConnectionError if not found, inactive, tenant mismatch, or decryption fails.
 */
export async function getGmailAppPassword(
  connectionId: string,
  expectedClerkUserId?: string
): Promise<GmailCredentials> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      clerkUserId: true,
      provider: true,
      accountEmail: true,
      status: true,
      vaultVersion: true,
      accessTokenEncrypted: true,
      accessTokenIv: true,
      accessTokenAuthTag: true,
    },
  });

  if (!connection) {
    console.warn("[Gmail Credentials] Connection not found", { connectionId });
    throw new IntegrationConnectionError(
      "Integration connection not found",
      "CONNECTION_NOT_FOUND"
    );
  }

  // Tenant isolation check
  if (expectedClerkUserId && connection.clerkUserId !== expectedClerkUserId) {
    console.warn("[Gmail Credentials] Tenant mismatch detected", {
      connectionId,
      expected: expectedClerkUserId,
      actual: connection.clerkUserId,
    });
    throw new IntegrationConnectionError(
      "Tenant isolation violation: connection does not belong to user",
      "TENANT_MISMATCH"
    );
  }

  // Connection status check
  if (connection.status !== "CONNECTED") {
    console.warn("[Gmail Credentials] Connection is not active", {
      connectionId,
      status: connection.status,
    });
    throw new IntegrationConnectionError(
      `Connection is not active (status: ${connection.status})`,
      "CONNECTION_INACTIVE"
    );
  }

  // Credential presence check
  if (
    !connection.accessTokenEncrypted ||
    !connection.accessTokenIv ||
    !connection.accessTokenAuthTag
  ) {
    console.error("[Gmail Credentials] Missing encrypted credential data", {
      connectionId,
    });
    throw new IntegrationConnectionError(
      "Missing stored credential data for connection",
      "CREDENTIAL_MISSING"
    );
  }

  // Decrypt the stored App Password via vault
  let appPassword = "";
  try {
    appPassword = vaultDecrypt({
      version: connection.vaultVersion,
      iv: connection.accessTokenIv,
      authTag: connection.accessTokenAuthTag,
      encryptedValue: connection.accessTokenEncrypted,
    });
  } catch (decErr: any) {
    console.error("[Gmail Credentials] Vault decryption failed", {
      connectionId,
      error: decErr?.message,
    });
    throw new IntegrationConnectionError(
      "Failed to decrypt stored credentials",
      "DECRYPTION_FAILED"
    );
  }

  if (!appPassword) {
    throw new IntegrationConnectionError(
      "Decrypted credential value was empty",
      "DECRYPTION_FAILED"
    );
  }

  const email = connection.accountEmail;
  if (!email) {
    throw new IntegrationConnectionError(
      "Account email is missing on connection record",
      "ACCOUNT_EMAIL_MISSING"
    );
  }

  return {
    email,
    appPassword,
  };
}
