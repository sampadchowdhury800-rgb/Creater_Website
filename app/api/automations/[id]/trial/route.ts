import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const { id: identifier } = await params;

    const automation = await prisma.automation.findFirst({
      where: {
        status: "PUBLISHED",
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: {
        plans: {
          where: { isActive: true, planType: "TRIAL" },
        },
      },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation product not found or not published." },
        { status: 404 }
      );
    }

    const trialPlan = automation.plans[0];
    if (!trialPlan || !trialPlan.trialDays || trialPlan.trialDays <= 0) {
      return NextResponse.json(
        { error: "This automation product does not offer a free trial." },
        { status: 400 }
      );
    }

    // Check if user already claimed trial for this automation (one-trial abuse prevention)
    const existingTracker = await prisma.automationTrialTracker.findUnique({
      where: {
        clerkUserId_automationId: {
          clerkUserId: userId,
          automationId: automation.id,
        },
      },
    });

    if (existingTracker) {
      return NextResponse.json(
        {
          error: "You have already claimed your free trial for this automation product.",
          code: "TRIAL_ALREADY_CLAIMED",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + trialPlan.trialDays * 86400000);

    // Atomically register trial claim, upsert workspace, and grant entitlement
    const [tracker, ua, entitlement] = await prisma.$transaction(async (tx) => {
      const t = await tx.automationTrialTracker.create({
        data: {
          clerkUserId: userId,
          automationId: automation.id,
          planId: trialPlan.id,
          claimedAt: now,
        },
      });

      const u = await tx.userAutomation.upsert({
        where: {
          clerkUserId_automationId: {
            clerkUserId: userId,
            automationId: automation.id,
          },
        },
        update: {},
        create: {
          clerkUserId: userId,
          automationId: automation.id,
          status: "NOT_CONFIGURED",
        },
      });

      const e = await tx.automationEntitlement.create({
        data: {
          clerkUserId: userId,
          automationId: automation.id,
          planId: trialPlan.id,
          userAutomationId: u.id,
          status: "TRIAL",
          isLifetime: false,
          startsAt: now,
          expiresAt,
          maintenanceStatus: "NOT_APPLICABLE",
          notes: `${trialPlan.trialDays}-day free trial activation`,
        },
      });

      return [t, u, e];
    });

    return NextResponse.json({
      success: true,
      userAutomationId: ua.id,
      expiresAt: entitlement.expiresAt,
      trialDays: trialPlan.trialDays,
    });
  } catch (error: any) {
    console.error("[Trial Activation Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to activate free trial." },
      { status: 500 }
    );
  }
}
