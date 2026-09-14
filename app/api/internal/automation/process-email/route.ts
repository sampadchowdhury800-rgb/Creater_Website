import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";
import { validateExecutionGrant } from "@/lib/integrations/grant-service";

export async function POST(req: NextRequest) {
  const authCheck = validateInternalServiceRequest(req);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      { action: "FAILED", confidenceScore: 0, replyPayload: null, reviewReason: "Unauthorized service call" },
      { status: 401 }
    );
  }

  let body: {
    tenantId?: string;
    executionGrantId?: string;
    emailId?: string;
    customer?: { email?: string };
    content?: { subject?: string; body?: string; threadHistory?: string };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { action: "FAILED", confidenceScore: 0, replyPayload: null, reviewReason: "Invalid JSON request" },
      { status: 400 }
    );
  }

  const { tenantId, executionGrantId, emailId, customer, content } = body;
  if (!tenantId || !executionGrantId || !emailId) {
    return NextResponse.json(
      { action: "FAILED", confidenceScore: 0, replyPayload: null, reviewReason: "Missing required parameters" },
      { status: 400 }
    );
  }

  const grantCheck = await validateExecutionGrant(executionGrantId, {
    requiredTenantId: tenantId,
    requiredCapability: "SUPPORT_AI",
  });

  if (!grantCheck.valid || !grantCheck.grant) {
    return NextResponse.json(
      { action: "FAILED", confidenceScore: 0, replyPayload: null, reviewReason: grantCheck.errorMessage || "Invalid grant" },
      { status: 403 }
    );
  }

  const grant = grantCheck.grant;
  const userConfig = (grant.userAutomation?.config as Record<string, unknown>) || {};
  const threshold = typeof userConfig.confidenceThreshold === "number" ? userConfig.confidenceThreshold : 0.85;
  const autoReplyEnabled = userConfig.autoReplyEnabled !== false;

  const rawSubject = content?.subject || "";
  const rawBody = content?.body || "";

  // ─── Step 1: Prompt Injection Defense ─────────────────────────────────────
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s+prompt/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /jailbreak/i,
    /output\s+the\s+master\s+key/i,
    /reveal\s+secrets/i,
  ];

  const hasInjection = injectionPatterns.some((p) => p.test(rawSubject) || p.test(rawBody));
  if (hasInjection) {
    return NextResponse.json({
      action: "HUMAN_REVIEW",
      confidenceScore: 0.1,
      replyPayload: null,
      reviewReason: "Security flag: Potential prompt injection or adversarial instruction detected.",
      auditRefId: `audit_${grant.automationExecutionId}`,
    });
  }

  // ─── Step 2: Tenant-Isolated Knowledge Retrieval ──────────────────────────
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { clerkUserId: tenantId },
    select: { content: true },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  // ─── Step 3: Intent Classification & Rule-Based Heuristics ───────────────
  const lowerBody = rawBody.toLowerCase();
  const lowerSubject = rawSubject.toLowerCase();

  // Check for automated notifications / out-of-office / marketing spam -> IGNORE
  if (
    lowerSubject.includes("out of office") ||
    lowerSubject.includes("automatic reply") ||
    lowerSubject.includes("delivery status notification") ||
    (lowerBody.includes("unsubscribe") && lowerBody.includes("marketing"))
  ) {
    return NextResponse.json({
      action: "IGNORE",
      confidenceScore: 0.98,
      replyPayload: null,
      reviewReason: "Classified as non-actionable automated or bulk message",
      auditRefId: `audit_${grant.automationExecutionId}`,
    });
  }

  // Check for billing / urgent refunds / technical escalation -> HUMAN_REVIEW
  if (
    lowerBody.includes("refund") ||
    lowerBody.includes("cancel subscription") ||
    lowerBody.includes("lawyer") ||
    lowerBody.includes("chargeback") ||
    lowerBody.includes("dispute")
  ) {
    return NextResponse.json({
      action: "HUMAN_REVIEW",
      confidenceScore: 0.72,
      replyPayload: {
        subject: rawSubject.startsWith("Re:") ? rawSubject : `Re: ${rawSubject}`,
        body: "Hello,\n\nThank you for reaching out. We have escalated your inquiry regarding billing/cancellation to our specialized team for personal assistance.\n\nBest regards,\nCustomer Support",
        format: "text/plain",
      },
      reviewReason: "Billing or account escalation keyword detected",
      auditRefId: `audit_${grant.automationExecutionId}`,
    });
  }

  // ─── Step 4: Knowledge-Based Inference & Decision ────────────────────────
  let generatedReply = "";
  let confidence = 0.92;

  if (chunks.length > 0) {
    const primarySnippet = chunks[0].content;
    generatedReply = `Hello,\n\nThank you for contacting support regarding "${rawSubject}".\n\nBased on our documentation:\n${primarySnippet.slice(0, 300)}...\n\nPlease let us know if you have any additional questions!\n\nBest regards,\nCustomer Support`;
  } else {
    generatedReply = `Hello,\n\nThank you for contacting customer support. We have received your query regarding "${rawSubject}" and will assist you shortly.\n\nBest regards,\nCustomer Support`;
    confidence = 0.88;
  }

  // ─── Step 5: Deterministic Policy Gate ────────────────────────────────────
  let finalAction: "AUTO_REPLY" | "HUMAN_REVIEW" | "IGNORE" | "FAILED" = "AUTO_REPLY";
  let reviewReason: string | null = null;

  if (!autoReplyEnabled) {
    finalAction = "HUMAN_REVIEW";
    reviewReason = "Auto-reply disabled by tenant policy";
  } else if (confidence < threshold) {
    finalAction = "HUMAN_REVIEW";
    reviewReason = `Confidence score ${confidence.toFixed(2)} is below required threshold ${threshold.toFixed(2)}`;
  }

  return NextResponse.json({
    action: finalAction,
    confidenceScore: confidence,
    replyPayload: {
      subject: rawSubject.startsWith("Re:") ? rawSubject : `Re: ${rawSubject}`,
      body: generatedReply,
      format: "text/plain",
    },
    reviewReason,
    auditRefId: `audit_${grant.automationExecutionId}`,
  });
}
