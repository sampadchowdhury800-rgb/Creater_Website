import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cart = await prisma.cart.findUnique({
    where: { clerkUserId: userId },
    include: {
      items: {
        include: {
          automation: {
            select: {
              id: true,
              title: true,
              slug: true,
              price: true,
              originalPrice: true,
              thumbnailUrl: true,
              status: true,
            },
          },
          plan: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({ cart: cart || { items: [] } });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { automationId, planId } = await req.json();

    // Verify product exists and is published
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
      include: {
        plans: { where: { isActive: true } },
      },
    });

    if (!automation || automation.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Product not available" }, { status: 400 });
    }

    // Validate planId if provided
    let verifiedPlanId: string | null = null;
    if (planId) {
      const match = automation.plans.find((p) => p.id === planId);
      if (match) verifiedPlanId = match.id;
    } else if (automation.plans.length > 0) {
      // Default to first active non-trial plan
      const defaultPlan = automation.plans.find((p) => p.planType !== "TRIAL") || automation.plans[0];
      verifiedPlanId = defaultPlan.id;
    }

    // Upsert Cart
    const cart = await prisma.cart.upsert({
      where: { clerkUserId: userId },
      update: {},
      create: { clerkUserId: userId },
    });

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_automationId: { cartId: cart.id, automationId } },
    });

    if (existingItem) {
      // If plan changed, update to new plan
      if (verifiedPlanId && existingItem.planId !== verifiedPlanId) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { planId: verifiedPlanId },
        });
        return NextResponse.json({ success: true, message: "Cart plan updated" });
      }
      return NextResponse.json({ message: "Already in cart" });
    }

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        automationId,
        planId: verifiedPlanId,
        quantity: 1,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { automationId } = await req.json();

    const cart = await prisma.cart.findUnique({
      where: { clerkUserId: userId },
    });

    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        automationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
