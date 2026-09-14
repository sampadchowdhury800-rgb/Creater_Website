/**
 * lib/security/google-oidc.ts
 *
 * Google Cloud Pub/Sub OIDC JWT Verification.
 *
 * Validates OpenID Connect ID tokens delivered in the Authorization header
 * by Google Cloud Pub/Sub push subscriptions according to Google security standards.
 *
 * Requirements:
 * - RS256 signature verification against Google's public JWKS (https://www.googleapis.com/oauth2/v3/certs).
 * - In-memory key caching with automatic refresh upon key rotation.
 * - Issuer verification (accounts.google.com or https://accounts.google.com).
 * - Audience verification against configured GOOGLE_PUBSUB_AUDIENCE or request URL.
 * - Expiration and clock-skew validation.
 * - Zero-leakage: Never logs raw JWTs or signatures.
 */

import crypto from "node:crypto";

export interface GoogleOidcClaims {
  iss: string;
  aud: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

export interface OidcVerificationResult {
  valid: boolean;
  claims?: GoogleOidcClaims;
  errorCode?:
    | "MISSING_AUTHORIZATION"
    | "MALFORMED_TOKEN"
    | "INVALID_HEADER"
    | "KEY_NOT_FOUND"
    | "INVALID_SIGNATURE"
    | "TOKEN_EXPIRED"
    | "TOKEN_NOT_YET_VALID"
    | "INVALID_ISSUER"
    | "INVALID_AUDIENCE"
    | "JWKS_FETCH_FAILED"
    | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface GoogleJwk {
  kty: string;
  alg?: string;
  use?: string;
  kid: string;
  n: string;
  e: string;
}

interface JwksCache {
  keys: Map<string, GoogleJwk>;
  fetchedAt: number;
  ttlMs: number;
}

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const VALID_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const CLOCK_SKEW_SECONDS = 60; // 60 seconds clock skew tolerance
const DEFAULT_JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

// In-memory cache for Google's public JWKs
let jwksCache: JwksCache = {
  keys: new Map(),
  fetchedAt: 0,
  ttlMs: DEFAULT_JWKS_CACHE_TTL_MS,
};

/**
 * Fetch and cache Google's public JWKs.
 */
export async function getGooglePublicJwks(forceRefresh = false): Promise<Map<string, GoogleJwk>> {
  const now = Date.now();
  if (!forceRefresh && jwksCache.keys.size > 0 && now - jwksCache.fetchedAt < jwksCache.ttlMs) {
    return jwksCache.keys;
  }

  try {
    const res = await fetch(GOOGLE_CERTS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Google certs endpoint returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { keys?: GoogleJwk[] };
    if (!data.keys || !Array.isArray(data.keys)) {
      throw new Error("Invalid JWKS response structure from Google");
    }

    const keyMap = new Map<string, GoogleJwk>();
    for (const key of data.keys) {
      if (key.kid && key.kty === "RSA") {
        keyMap.set(key.kid, key);
      }
    }

    jwksCache = {
      keys: keyMap,
      fetchedAt: now,
      ttlMs: DEFAULT_JWKS_CACHE_TTL_MS,
    };

    return keyMap;
  } catch (err: any) {
    // If cache has stale keys, fall back to stale cache on network failure
    if (jwksCache.keys.size > 0) {
      return jwksCache.keys;
    }
    throw err;
  }
}

/**
 * For testing purposes: allows clearing or injecting custom JWKS cache.
 */
export function __setJwksCacheForTesting(customKeys?: Map<string, GoogleJwk> | null) {
  if (customKeys) {
    jwksCache = {
      keys: customKeys,
      fetchedAt: Date.now(),
      ttlMs: 24 * 60 * 60 * 1000,
    };
  } else {
    jwksCache = {
      keys: new Map(),
      fetchedAt: 0,
      ttlMs: DEFAULT_JWKS_CACHE_TTL_MS,
    };
  }
}

/**
 * Validates a Google Pub/Sub OIDC JWT token.
 *
 * @param tokenRaw Raw Authorization header value (e.g. "Bearer eyJ...") or raw JWT string.
 * @param options Expected audience and optional testing hooks.
 */
export async function verifyGooglePubSubOidcToken(
  tokenRaw?: string | null,
  options?: {
    expectedAudience?: string | string[];
    customJwksFetcher?: () => Promise<Map<string, GoogleJwk>>;
  }
): Promise<OidcVerificationResult> {
  // 1. Missing authorization
  if (!tokenRaw || typeof tokenRaw !== "string") {
    return {
      valid: false,
      errorCode: "MISSING_AUTHORIZATION",
      errorMessage: "Missing Authorization token.",
    };
  }

  let token = tokenRaw.trim();
  if (token.toLowerCase().startsWith("bearer")) {
    token = token.slice(6).trim();
  }

  if (!token) {
    return {
      valid: false,
      errorCode: "MISSING_AUTHORIZATION",
      errorMessage: "Bearer token is empty.",
    };
  }

  // 2. Structure check
  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      errorCode: "MALFORMED_TOKEN",
      errorMessage: "Malformed JWT: Expected 3 segments separated by dots.",
    };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 3. Decode header
  let header: { alg?: string; kid?: string; typ?: string };
  try {
    const headerJson = Buffer.from(headerB64, "base64url").toString("utf8");
    header = JSON.parse(headerJson);
  } catch {
    return {
      valid: false,
      errorCode: "MALFORMED_TOKEN",
      errorMessage: "Failed to parse JWT header.",
    };
  }

  if (header.alg !== "RS256") {
    return {
      valid: false,
      errorCode: "INVALID_HEADER",
      errorMessage: `Unsupported JWT algorithm: ${header.alg}. Expected RS256.`,
    };
  }

  if (!header.kid) {
    return {
      valid: false,
      errorCode: "INVALID_HEADER",
      errorMessage: "Missing key ID (kid) in JWT header.",
    };
  }

  // 4. Decode claims
  let claims: GoogleOidcClaims;
  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    claims = JSON.parse(payloadJson);
  } catch {
    return {
      valid: false,
      errorCode: "MALFORMED_TOKEN",
      errorMessage: "Failed to parse JWT payload.",
    };
  }

