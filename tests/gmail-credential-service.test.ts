/**
 * tests/gmail-credential-service.test.ts
 *
 * Unit tests for Gmail credential decryption and tenant isolation:
 * - AES-256-GCM vault encryption and decryption
 * - Tenant isolation verification (tenant mismatch rejection)
 * - Inactive connection rejection
 * - Missing credential rejection
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import { vaultEncrypt, vaultDecrypt } from "../lib/crypto/vault";
import {
  getGmailAppPassword,
  IntegrationConnectionError,
} from "../lib/integrations/gmail-credential-service";
import { prisma } from "../lib/prisma";

describe("Gmail Credential Service Tests", () => {
  const originalFindUnique = prisma.integrationConnection.findUnique;

  test("vaultEncrypt and vaultDecrypt round-trip preserves App Password exactly", () => {
    const originalPassword = "abcd efgh ijkl mnop";
    const encrypted = vaultEncrypt(originalPassword);

    assert.ok(encrypted.encryptedValue, "Encrypted value should be generated");
    assert.ok(encrypted.iv, "IV should be generated");
    assert.ok(encrypted.authTag, "Auth tag should be generated");
    assert.notStrictEqual(encrypted.encryptedValue, originalPassword);

    const decrypted = vaultDecrypt(encrypted);
    assert.strictEqual(decrypted, originalPassword);
  });

  test("getGmailAppPassword enforces tenant isolation", async () => {
    const enc = vaultEncrypt("my-secret-app-password");

    // Mock prisma.integrationConnection.findUnique
    (prisma.integrationConnection.findUnique as any) = async () => ({
      id: "conn_123",
      clerkUserId: "user_owner_abc",
      provider: "GOOGLE",
      accountEmail: "owner@gmail.com",
      status: "CONNECTED",
      vaultVersion: 1,
      accessTokenEncrypted: enc.encryptedValue,
      accessTokenIv: enc.iv,
      accessTokenAuthTag: enc.authTag,
    });

    try {
      // Calling with a different user ID must throw a TENANT_MISMATCH error
      await assert.rejects(
        async () => {
          await getGmailAppPassword("conn_123", "attacker_user_xyz");
        },
        (err: any) => {
          assert.ok(err instanceof IntegrationConnectionError);
          assert.strictEqual(err.errorCode, "TENANT_MISMATCH");
          return true;
        }
      );
    } finally {
      prisma.integrationConnection.findUnique = originalFindUnique;
    }
  });

  test("getGmailAppPassword rejects inactive connections", async () => {
    const enc = vaultEncrypt("my-secret-app-password");

    (prisma.integrationConnection.findUnique as any) = async () => ({
      id: "conn_123",
      clerkUserId: "user_owner_abc",
      provider: "GOOGLE",
      accountEmail: "owner@gmail.com",
      status: "DISCONNECTED",
      vaultVersion: 1,
      accessTokenEncrypted: enc.encryptedValue,
      accessTokenIv: enc.iv,
      accessTokenAuthTag: enc.authTag,
    });

    try {
      await assert.rejects(
        async () => {
          await getGmailAppPassword("conn_123", "user_owner_abc");
        },
        (err: any) => {
          assert.ok(err instanceof IntegrationConnectionError);
          assert.strictEqual(err.errorCode, "CONNECTION_INACTIVE");
          return true;
        }
      );
    } finally {
      prisma.integrationConnection.findUnique = originalFindUnique;
    }
  });

  test("getGmailAppPassword successfully decrypts valid connection credentials", async () => {
    const rawPassword = "pass-word-secret-123";
    const enc = vaultEncrypt(rawPassword);

    (prisma.integrationConnection.findUnique as any) = async () => ({
      id: "conn_123",
      clerkUserId: "user_owner_abc",
      provider: "GOOGLE",
      accountEmail: "owner@gmail.com",
      status: "CONNECTED",
      vaultVersion: 1,
      accessTokenEncrypted: enc.encryptedValue,
      accessTokenIv: enc.iv,
      accessTokenAuthTag: enc.authTag,
    });

    try {
      const creds = await getGmailAppPassword("conn_123", "user_owner_abc");
      assert.strictEqual(creds.email, "owner@gmail.com");
      assert.strictEqual(creds.appPassword, rawPassword);
    } finally {
      prisma.integrationConnection.findUnique = originalFindUnique;
    }
  });
});
