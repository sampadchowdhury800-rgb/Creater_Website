import { prisma } from "@/lib/prisma";
import { checkAutomationAccess } from "@/lib/entitlement/checker";

export interface AuthorizationResult {
  authorized: boolean;
  userAutomation?: any;
  n8nWorkflowId?: string;
  errorCode?: "UNAUTHENTICATED" | "NOT_FOUND" | "UNAUTHORIZED" | "DISABLED" | "MISSING_WORKFLOW" | "INVALID_CONFIG";
  errorMessage?: string;
  statusCode: number;
}

/**
 * Server-side authorization check for automation execution.
 *
 * Verifies:
 * 1. User authentication (`clerkUserId` is present).
 * 2. UserAutomation existence.
 * 3. Strict ownership (`userAutomation.clerkUserId === clerkUserId`).
 * 4. Automation product is executable (`isExecutable` is true).
 * 5. UserAutomation status is permitted (not DISABLED or PAUSED).
 * 6. Server-side n8n workflow binding exists.
 */
export async function authorizeAutomationExecution(
  clerkUserId: string | null | undefined,
  userAutomationId: string
): Promise<AuthorizationResult> {
  if (!clerkUserId) {
    return {
      authorized: false,
      errorCode: "UNAUTHENTICATED",
      errorMessage: "Authentication required to trigger execution.",
      statusCode: 401,
    };
  }

  if (!userAutomationId) {
    return {
      authorized: false,
      errorCode: "NOT_FOUND",
      errorMessage: "UserAutomation ID is required.",
      statusCode: 400,
    };
  }

  const userAutomation = await prisma.userAutomation.findUnique({
    where: { id: userAutomationId },
    include: {
      automation: true,
    },
  });

  if (!userAutomation) {
    return {
      authorized: false,
      errorCode: "NOT_FOUND",
      errorMessage: "Automation workspace record not found.",
      statusCode: 404,
    };
  }

  // Strict ownership check (IDOR Protection)
  if (userAutomation.clerkUserId !== clerkUserId) {
    return {
      authorized: false,
      errorCode: "UNAUTHORIZED",
      errorMessage: "Access denied. You do not own this automation workspace.",
      statusCode: 403,
    };
  }

  const automation = userAutomation.automation;
  if (!automation) {
    return {
      authorized: false,
      errorCode: "NOT_FOUND",
      errorMessage: "Underlying automation product record not found.",
      statusCode: 404,
    };
  }

  if (!automation.isExecutable) {
    return {
      authorized: false,
      errorCode: "DISABLED",
      errorMessage: "This automation product is currently disabled by administrator.",
      statusCode: 403,
    };
  }

  if (automation.status === "ARCHIVED") {
    return {
      authorized: false,
      errorCode: "DISABLED",
      errorMessage: "This automation product has been archived and is no longer available for execution.",
      statusCode: 403,
    };
  }

  if (userAutomation.status === "DISABLED") {
    return {
      authorized: false,
      errorCode: "DISABLED",
      errorMessage: "This user workspace automation instance is disabled.",
      statusCode: 403,
    };
  }

  if (userAutomation.status === "PAUSED") {
    return {
      authorized: false,
      errorCode: "DISABLED",
      errorMessage: "This automation workspace is currently paused.",
      statusCode: 400,
    };
  }

  if (!automation.n8nWorkflowId) {
    return {
      authorized: false,
      errorCode: "MISSING_WORKFLOW",
      errorMessage: "No execution engine workflow is attached to this automation product.",
      statusCode: 503,
    };
  }

  // 7. Centralized Entitlement Check (Trial / Time-Limited / Lifetime / Maintenance)
  const accessResult = await checkAutomationAccess(clerkUserId, automation.id);
  if (!accessResult.hasAccess) {
    return {
      authorized: false,
      errorCode: "UNAUTHORIZED",
      errorMessage: accessResult.errorMessage || "Your access entitlement has expired or requires maintenance renewal.",
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    userAutomation,
    n8nWorkflowId: automation.n8nWorkflowId,
    statusCode: 200,
  };
}
