import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";

function extractEmailAddress(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/<([^>]+)>/) || raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].trim() : raw.trim();
}

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
    emailId?: string;
    threadId?: string;
    customerEmail?: string;
    customer?: { email?: string };
    senderEmail?: string;
    action?: string;
    draft?: { body?: string; subject?: string };
    reason?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tenantId, emailId, threadId, draft, reason } = body;
  if (!tenantId || !emailId || !threadId) {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "tenantId, emailId, and threadId are required." },
      { status: 400 }
    );
  }

  const userAutomation = await prisma.userAutomation.findFirst({
    where: { clerkUserId: tenantId, status: "ACTIVE" },
    include: { automation: true },
  });

  if (!userAutomation) {
    return NextResponse.json(
      { success: false, errorCode: "USER_AUTOMATION_NOT_FOUND", errorMessage: "No active user automation found for tenant." },
      { status: 404 }
    );
  }

  // ─── Resolve Actual Customer / Sender Email ──────────────────────────────
  let resolvedCustomerEmail: string | null =
    extractEmailAddress(body.customerEmail) ||
    extractEmailAddress(body.customer?.email) ||
    extractEmailAddress(body.senderEmail);

  // If not in body, look up in gateway operations (e.g. from fetch-and-lock)
  if (!resolvedCustomerEmail && emailId) {
    const gatewayOp = await prisma.automationGatewayOperation.findFirst({
      where: {
        clerkUserId: tenantId,
        OR: [
          { gmailMessageId: emailId },
          { idempotencyKey: `fetch_lock_${emailId}` },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (gatewayOp?.sanitizedResponse && typeof gatewayOp.sanitizedResponse === "object") {
      const resp = gatewayOp.sanitizedResponse as Record<string, any>;
      resolvedCustomerEmail =
        extractEmailAddress(resp.from) ||
        extractEmailAddress(resp.customerEmail) ||
        extractEmailAddress(resp.email);
    }
  }

  // Look up from recent execution input for this tenant
  if (!resolvedCustomerEmail) {
    const execution = await prisma.automationExecution.findFirst({
      where: {
        clerkUserId: tenantId,
        userAutomationId: userAutomation.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (execution?.input && typeof execution.input === "object") {
      const inp = execution.input as Record<string, any>;
      resolvedCustomerEmail =
        extractEmailAddress(inp.customerEmail) ||
        extractEmailAddress(inp.customer?.email) ||
        extractEmailAddress(inp.from) ||
        extractEmailAddress(inp.sender);
    }
  }

  // Fallback: Check existing conversation for this thread
  if (!resolvedCustomerEmail && threadId) {
    const existing = await prisma.supportConversation.findUnique({
      where: {
        userAutomationId_gmailThreadId: {
          userAutomationId: userAutomation.id,
          gmailThreadId: threadId,
        },
      },
    });
    if (existing?.customerEmail && existing.customerEmail !== "customer@domain.com") {
      resolvedCustomerEmail = existing.customerEmail;
    }
  }

  // Final deterministic fallback (never placeholder customer@domain.com)
  if (!resolvedCustomerEmail) {
    const cleanId = emailId.replace(/[^a-zA-Z0-9_.-]/g, "");
    resolvedCustomerEmail = `customer_${cleanId || Date.now()}@inbound.support`;
  }

  const conversation = await prisma.supportConversation.upsert({
    where: {
      userAutomationId_gmailThreadId: {
        userAutomationId: userAutomation.id,
        gmailThreadId: threadId,
      },
    },
    create: {
      clerkUserId: tenantId,
      userAutomationId: userAutomation.id,
      gmailThreadId: threadId,
      subject: draft?.subject || "Support Query",
      customerEmail: resolvedCustomerEmail,
      status: "PENDING_APPROVAL",
      category: "CUSTOMER_SUPPORT",
      lastMessageAt: new Date(),
    },
    update: {
      status: "PENDING_APPROVAL",
      customerEmail: resolvedCustomerEmail,
      lastMessageAt: new Date(),
    },
  });

  await prisma.supportMessage.create({
    data: {
      conversationId: conversation.id,
      gmailMessageId: emailId,
      role: "AI_DRAFT",
      content: draft?.body || "",
      reasoning: reason || "Flagged for human review by policy guard",
    },
  });

  return NextResponse.json({
    success: true,
    conversationId: conversation.id,
    customerEmail: resolvedCustomerEmail,
    status: "REVIEW_QUEUED",
    recordedAt: new Date().toISOString(),
  });
}
