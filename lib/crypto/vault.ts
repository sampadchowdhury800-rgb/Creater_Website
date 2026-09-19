/**
 * lib/crypto/vault.ts — AES-256-GCM Credential Vault
 *
 * SERVER-SIDE ONLY. Never import this from a client component or
 * any file that is rendered in the browser.
 *
 * DESIGN:
 *   - Encryption: AES-256-GCM (authenticated encryption)
 *     → Provides confidentiality + integrity + authenticity.
 *     → Any bit-flip in ciphertext, IV, or authTag causes decryption failure.
 *   - Key: 32 raw bytes derived from AUTOMATION_VAULT_KEY env var.
 *     → Accepted as 64 hex characters (recommended) or raw base64 (32 bytes).
 *     → NEVER stored in the database or source code.
 *     → NEVER exposed via NEXT_PUBLIC_ prefix.
 *   - IV: 12-byte cryptographically random value generated per encryption.
 *     → NEVER reuse an IV with the same key (GCM security requirement).
 *   - Auth Tag: 16 bytes (128-bit GCM default). Stored alongside ciphertext.
 *   - Version: integer to support future algorithm migration.
 *
 * THREAT MODEL:
 *   - Protects against: DB read access, SQL injection exposing raw data,
 *     accidental logging, insecure backups.
 *   - Does NOT protect against: full server compromise (key + data both exposed),
 *     side-channel attacks on Node.js crypto.
 *   - Key rotation: requires re-encrypting all secrets. Not implemented here.
 *     Increment the version field to track scheme changes.
 *
 * USAGE (server-side only):
 *   import { vaultEncrypt, vaultDecrypt } from "@/lib/crypto/vault";
 *
 *   const payload = vaultEncrypt("my-secret-token");
 *   // Store payload in DB (encryptedValue, iv, authTag, version).
 *
 *   const plaintext = vaultDecrypt(payload);
 *   // Use in memory — never return to client.
 *
 * NEVER:
 *   - Return plaintext to the browser.
 *   - Log plaintext values (even in errors).
 *   - Use NEXT_PUBLIC_ for the vault key.
 *   - Store the encryption key in the database.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The structured payload stored in the database for each encrypted secret.
 *
 * ALL fields are safe to store in the DB.
 * NONE of them individually (or together without the key) reveal the plaintext.
 */
export interface EncryptedPayload {
  /** Encryption scheme version. 1 = AES-256-GCM. */
  version: number;
  /** Base64-encoded 12-byte initialization vector. Unique per encryption. */
  iv: string;
  /** Base64-encoded 16-byte GCM authentication tag. */
  authTag: string;
  /** Base64-encoded AES-256-GCM ciphertext. */
  encryptedValue: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_VERSION = 1;
const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12; // bytes — recommended for GCM
const AUTH_TAG_LENGTH = 16; // bytes — 128-bit GCM default

// ─── Key Resolution ───────────────────────────────────────────────────────────

let _resolvedKey: Buffer | null = null;

/**
 * Resolves the vault encryption key from AUTOMATION_VAULT_KEY env var.
 *
 * Accepted formats:
 *   - 64 hex characters (32 bytes) — RECOMMENDED
 *     Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   - 44 base64 characters (32 bytes)
 *
 * NEVER:
 *   - Generate a random key at runtime (encrypted data would be lost on restart).
 *   - Commit the key to source control.
 *   - Use a key shorter than 32 bytes.
 *
 * Throws immediately if the key is missing or invalid.
 * In development, if AUTOMATION_VAULT_KEY is not set, uses a hardcoded DEV-ONLY
 * key and prints a loud warning. Production always requires a real key.
 */
function resolveVaultKey(): Buffer {
  if (_resolvedKey) return _resolvedKey;

  const raw = process.env.AUTOMATION_VAULT_KEY;

  if (!raw || raw.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "\n[VAULT] CRITICAL: AUTOMATION_VAULT_KEY is not set in production.\n" +
          "Generate a key with:\n" +
          "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
          "Then set AUTOMATION_VAULT_KEY in your server environment variables.\n" +
          "NEVER use NEXT_PUBLIC_ prefix — this key must remain server-side only.\n"
      );
    }

    // Development fallback: loud warning + deterministic dev key.
    // This allows local development without a configured key, but
    // any secrets encrypted with this key are NOT production-safe.
    console.warn(
      "\n[VAULT] WARNING: AUTOMATION_VAULT_KEY is not set.\n" +
        "Using insecure development key. DO NOT use this in production.\n" +
        "Set AUTOMATION_VAULT_KEY in .env.local for local development.\n"
    );

