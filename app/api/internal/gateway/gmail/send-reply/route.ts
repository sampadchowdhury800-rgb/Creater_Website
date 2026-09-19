import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";
import { validateExecutionGrant } from "@/lib/integrations/grant-service";
import { getGmailAppPassword } from "@/lib/integrations/gmail-credential-service";
import { fetchImapMessage } from "@/lib/integrations/providers/imap";
import { sendSmtpReply } from "@/lib/integrations/providers/smtp";

export async function POST(req: NextRequest) {
  const authCheck = validateInternalServiceRequest(req);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      { success: false, errorCode: authCheck.errorCode, errorMessage: authCheck.errorMessage },
      { status: 401 }
    );
  }

  let body: {
    tenantId?: string;
    executionGrantId?: string;
    emailId?: string;
    threadId?: string;
    reply?: { body?: string; format?: string };
    idempotencyKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tenantId, executionGrantId, emailId, threadId, reply, idempotencyKey } = body;
  if (!tenantId || !executionGrantId || !emailId || !reply?.body) {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "tenantId, executionGrantId, emailId, and reply.body are required." },
      { status: 400 }
    );
  }

  const grantCheck = await validateExecutionGrant(executionGrantId, {
    requiredTenantId: tenantId,
    requiredCapability: "GMAIL_SEND",
  });

  if (!grantCheck.valid || !grantCheck.grant) {
    return NextResponse.json(
      { success: false, errorCode: grantCheck.errorCode, errorMessage: grantCheck.errorMessage },
      { status: 403 }
    );
  }

  const grant = grantCheck.grant;
  const effectiveIdempotencyKey = idempotencyKey || `idem_reply_${emailId}`;

  // ─── Authoritative Idempotency Check ──────────────────────────────────────
  const existingOp = await prisma.automationGatewayOperation.findUnique({
    where: { idempotencyKey: effectiveIdempotencyKey },
  });

  if (existingOp && existingOp.status === "SUCCEEDED") {
    return NextResponse.json({
      success: true,
      sentMessageId: existingOp.gmailMessageId || "cached_msg_id",
      sentAt: existingOp.updatedAt.toISOString(),
      isCached: true,
    });
  }

  await prisma.automationGatewayOperation.upsert({
    where: { idempotencyKey: effectiveIdempotencyKey },
    create: {
      idempotencyKey: effectiveIdempotencyKey,
      automationExecutionId: grant.automationExecutionId,
      clerkUserId: tenantId,
      action: "GMAIL_SEND",
      status: "PENDING",
    },
    update: {
      status: "PENDING",
    },
  }).catch(() => {});

  // ─── Resolve Credentials & Destination via IMAP/SMTP ───────────────────────
  let creds: { email: string; appPassword: string };
  try {
    creds = await getGmailAppPassword(grant.integrationConnectionId, grant.clerkUserId);
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "CREDENTIAL_RETRIEVAL_FAILED", errorMessage: "Could not retrieve Gmail credentials." },
      { status: 502 }
    );
  }

  const origMsgResult = await fetchImapMessage(creds, emailId, "metadata");

  let recipientEmail = origMsgResult.message?.from || origMsgResult.message?.snippet;
  if (recipientEmail) {
    const emailMatch = recipientEmail.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      recipientEmail = emailMatch[1];
    }
  }
  const subject = origMsgResult.message?.subject || "Customer Inquiry";

  if (!recipientEmail) {
    return NextResponse.json(
      { success: false, errorCode: "RECIPIENT_NOT_FOUND", errorMessage: "Unable to determine recipient email from original message." },
      { status: 400 }
    );
  }

  const bodyHtml = reply.body.replace(/\n/g, "<br>");

  const sendResult = await sendSmtpReply(
    creds,
    {
      from: creds.email,
      to: recipientEmail,
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      bodyHtml,
      inReplyTo: emailId,
      references: emailId,
      idempotencyKey: effectiveIdempotencyKey,
    }
  );

  if (!sendResult.success) {
    await prisma.automationGatewayOperation.updateMany({
      where: { idempotencyKey: effectiveIdempotencyKey },
      data: {
        status: "FAILED",
        errorCode: sendResult.errorCode,
      },
    }).catch(() => {});

    return NextResponse.json(
      { success: false, errorCode: sendResult.errorCode, errorMessage: sendResult.errorMessage },
      { status: 502 }
    );
  }

  await prisma.automationGatewayOperation.updateMany({
    where: { idempotencyKey: effectiveIdempotencyKey },
    data: {
      status: "SUCCEEDED",
      gmailMessageId: sendResult.messageId || null,
      gmailThreadId: threadId || sendResult.threadId || null,
      sanitizedResponse: sendResult as any,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    sentMessageId: sendResult.messageId,
    sentAt: new Date().toISOString(),
  });
}
