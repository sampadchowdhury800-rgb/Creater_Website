/**
 * lib/integrations/pkce.ts
 *
 * PKCE (Proof Key for Code Exchange, RFC 7636) and State Security utilities.
 * SERVER-SIDE ONLY.
 */

import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Base64URL encoding according to RFC 7636.
 */
function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a high-entropy cryptographic code_verifier (32 random bytes, base64url encoded).
 */
export function generateCodeVerifier(): string {
  const bytes = randomBytes(32);
  return toBase64Url(bytes);
}

/**
 * Derives the S256 code_challenge from a code_verifier (SHA-256 hashed and base64url encoded).
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier, "ascii").digest();
  return toBase64Url(hash);
}

/**
 * Generates a 256-bit cryptographically secure random state nonce (64 hex characters).
 */
export function generateStateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computes a deterministic SHA-256 hash of the state nonce for safe database storage/indexing.
 */
export function hashStateNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

/**
 * Verifies that a code verifier produces the expected code challenge.
 */
export function verifyCodeVerifier(verifier: string, expectedChallenge: string): boolean {
  if (!verifier || !expectedChallenge) return false;
  return generateCodeChallenge(verifier) === expectedChallenge;
}

/**
 * Verifies a state nonce against a stored state nonce hash in constant time.
 */
export function verifyStateNonce(nonce: string, expectedHash: string): boolean {
  if (!nonce || !expectedHash) return false;
  const computedHash = hashStateNonce(nonce);
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
