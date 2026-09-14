/**
 * app/api/webhooks/gmail/route.ts
 *
 * Webhook receiver for Google Cloud Pub/Sub push notifications.
 * Receives incoming Gmail events, deduplicates historyIds, verifies tenant entitlements,
 * and initiates the automated support processing pipeline.
 *
 * ZERO-LEAKAGE INVARIANT:
 * - Never returns sensitive errors to Google.
 * - Always returns 200 OK to Pub/Sub to prevent infinite redelivery loops once processed.
 * - Mints transient single-use grants for downstream processing.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAutomationAccess } from "@/lib/entitlement/checker";
import { getValidAccessToken } from "@/lib/integrations/token-service";
import { executeGmailListHistory } from "@/lib/integrations/providers/google";
import { mintExecutionGrant } from "@/lib/integrations/grant-service";
import { N8nClient } from "@/lib/automation/n8n-client";
import { verifyGooglePubSubOidcToken } from "@/lib/security/google-oidc";

export async function POST(req: NextRequest) {
  // ─── Step 1: Optional Pub/Sub Verification Token ──────────────────────────
  const verificationToken = process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN;
  if (verificationToken) {
    const urlToken = req.nextUrl.searchParams.get("token");
    const headerToken = req.headers.get("x-goog-pubsub-token");
    if (urlToken !== verificationToken && headerToken !== verificationToken) {
      return NextResponse.json(
        { success: false, errorMessage: "Invalid Pub/Sub verification token." },
        { status: 401 }
      );
    }
  }

  // ─── Step 1b: Google Pub/Sub OIDC JWT Authentication ──────────────────────
  const authHeader = req.headers.get("authorization");
  const expectedAudience =
    process.env.GOOGLE_PUBSUB_AUDIENCE || `${req.nextUrl.origin}${req.nextUrl.pathname}`;
  const oidcVerification = await verifyGooglePubSubOidcToken(authHeader, {
    expectedAudience,
  });

  if (!oidcVerification.valid) {
    return NextResponse.json(
      {
        success: false,
        errorCode: oidcVerification.errorCode,
        errorMessage: oidcVerification.errorMessage || "Unauthorized Pub/Sub request.",
      },
      { status: 401 }
    );
  }

  // ─── Step 2: Parse Pub/Sub Envelope ───────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorMessage: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  if (!body?.message?.data) {
    return NextResponse.json(
      { success: false, errorMessage: "Missing Pub/Sub message data." },
      { status: 400 }
    );
  }

  // ─── Step 3: Decode Base64 Notification ───────────────────────────────────
  let notification: { emailAddress?: string; historyId?: string };
  try {
    const rawData = Buffer.from(body.message.data, "base64").toString("utf8");
    notification = JSON.parse(rawData);
  } catch {
    return NextResponse.json(
      { success: false, errorMessage: "Failed to decode Pub/Sub data payload." },
      { status: 400 }
    );
  }

  const { emailAddress, historyId } = notification;
  if (!emailAddress || !historyId) {
    return NextResponse.json(
      { success: false, errorMessage: "Incomplete notification parameters." },
      { status: 400 }
    );
  }

  // ─── Step 4: Idempotency Ledger Check ─────────────────────────────────────
  const existingEvent = await prisma.processedGmailEvent.findUnique({
    where: {
      emailAddress_historyId: {
        emailAddress,
        historyId: String(historyId),
      },
    },
  });

  if (existingEvent) {
    // Already processed — acknowledge to Pub/Sub to stop redelivery
    return NextResponse.json(
      { success: true, message: "Event already processed (deduplicated)." },
      { status: 200 }
    );
  }

  // ─── Step 5: Resolve Tenant via GmailWatchSubscription ────────────────────
  const subscription = await prisma.gmailWatchSubscription.findFirst({
    where: {
      integrationConnection: {
        accountEmail: emailAddress,
        status: "CONNECTED",
      },
    },
    include: {
      integrationConnection: {
        include: {
          userAutomations: {
            include: {
              userAutomation: true,
            },
          },
        },
      },
    },
  });

  if (!subscription) {
    // No active watch for this account — ack to Google
    return NextResponse.json(
      { success: true, message: "No active watch found for this address." },
      { status: 200 }
    );
  }

  const clerkUserId = subscription.clerkUserId;
  const connection = subscription.integrationConnection;
  const userAutomation = connection.userAutomations[0]?.userAutomation;

  if (!userAutomation) {
    return NextResponse.json(
      { success: true, message: "No bound user automation found." },
      { status: 200 }
    );
  }

  // ─── Step 6: Atomic Idempotency Record ────────────────────────────────────
  await prisma.processedGmailEvent.create({
    data: {
      clerkUserId,
      emailAddress,
      historyId: String(historyId),
      messageId: body.message.messageId || null,
    },
  });

  // ─── Step 7: Entitlement Check ────────────────────────────────────────────
  const accessCheck = await checkAutomationAccess(clerkUserId, userAutomation.automationId);
  if (!accessCheck.hasAccess) {
    return NextResponse.json(
      { success: true, message: "Tenant entitlement inactive or expired." },
      { status: 200 }
    );
  }

  // ─── Step 8: Fetch History to Identify New Messages ───────────────────────
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(connection.id);
  } catch (err: any) {
    return NextResponse.json(
      { success: true, message: "Token refresh failed; tenant must reconnect." },
      { status: 200 }
    );
  }

  const historyResult = await executeGmailListHistory(accessToken, {
    startHistoryId: subscription.historyId,
    labelId: "INBOX",
  });

  // Update subscription's last synchronized historyId
  await prisma.gmailWatchSubscription.update({
    where: { id: subscription.id },
    data: { historyId: String(historyId) },
  });

  if (!historyResult.success || !historyResult.history || historyResult.history.length === 0) {
    return NextResponse.json(
      { success: true, message: "No new messages found in history range." },
      { status: 200 }
    );
  }

  // Collect newly added message IDs
  const newMessages: Array<{ id: string; threadId: string }> = [];
  for (const histRecord of historyResult.history) {
    if (histRecord.messagesAdded) {
      for (const item of histRecord.messagesAdded) {
        if (item.message?.id) {
          newMessages.push({
            id: item.message.id,
            threadId: item.message.threadId || item.message.id,
          });
        }
      }
    }
  }

  if (newMessages.length === 0) {
    return NextResponse.json(
      { success: true, message: "No messageAdded records found." },
      { status: 200 }
    );
  }

  // ─── Step 9: Dispatch Processing for Each New Inbound Email ───────────────
  const processedMessageIds: string[] = [];

  for (const msg of newMessages) {
    // Create execution record
    const execution = await prisma.automationExecution.create({
      data: {
        userAutomationId: userAutomation.id,
        clerkUserId,
        status: "QUEUED",
        input: {
          trigger: "GMAIL_PUSH_NOTIFICATION",
          messageId: msg.id,
          threadId: msg.threadId,
          emailAddress,
        },
      },
    });

    // Mint transient single-use grant for AI support capability
    const grant = await mintExecutionGrant({
      clerkUserId,
      userAutomationId: userAutomation.id,
      automationExecutionId: execution.id,
      integrationConnectionId: connection.id,
      allowedCapability: "SUPPORT_AI",
    });

    // If n8n or an external workflow orchestrator is configured, dispatch event
    const n8nSupportWebhook = process.env.N8N_SUPPORT_WEBHOOK_URL;
    if (n8nSupportWebhook) {
      try {
        await fetch(n8nSupportWebhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-N8N-WEBHOOK-SECRET": process.env.N8N_WEBHOOK_SECRET || "",
          },
          body: JSON.stringify({
            executionId: execution.id,
            executionGrant: grant.rawGrantToken,
            userAutomationId: userAutomation.id,
            messageId: msg.id,
            threadId: msg.threadId,
            emailAddress,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err: any) {
        console.error("Failed to notify n8n support webhook:", err.message);
      }
    }

    processedMessageIds.push(msg.id);
  }

  return NextResponse.json({
    success: true,
    processedCount: processedMessageIds.length,
    messageIds: processedMessageIds,
  });
}
