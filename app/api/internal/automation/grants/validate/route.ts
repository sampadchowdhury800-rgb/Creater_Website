import { NextRequest, NextResponse } from "next/server";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";
import { validateExecutionGrant } from "@/lib/integrations/grant-service";
import { checkAutomationAccess } from "@/lib/entitlement/checker";

export async function POST(req: NextRequest) {
  const authCheck = validateInternalServiceRequest(req);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      {
        status: "INVALID",
        isEntitled: false,
        errorCode: authCheck.errorCode || "UNAUTHORIZED",
        errorMessage: authCheck.errorMessage || "Service authentication failed.",
      },
      { status: 401 }
    );
  }

  let body: { tenantId?: string; executionGrantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "INVALID", isEntitled: false, errorCode: "BAD_REQUEST", errorMessage: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tenantId, executionGrantId } = body;
  if (!tenantId || !executionGrantId) {
    return NextResponse.json(
      { status: "INVALID", isEntitled: false, errorCode: "BAD_REQUEST", errorMessage: "tenantId and executionGrantId are required." },
      { status: 400 }
    );
  }

  const grantCheck = await validateExecutionGrant(executionGrantId, {
    requiredTenantId: tenantId,
    requiredCapability: "SUPPORT_AI",
  });

  if (!grantCheck.valid || !grantCheck.grant) {
    return NextResponse.json(
      {
        status: "INVALID",
        isEntitled: false,
        errorCode: grantCheck.errorCode || "GRANT_INVALID",
        errorMessage: grantCheck.errorMessage || "Grant validation failed.",
      },
      { status: 200 }
    );
  }

  const grant = grantCheck.grant;
  const userAutomation = grant.userAutomation;

  if (!userAutomation?.automation || !userAutomation.automation.isExecutable || userAutomation.automation.status === "ARCHIVED") {
    return NextResponse.json(
      {
        status: "INVALID",
        isEntitled: false,
        errorCode: "AUTOMATION_DISABLED",
        errorMessage: "Automation is not active or has been archived.",
      },
      { status: 200 }
    );
  }

  const accessCheck = await checkAutomationAccess(grant.clerkUserId, userAutomation.automationId);
  if (!accessCheck.hasAccess) {
    return NextResponse.json(
      {
        status: "INVALID",
        isEntitled: false,
        errorCode: "NOT_ENTITLED",
        errorMessage: accessCheck.errorMessage || "Tenant subscription or entitlement is inactive.",
      },
      { status: 200 }
    );
  }

  const config = (userAutomation.config as Record<string, unknown>) || {};
  const autoReplyEnabled = config.autoReplyEnabled !== false;
  const confidenceThreshold = typeof config.confidenceThreshold === "number" ? config.confidenceThreshold : 0.85;

  return NextResponse.json({
    status: "VALID",
    isEntitled: true,
    quotaRemaining: 1000,
    features: {
      autoReplyEnabled,
      confidenceThreshold,
    },
  });
}
