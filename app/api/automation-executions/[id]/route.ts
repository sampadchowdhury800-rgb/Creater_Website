import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { sanitizeExecutionOutput } from "@/lib/automation/output-sanitizer";

/**
 * GET /api/automation-executions/[id]
 *
 * Returns safe detail view for a single execution record.
 *
 * SECURITY:
 * - Requires Clerk authentication.
 * - Verifies that the authenticated user owns the related UserAutomation.
 * - Error field is returned but was already sanitized at write time (ExecutionService).
 * - Raw n8n externalExecutionId is intentionally omitted — users have no need for it.
 * - Output is re-sanitized at response time (F3 defence-in-depth):
 *   Even if a historical record was written before F3 was deployed, the output
 *   is sanitized again before being returned to the client.
 * - NOT rate-limited by the execution rate limiter (read-only polling endpoint).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json(
      { error: "Authentication required.", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const execution = await prisma.automationExecution.findUnique({
    where: { id },
    include: {
      userAutomation: {
        select: {
          clerkUserId: true,
          automation: {
            select: {
              title: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!execution) {
    return NextResponse.json(
      { error: "Execution record not found.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // IDOR Protection — verify caller owns the AutomationExecution record.
  // execution.clerkUserId is the top-level column on AutomationExecution (not joined).
  if (execution.clerkUserId !== clerkUserId) {
    return NextResponse.json(
      { error: "Access denied.", code: "UNAUTHORIZED" },
      { status: 403 }
    );
  }

  // ─── F3: Response-time output sanitization (defence-in-depth) ────────────
  // Re-sanitize output before returning to the client. This ensures that:
  //   a) Any historical record written before F3 was deployed is safe to return.
  //   b) Any future regression in persistence-time sanitization is caught here.
  // sanitizeExecutionOutput() never throws — returns a safe empty object on error.
  const { output: safeOutput } = sanitizeExecutionOutput(execution.output);

  // Return sanitized execution detail.
  // externalExecutionId is deliberately omitted — users should not see internal n8n IDs.
  return NextResponse.json({
    execution: {
      id: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      createdAt: execution.createdAt,
      error: execution.error,
      // F3: Re-sanitized at response boundary — never raw n8n output
      output: safeOutput,
      automation: execution.userAutomation?.automation ?? null,
    },
  });
}