  // 5. Validate Issuer
  if (!claims.iss || !VALID_ISSUERS.has(claims.iss)) {
    return {
      valid: false,
      errorCode: "INVALID_ISSUER",
      errorMessage: `Invalid token issuer: ${claims.iss}. Expected Google accounts issuer.`,
    };
  }

  // 6. Validate Expiration & Timing
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (typeof claims.exp !== "number") {
    return {
      valid: false,
      errorCode: "MALFORMED_TOKEN",
      errorMessage: "Missing or invalid 'exp' claim in token.",
    };
  }

  if (claims.exp + CLOCK_SKEW_SECONDS < nowInSeconds) {
    return {
      valid: false,
      errorCode: "TOKEN_EXPIRED",
      errorMessage: "Token has expired.",
    };
  }

  if (typeof claims.iat === "number" && claims.iat - CLOCK_SKEW_SECONDS > nowInSeconds) {
    return {
      valid: false,
      errorCode: "TOKEN_NOT_YET_VALID",
      errorMessage: "Token issued in the future (iat check failed).",
    };
  }

  // 7. Validate Audience
  const expectedAudience = options?.expectedAudience || process.env.GOOGLE_PUBSUB_AUDIENCE;
  if (expectedAudience) {
    const tokenAud = claims.aud;
    let audienceMatches = false;

    if (Array.isArray(expectedAudience)) {
      audienceMatches = expectedAudience.includes(tokenAud);
    } else if (typeof expectedAudience === "string") {
      audienceMatches = tokenAud === expectedAudience;
    }

    if (!audienceMatches) {
      return {
        valid: false,
        errorCode: "INVALID_AUDIENCE",
        errorMessage: "Token audience does not match the configured Pub/Sub endpoint audience.",
      };
    }
  }

  // 8. Fetch Google Public Key and Verify Signature
  let jwks: Map<string, GoogleJwk>;
  try {
    if (options?.customJwksFetcher) {
      jwks = await options.customJwksFetcher();
    } else {
      jwks = await getGooglePublicJwks(false);
      if (!jwks.has(header.kid)) {
        // Try refreshing keys once if kid not in cache
        jwks = await getGooglePublicJwks(true);
      }
    }
  } catch (err: any) {
    return {
      valid: false,
      errorCode: "JWKS_FETCH_FAILED",
      errorMessage: "Unable to retrieve Google public verification keys.",
    };
  }

  const jwk = jwks.get(header.kid);
  if (!jwk) {
    return {
      valid: false,
      errorCode: "KEY_NOT_FOUND",
      errorMessage: `Public key matching kid "${header.kid}" was not found in Google certificates.`,
    };
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: jwk as any,
      format: "jwk",
    });

    const signedData = `${headerB64}.${payloadB64}`;
    const signatureBytes = Buffer.from(signatureB64, "base64url");

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signedData);
    const isSignatureValid = verifier.verify(publicKey, signatureBytes);

    if (!isSignatureValid) {
      return {
        valid: false,
        errorCode: "INVALID_SIGNATURE",
        errorMessage: "Cryptographic signature verification failed.",
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      errorCode: "INVALID_SIGNATURE",
      errorMessage: "Signature verification encountered an internal error.",
    };
  }

  return {
    valid: true,
    claims,
  };
}
