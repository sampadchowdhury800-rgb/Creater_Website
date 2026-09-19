import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  generateReferenceId,
  buildEscalationTextReport,
  buildEscalationHtmlReport,
  checkEscalationLimit,
  EscalationReportData,
} from "@/lib/ai-support/escalation";
import type { ChatMessage } from "@/lib/ai-support/types";
import { getClientIp } from "@/lib/security/ip-utils";

export async function POST(req: NextRequest) {
  try {
    // 1. IP & Rate Limiting Check
    const ip = getClientIp(req);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_JSON", message: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { messages, originalQuestion, automationSlug } = body;

    const queryText =
      typeof originalQuestion === "string" && originalQuestion.trim()
        ? originalQuestion.trim().slice(0, 1000)
        : Array.isArray(messages) && messages.length > 0
        ? String(messages[messages.length - 1]?.content || "").slice(0, 1000)
        : "Support query";

    // Check anti-spam & cooldown limits
    const rateCheck = checkEscalationLimit(ip, queryText);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateCheck.reason,
          message: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // 2. Resolve Authenticated Identity Server-Side (Never trust client user ID)
    let userId: string | null = null;
    try {
      userId = await getCurrentUserId();
    } catch {
      userId = null;
    }
    let customerName: string | null = null;
    let customerEmail: string | null = null;

    if (userId) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        customerName =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          clerkUser.username ||
          "Authenticated User";
        const primaryEmailObj = clerkUser.emailAddresses?.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        );
        customerEmail =
          primaryEmailObj?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress ||
          null;
      } catch (clerkErr) {
        console.warn("[Escalation API] Could not fetch Clerk user details:", clerkErr);
        customerName = "Authenticated User";
      }
    }

    // 3. Resolve Automation & Live Data (if slug provided)
    let autoTitle: string | null = null;
    let activePlansSummary: string | null = null;
    let safeExecutionStatus: string | null = null;
    let safeExecutionError: string | null = null;

    if (typeof automationSlug === "string" && automationSlug.trim()) {
      try {
        const cleanSlug = automationSlug.trim().toLowerCase();
        const auto = await prisma.automation.findUnique({
          where: { slug: cleanSlug },
          include: {
            plans: {
              where: { isActive: true },
              select: { name: true, planType: true, price: true },
            },
          },
        });

        if (auto && auto.status === "PUBLISHED") {
          autoTitle = auto.title;
          if (auto.plans.length > 0) {
            activePlansSummary = auto.plans
              .map((p) => `${p.name} (₹${Math.round(p.price / 100)})`)
              .join(", ");
          }

          // If authenticated, check if user has a UserAutomation record with safe execution info
          if (userId) {
            const userAuto = await prisma.userAutomation.findFirst({
              where: {
                clerkUserId: userId,
                automationId: auto.id,
              },
              select: {
                status: true,
                executions: {
                  take: 1,
                  orderBy: { createdAt: "desc" },
                  select: { status: true, error: true },
                },
              },
            });

            if (userAuto) {
              const lastExec = userAuto.executions?.[0];
              safeExecutionStatus = lastExec ? String(lastExec.status) : String(userAuto.status);
              if (lastExec?.error) {
                // Scrub any internal details
                safeExecutionError = "Configuration or execution issue reported in logs";
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn("[Escalation API] DB lookup error:", dbErr);
      }
    }

    // 4. Sanitize and structure conversation messages
    const sanitizedConversation: ChatMessage[] = [];
    const troubleshootingSteps: string[] = [];
    const problemSummary = "Customer requested technical assistance with an automation.";

    if (Array.isArray(messages)) {
      for (const msg of messages.slice(-12)) {
        if (
          msg &&
          typeof msg === "object" &&
          ["user", "assistant"].includes(msg.role) &&
          typeof msg.content === "string"
        ) {
          const content = msg.content.trim().slice(0, 1500);
          if (content) {
            sanitizedConversation.push({
              role: msg.role as "user" | "assistant",
              content,
            });

            // Extract troubleshooting hints from assistant responses
            if (
              msg.role === "assistant" &&
              (content.includes("1.") ||
                content.includes("Step") ||
                content.includes("configure") ||
                content.includes("check"))
            ) {
              troubleshootingSteps.push(content.slice(0, 300));
            }
          }
        }
      }
    }

    const referenceId = generateReferenceId();
    const timestamp = new Date().toISOString();

    const reportData: EscalationReportData = {
      referenceId,
      timestamp,
      customer: {
        isAuthenticated: !!userId,
        userId: userId || undefined,
        name: customerName,
        email: customerEmail,
      },
      automation: {
        title: autoTitle,
        slug: automationSlug || undefined,
        activePlansSummary,
        safeExecutionStatus,
        safeExecutionError,
      },
      originalQuestion: queryText,
      conversation: sanitizedConversation,
      problemSummary,
      troubleshootingProvided: troubleshootingSteps.slice(0, 3),
      verifiedInformation: autoTitle
        ? [`Verified active automation: "${autoTitle}"`, `Plans: ${activePlansSummary || "Standard"}`]
        : ["Customer query is general or automation was not specified."],
      unverifiedInformation: [
        "Private user secrets and API keys are not accessible and were not inspected.",
      ],
      recommendedAction:
        "Review customer issue, check recent execution telemetry if user is authenticated, and reach out to customer.",
    };

    const textReport = buildEscalationTextReport(reportData);
    const htmlReport = buildEscalationHtmlReport(reportData);

    const emailSubject = `[Support Escalation] ${referenceId} - ${
      autoTitle || "Customer Assistance Request"
    }`;

    // 5. Dispatch via Brevo
    const emailResult = await sendBrevoEmail({
      subject: emailSubject,
      textContent: textReport,
      htmlContent: htmlReport,
      toName: "Chowdhury Duo Developers",
      replyTo: customerEmail ? { email: customerEmail, name: customerName || undefined } : undefined,
    });

    if (!emailResult.success) {
      console.error(
        `[Escalation API] Brevo email sending failed: ${emailResult.error}`
      );
      // Requirement 23: If sending fails, return safe generic message
      return NextResponse.json(
        {
          success: false,
          error: "DELIVERY_FAILED",
          message:
            "Sorry, we couldn't send the developer request right now. Please try again later.",
        },
        { status: 500 }
      );
    }

    // 6. Return success with Reference ID
    return NextResponse.json({
      success: true,
      referenceId,
      message: `Your query has been sent to the developer. Reference ID: ${referenceId}`,
    });
  } catch (error: any) {
    console.error("[POST /api/ai-support/escalate] Unexpected server error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message:
          "Sorry, we couldn't send the developer request right now. Please try again later.",
      },
      { status: 500 }
    );
  }
}
