/**
 * lib/security/internal-auth.ts
 *
 * Centralized verification helper for internal service-to-service API requests.
 * Used by the Gmail polling endpoint and all other internal gateway routes.
 *
 * Authenticates against CHOWDHURY_DUO_GATEWAY_SECRET (the single internal secret).
 * Accepts the secret via:
 *   - x-cron-secret header  (pg_cron → Vercel polling job)
 *   - x-internal-service-key header (n8n or other orchestrators)
 *   - x-n8n-gateway-secret header (legacy n8n header)
 *   - Authorization: Bearer <secret>
 *
 * SERVER-SIDE ONLY.
 */

import { NextRequest } from "next/server";
import { verifyGatewaySharedSecret } from "../integrations/grant-service";

export interface InternalAuthResult {
  authenticated: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export function validateInternalServiceRequest(req: NextRequest): InternalAuthResult {
  const internalKey = req.headers.get("x-internal-service-key");
  const cronSecret = req.headers.get("x-cron-secret") || req.nextUrl?.searchParams?.get("cron_secret");
  const gatewaySecret = req.headers.get("x-n8n-gateway-secret");
  const authHeader = req.headers.get("authorization");

  let candidateSecret: string | null = null;
  if (internalKey) {
    candidateSecret = internalKey;
  } else if (cronSecret) {
    candidateSecret = cronSecret;
  } else if (gatewaySecret) {
    candidateSecret = gatewaySecret;
  } else if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    candidateSecret = authHeader.slice(7).trim();
  }

  if (!candidateSecret) {
    return {
      authenticated: false,
      errorCode: "MISSING_SERVICE_AUTH",
      errorMessage: "Missing internal service authentication header.",
    };
  }

  const isValid = verifyGatewaySharedSecret(candidateSecret);
  if (!isValid) {
    return {
      authenticated: false,
      errorCode: "INVALID_SERVICE_AUTH",
      errorMessage: "Invalid internal service authentication credential.",
    };
  }

  return { authenticated: true };
}
