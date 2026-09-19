/**
 * app/api/gateway/gmail/route.ts
 *
 * The Chowdhury Duo Secure Integration Gateway.
 * Dedicated endpoint consumed by n8n to execute Gmail operations.
 *
 * ZERO-LEAKAGE INVARIANT:
 * - Google OAuth access tokens and refresh tokens NEVER enter n8n.
 * - Authenticates n8n via X-N8N-GATEWAY-SECRET.
 * - Atomically burns single-use executionGrant nonce.
 * - Enforces server-side capability boundaries.
 * - Returns only sanitized business responses.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security/ip-utils";
import { checkAutomationAccess } from "@/lib/entitlement/checker";
import { verifyGatewaySharedSecret, atomicallyConsumeGrant, finalizeGrant } from "@/lib/integrations/grant-service";
import { validateGatewayParameters } from "@/lib/integrations/gateway-validator";
import { getValidAccessToken, ReconnectRequiredError } from "@/lib/integrations/token-service";
import {
  executeGmailSend,
  executeGmailReadList,
  executeGmailGetMessage,
  executeGmailModify,
  checkGmailMessageSentByIdempotencyKey,
} from "@/lib/integrations/providers/google";
import type { SupportedCapability, GatewayBusinessResponse } from "@/lib/integrations/types";

export async function POST(req: NextRequest) {
  // ─── Step 1: Shared-Secret n8n-to-Gateway Authentication ─────────────────
  const gatewaySecretHeader = req.headers.get("x-n8n-gateway-secret");
  if (!verifyGatewaySharedSecret(gatewaySecretHeader)) {
    return NextResponse.json(
      { success: false, errorCode: "GATEWAY_AUTH_FAILED", errorMessage: "Invalid or missing gateway authentication." },
      { status: 401 }
    );
  }

  // ─── Step 2: Parse Request Body ───────────────────────────────────────────
  let body: {
    executionGrant?: string;
    action?: SupportedCapability;
    parameters?: Record<string, unknown>;
    stepId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const { executionGrant, action, parameters, stepId = "step_default" } = body;

  if (!executionGrant || !action || !parameters) {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "executionGrant, action, and parameters are required." },
      { status: 400 }
    );
  }

  // ─── Step 3: Strict Capability Parameter Validation ───────────────────────
  const paramValidation = validateGatewayParameters(action, parameters);
  if (!paramValidation.valid) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "INVALID_PARAMETERS",
        errorMessage: paramValidation.errors.join("; "),
      },
      { status: 400 }
    );
  }

  const validatedParams = paramValidation.data;

  // ─── Step 4: Atomic Single-Use Grant Consumption ──────────────────────────
  const clientIp = getClientIp(req);
  const consumeResult = await atomicallyConsumeGrant(executionGrant, clientIp);

  if (!consumeResult.success) {
    return NextResponse.json(
      { success: false, errorCode: consumeResult.errorCode, errorMessage: consumeResult.errorMessage },
      { status: 401 }
    );
  }

  const grant = consumeResult.grant;

  // ─── Step 5: Enforce Capability & Tenant Containment ─────────────────────
  if (grant.allowedCapability !== action) {
    await finalizeGrant(grant.id, "FAILED");
    return NextResponse.json(
      {
        success: false,
        errorCode: "CAPABILITY_NOT_ALLOWED",
        errorMessage: `Grant allows capability "${grant.allowedCapability}", but "${action}" was requested.`,
      },
      { status: 403 }
    );
  }

  const connection = grant.integrationConnection;
  if (!connection || connection.clerkUserId !== grant.clerkUserId) {
    await finalizeGrant(grant.id, "FAILED");
    return NextResponse.json(
      { success: false, errorCode: "TENANT_MISMATCH", errorMessage: "Connection ownership validation failed." },
      { status: 403 }
    );
  }

  if (connection.status !== "CONNECTED") {
    await finalizeGrant(grant.id, "FAILED");
    return NextResponse.json(
      {
        success: false,
        errorCode: connection.status === "EXPIRED" ? "CONNECTION_EXPIRED" : "MISSING_INTEGRATION",
        errorMessage: `Google connection is currently ${connection.status}. Reconnect required.`,
      },
      { status: 403 }
    );
  }

  // ─── Step 6: Verify Workspace Entitlement & Executability ────────────────
  const automation = grant.userAutomation?.automation;
  if (!automation || !automation.isExecutable || automation.status === "ARCHIVED") {
    await finalizeGrant(grant.id, "FAILED");
    return NextResponse.json(
      { success: false, errorCode: "AUTOMATION_DISABLED", errorMessage: "Automation is not executable or has been archived." },
      { status: 403 }
    );
  }

  const entitlementResult = await checkAutomationAccess(grant.clerkUserId, automation.id);
  if (!entitlementResult.hasAccess) {
    await finalizeGrant(grant.id, "FAILED");
    return NextResponse.json(
      { success: false, errorCode: "UNAUTHORIZED", errorMessage: entitlementResult.errorMessage || "Access expired." },
      { status: 403 }
    );
  }

  // ─── Step 7: Resolve & Refresh Google Access Token in Memory ─────────────
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(connection.id, grant.clerkUserId);
  } catch (err) {
    await finalizeGrant(grant.id, "FAILED");
    if (err instanceof ReconnectRequiredError) {
      return NextResponse.json(
        { success: false, errorCode: "CONNECTION_EXPIRED", errorMessage: err.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "TOKEN_REFRESH_FAILED", errorMessage: "Failed to authenticate with Google." },
      { status: 502 }
    );
  }

  // ─── Step 8: Side-Effect Idempotency (GMAIL_SEND) ─────────────────────────
  let idempotencyKey: string | null = null;

  if (action === "GMAIL_SEND") {
    idempotencyKey = createHash("sha256")
      .update(`${grant.automationExecutionId}:${stepId}:GMAIL_SEND`, "utf8")
      .digest("hex");

    const existingOp = await prisma.automationGatewayOperation.findUnique({
      where: { idempotencyKey },
    });

    if (existingOp) {
      if (existingOp.status === "SUCCEEDED" && existingOp.sanitizedResponse) {
        // Return cached idempotency result without resending
        await finalizeGrant(grant.id, "SUCCEEDED");
        return NextResponse.json(existingOp.sanitizedResponse);
      }

      if (existingOp.status === "PENDING") {
        // Crash recovery: check if email was already sent via deterministic Message-ID
        const recoveryCheck = await checkGmailMessageSentByIdempotencyKey(accessToken, idempotencyKey);
        if (recoveryCheck.found) {
          const recoveredResponse = {
            success: true,
            messageId: recoveryCheck.messageId,
            threadId: recoveryCheck.threadId,
          };
          await prisma.automationGatewayOperation.update({
            where: { idempotencyKey },
            data: {
              status: "SUCCEEDED",
              gmailMessageId: recoveryCheck.messageId,
              gmailThreadId: recoveryCheck.threadId,
              sanitizedResponse: recoveredResponse as any,
            },
          });
          await finalizeGrant(grant.id, "SUCCEEDED");
          return NextResponse.json(recoveredResponse);
        }
      }
    } else {
      // Create initial PENDING operation record
      await prisma.automationGatewayOperation.create({
        data: {
          idempotencyKey,
          automationExecutionId: grant.automationExecutionId,
          clerkUserId: grant.clerkUserId,
          action,
          status: "PENDING",
        },
      }).catch(() => {});
    }
  }

  // ─── Step 9: Execute Fixed Google API Operation ───────────────────────────
  let result: GatewayBusinessResponse;

  switch (action) {
    case "GMAIL_SEND":
      result = await executeGmailSend(
        accessToken,
        validatedParams,
        connection.accountEmail || undefined,
        idempotencyKey || undefined
      );
      break;

    case "GMAIL_READ_LIST":
      result = await executeGmailReadList(accessToken, validatedParams);
      break;

    case "GMAIL_GET_MESSAGE":
      result = await executeGmailGetMessage(accessToken, validatedParams);
      break;

    case "GMAIL_MODIFY":
      result = await executeGmailModify(accessToken, validatedParams);
      break;

    default:
      result = { success: false, errorCode: "UNSUPPORTED_ACTION", errorMessage: "Unsupported action." };
  }

  // ─── Step 10: Finalize Grant & Idempotency Operation ──────────────────────
  const finalGrantStatus = result.success ? "SUCCEEDED" : "FAILED";
  await finalizeGrant(grant.id, finalGrantStatus);

  if (idempotencyKey) {
    await prisma.automationGatewayOperation.updateMany({
      where: { idempotencyKey },
      data: {
        status: result.success ? "SUCCEEDED" : "FAILED",
        gmailMessageId: result.messageId || null,
        gmailThreadId: result.threadId || null,
        sanitizedResponse: result as any,
        errorCode: result.errorCode || null,
      },
    });
  }

  // Return strictly the sanitized business result (zero tokens or secrets)
  const httpStatus = result.success ? 200 : result.errorCode === "GMAIL_RATE_LIMITED" ? 429 : 502;
  return NextResponse.json(result, { status: httpStatus });
}
