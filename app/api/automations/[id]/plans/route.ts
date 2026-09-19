import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: identifier } = await params;

    const automation = await prisma.automation.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      select: { id: true },
    });

    const automationId = automation?.id || identifier;

    const plans = await prisma.automationPlan.findMany({
      where: {
        automationId,
        isActive: true,
      },
      orderBy: [
        { sortOrder: "asc" },
        { price: "asc" },
      ],
    });

    return NextResponse.json({ plans });
  } catch (error: any) {
    console.error("[Get Plans Error]:", error);
    return NextResponse.json({ error: "Failed to fetch pricing plans." }, { status: 500 });
  }
}
