import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { isOwnerTestAccount } from "@/lib/auth/owner-test";
import { checkAutomationAccess } from "@/lib/entitlement/checker";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userAutomations = await prisma.userAutomation.findMany({
    where: { clerkUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      automation: {
        include: {
          category: true,
          media: {
            take: 1,
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json({ userAutomations });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { automationId } = body;

    if (!automationId) {
      return NextResponse.json({ error: "automationId is required" }, { status: 400 });
    }

    const isOwner = await isOwnerTestAccount(userId);

    const automation = await prisma.automation.findFirst({
      where: {
        id: automationId,
        ...(isOwner ? {} : { status: "PUBLISHED" }),
      },
    });

    if (!automation) {
      return NextResponse.json({ error: "Automation product not found or not published" }, { status: 404 });
    }

    // Check if free or paid
    const isFree = automation.price === 0 || automation.pricingType === "FREE";
    if (!isFree) {
      // Check if user already has an existing workspace record
      const existing = await prisma.userAutomation.findUnique({
        where: {
          clerkUserId_automationId: {
            clerkUserId: userId,
            automationId: automationId,
          },
        },
        include: {
          automation: true,
        },
      });

      if (existing) {
        return NextResponse.json({ success: true, userAutomation: existing });
      }

      // Check if user has OWNER_TEST_ACCESS or active entitlement
      const accessCheck = await checkAutomationAccess(userId, automationId);
      if (!isOwner && !accessCheck.hasAccess) {
        return NextResponse.json(
          { error: "Payment required to purchase this product." },
          { status: 402 }
        );
      }
    }

    // Upsert or create free user automation record
    const userAutomation = await prisma.userAutomation.upsert({
      where: {
        clerkUserId_automationId: {
          clerkUserId: userId,
          automationId: automationId,
        },
      },
      update: {},
      create: {
        clerkUserId: userId,
        automationId: automationId,
        status: "NOT_CONFIGURED",
      },
      include: {
        automation: true,
      },
    });

    return NextResponse.json({ success: true, userAutomation });
  } catch (error: any) {
    console.error("Failed to add user automation:", error);
    return NextResponse.json({ error: "Failed to process automation workspace request." }, { status: 500 });
  }
}