    // Dev-only key: 32 bytes of 0x01. Never suitable for production.
    _resolvedKey = Buffer.alloc(32, 0x01);
    return _resolvedKey;
  }

  const trimmed = raw.trim();

  // Try hex (64 chars = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const keyBuffer = Buffer.from(trimmed, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error("[VAULT] AUTOMATION_VAULT_KEY hex decoding produced unexpected length.");
    }
    _resolvedKey = keyBuffer;
    return _resolvedKey;
  }

  // Try base64 (44 chars = 32 bytes after padding)
  if (/^[A-Za-z0-9+/]={0,2}$/.test(trimmed) && trimmed.length >= 43) {
    const keyBuffer = Buffer.from(trimmed, "base64");
    if (keyBuffer.length !== 32) {
      throw new Error(
        `[VAULT] AUTOMATION_VAULT_KEY must be exactly 32 bytes. ` +
          `Got ${keyBuffer.length} bytes from base64 input. ` +
          `Generate a valid key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
      );
    }
    _resolvedKey = keyBuffer;
    return _resolvedKey;
  }

  throw new Error(
    "[VAULT] AUTOMATION_VAULT_KEY is not a valid 64-character hex or 44-character base64 string.\n" +
      "Generate a valid key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * A new cryptographically random 12-byte IV is generated for every call.
 * The GCM auth tag is captured and stored alongside the ciphertext to
 * detect any tampering during decryption.
 *
 * @param plaintext - The sensitive value to encrypt (API key, token, password).
 * @returns EncryptedPayload — safe to store in the database.
 *
 * @throws If the vault key is missing, invalid, or Node.js crypto fails.
 *
 * IMPORTANT: Never log the plaintext argument or the returned values
 * (particularly before storing).
 */
export function vaultEncrypt(plaintext: string): EncryptedPayload {
  const key = resolveVaultKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: CURRENT_VERSION,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    encryptedValue: encrypted.toString("base64"),
  };
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Decrypts an EncryptedPayload produced by vaultEncrypt.
 *
 * GCM authenticated decryption: if the ciphertext, IV, or authTag has been
 * tampered with in any way, decryption throws before returning any data.
 *
 * @param payload - The EncryptedPayload retrieved from the database.
 * @returns The original plaintext string.
 *
 * @throws If decryption fails (wrong key, tampering, or corrupted data).
 *
 * IMPORTANT:
 *   - Never return the plaintext to a client (browser/API response).
 *   - Never log the returned value.
 *   - Keep the decrypted value in server memory only, and for the minimum
 *     duration necessary.
 */
export function vaultDecrypt(payload: EncryptedPayload): string {
  if (!payload || payload.version !== CURRENT_VERSION) {
    throw new Error(
      `[VAULT] Unsupported encryption payload version: ${payload?.version ?? "unknown"}. ` +
        "Expected version 1."
    );
  }

  const key = resolveVaultKey();

  let iv: Buffer;
  let authTag: Buffer;
  let encryptedData: Buffer;

  try {
    iv = Buffer.from(payload.iv, "base64");
    authTag = Buffer.from(payload.authTag, "base64");
    encryptedData = Buffer.from(payload.encryptedValue, "base64");
  } catch {
    throw new Error("[VAULT] Decryption failed: malformed payload encoding.");
  }

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `[VAULT] Decryption failed: invalid IV length (got ${iv.length}, expected ${IV_LENGTH}).`
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `[VAULT] Decryption failed: invalid auth tag length (got ${authTag.length}, expected ${AUTH_TAG_LENGTH}).`
    );
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // Do NOT include any payload data in this error — it could leak info.
    // Do NOT log the payload or key here.
    throw new Error(
      "[VAULT] Decryption failed: authentication tag verification failed. " +
        "Data may have been tampered with, or the wrong key is in use."
    );
  }
}

// ─── Key Validation Utility ───────────────────────────────────────────────────

/**
 * Validates that the vault key is present and correctly formatted.
 * Call this during server startup to fail fast if misconfigured.
 *
 * Does NOT throw in development if key is missing (uses dev fallback).
 * ALWAYS throws in production if key is missing.
 */
export function validateVaultKey(): void {
  resolveVaultKey(); // Throws if invalid in production
}

// ─── Secret Status Helper ─────────────────────────────────────────────────────

/**
 * The safe representation of a secret's status returned to the client.
 * Contains NO plaintext value.
 */
export interface SecretStatus {
  configured: boolean;
  lastUpdated?: string;
}

/**
 * Returns the safe UI metadata stored in UserAutomation.config for a sensitive field.
 * This is what the client sees — never the actual value.
 */
export function buildSecretConfigPlaceholder(updatedAt?: Date): Record<string, unknown> {
  return {
    __isSecret: true,
    configured: true,
    lastUpdated: (updatedAt ?? new Date()).toISOString(),
  };
}

/**
 * Returns true if a config value is the safe secret placeholder (not a plaintext value).
 */
export function isSecretPlaceholder(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__isSecret === true
  );
}
