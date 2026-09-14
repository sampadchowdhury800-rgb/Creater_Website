import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";
import { validateExecutionGrant, markGrantProcessing } from "@/lib/integrations/grant-service";
import { getValidAccessToken } from "@/lib/integrations/token-service";
import { executeGmailGetMessage } from "@/lib/integrations/providers/google";

export async function POST(req: NextRequest) {
  const authCheck = validateInternalServiceRequest(req);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      { success: false, errorCode: authCheck.errorCode, errorMessage: authCheck.errorMessage },
      { status: 401 }
    );
  }

  let body: { tenantId?: string; executionGrantId?: string; emailId?: string; threadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const { tenantId, executionGrantId, emailId, threadId } = body;
  if (!tenantId || !executionGrantId || !emailId) {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "tenantId, executionGrantId, and emailId are required." },
      { status: 400 }
    );
  }

  const grantCheck = await validateExecutionGrant(executionGrantId, {
    requiredTenantId: tenantId,
    requiredCapability: "GMAIL_GET_MESSAGE",
  });

  if (!grantCheck.valid || !grantCheck.grant) {
    return NextResponse.json(
      { success: false, errorCode: grantCheck.errorCode, errorMessage: grantCheck.errorMessage },
      { status: 403 }
    );
  }

  const grant = grantCheck.grant;

  // ─── Deduplication Check ──────────────────────────────────────────────────
  const lockKey = `fetch_lock_${emailId}`;
  const existingLock = await prisma.automationGatewayOperation.findUnique({
    where: { idempotencyKey: lockKey },
  });

  if (existingLock && existingLock.status === "SUCCEEDED") {
    return NextResponse.json({
      processingStatus: "ALREADY_PROCESSED",
      isDuplicate: true,
    });
  }

  const processedEvent = await prisma.processedGmailEvent.findFirst({
    where: {
      clerkUserId: tenantId,
      messageId: emailId,
    },
  });

  if (processedEvent) {
    return NextResponse.json({
      processingStatus: "ALREADY_PROCESSED",
      isDuplicate: true,
    });
  }

  // ─── Atomic Processing Lock ───────────────────────────────────────────────
  await prisma.automationGatewayOperation.upsert({
    where: { idempotencyKey: lockKey },
    create: {
      idempotencyKey: lockKey,
      automationExecutionId: grant.automationExecutionId,
      clerkUserId: tenantId,
      action: "GMAIL_FETCH_AND_LOCK",
      status: "PENDING",
    },
    update: {
      status: "PENDING",
    },
  }).catch(() => {});

  await markGrantProcessing(grant.id);

  // ─── Resolve Token & Fetch Message ────────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(grant.integrationConnectionId, grant.clerkUserId);
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "TOKEN_REFRESH_FAILED", errorMessage: "Could not refresh Google token." },
      { status: 502 }
    );
  }

  const msgResult = await executeGmailGetMessage(accessToken, {
    messageId: emailId,
    format: "full",
  });

  if (!msgResult.success || !msgResult.message) {
    return NextResponse.json(
      { success: false, errorCode: msgResult.errorCode || "GMAIL_FETCH_FAILED", errorMessage: msgResult.errorMessage },
      { status: 502 }
    );
  }

  const msg = msgResult.message;
  const normalizedBody = (msg.bodyText || msg.snippet || "").trim();

  await prisma.automationGatewayOperation.updateMany({
    where: { idempotencyKey: lockKey },
    data: {
      status: "SUCCEEDED",
      gmailMessageId: emailId,
      gmailThreadId: threadId || msg.threadId || null,
    },
  }).catch(() => {});

  return NextResponse.json({
    processingStatus: "ACQUIRED_LOCK",
    isDuplicate: false,
    email: {
      from: msg.from || "unknown@customer.com",
      subject: msg.subject || "(No Subject)",
      normalizedBody,
      threadHistorySnippet: msg.snippet || "",
      receivedAt: msg.date || new Date().toISOString(),
    },
  });
}
