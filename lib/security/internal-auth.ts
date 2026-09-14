/**
 * lib/security/internal-auth.ts
 *
 * Centralized verification helper for internal service-to-service API requests
 * (e.g. from n8n orchestration layer).
 *
 * Reuses CHOWDHURY_DUO_GATEWAY_SECRET / CHOWDHURY_DUO_INTERNAL_SECRET with
 * constant-time verification.
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
  const gatewaySecret = req.headers.get("x-n8n-gateway-secret");
  const authHeader = req.headers.get("authorization");

  let candidateSecret: string | null = null;
  if (internalKey) {
    candidateSecret = internalKey;
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
