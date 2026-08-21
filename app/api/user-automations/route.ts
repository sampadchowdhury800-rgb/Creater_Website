import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";

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

    const automation = await prisma.automation.findUnique({
      where: { id: automationId, status: "PUBLISHED" },
    });

    if (!automation) {
      return NextResponse.json({ error: "Automation product not found or not published" }, { status: 404 });
    }

    // Upsert or create user automation record
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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
