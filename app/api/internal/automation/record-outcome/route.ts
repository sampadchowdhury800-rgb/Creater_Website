import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";
import { finalizeGrant } from "@/lib/integrations/grant-service";

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
    status?: "SUCCESS" | "FAILED" | string;
    action?: string;
    sentMessageId?: string;
    error?: string;
    timestamp?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", errorMessage: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tenantId, emailId, status, action, sentMessageId, error } = body;
  const isSuccess = status === "SUCCESS";

  if (tenantId) {
    const executions = await prisma.automationExecution.findMany({
      where: {
        clerkUserId: tenantId,
        status: { in: ["RUNNING", "QUEUED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 1,
      include: { executionGrants: true },
    });

    if (executions.length > 0) {
      const exec = executions[0];
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: {
          status: isSuccess ? "COMPLETED" : "FAILED",
          completedAt: new Date(),
          output: {
            status,
            action,
            emailId,
            sentMessageId: sentMessageId || null,
            error: error || null,
            recordedAt: new Date().toISOString(),
          },
        },
      }).catch(() => {});

      for (const g of exec.executionGrants) {
        if (g.status === "ISSUED" || g.status === "PROCESSING") {
          await finalizeGrant(g.id, isSuccess ? "SUCCEEDED" : "FAILED");
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    status: isSuccess ? "SUCCESS" : "FAILED",
    recordedAt: new Date().toISOString(),
  });
}
