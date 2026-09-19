import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    let body: { automationId?: string; planId?: string } = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty or non-JSON body is acceptable (defaults to cart checkout)
    }

    let totalAmount = 0;
    const orderItemsData: Array<{
      automationId: string;
      planId?: string;
      titleSnapshot: string;
      priceSnapshot: number;
      quantity: number;
      planNameSnapshot?: string;
      planCodeSnapshot?: string;
      durationDaysSnapshot?: number | null;
      isLifetimeSnapshot?: boolean;
      maintenancePriceSnapshot?: number;
      maintenanceIntervalSnapshot?: string;
    }> = [];

    // ─── 1. Direct "Buy Now" flow for a specific automation & plan ──────────────
    if (body.automationId) {
      const automation = await prisma.automation.findUnique({
        where: { id: body.automationId },
        include: {
          plans: { where: { isActive: true } },
        },
      });

      if (!automation || automation.status !== "PUBLISHED") {
        return NextResponse.json(
          { error: "This automation product is currently unavailable." },
          { status: 400 }
        );
      }

      // Resolve plan
      let selectedPlan = null;
      if (body.planId) {
        selectedPlan = automation.plans.find((p) => p.id === body.planId);
        if (!selectedPlan) {
          return NextResponse.json(
            { error: "The requested pricing plan is no longer available." },
            { status: 400 }
          );
        }
      } else if (automation.plans.length > 0) {
        // Default to first active non-trial plan, or first active plan
        selectedPlan = automation.plans.find((p) => p.planType !== "TRIAL") || automation.plans[0];
      }

      const itemPrice = selectedPlan ? selectedPlan.price : automation.price;

      if (itemPrice <= 0 && selectedPlan?.planType === "TRIAL") {
        return NextResponse.json(
          { error: "Trials are free and should be activated via the trial endpoint." },
          { status: 400 }
        );
      }

      totalAmount = itemPrice;
      orderItemsData.push({
        automationId: automation.id,
        planId: selectedPlan?.id,
        titleSnapshot: automation.title,
        priceSnapshot: itemPrice,
        quantity: 1,
        planNameSnapshot: selectedPlan?.name,
        planCodeSnapshot: selectedPlan?.code,
        durationDaysSnapshot: selectedPlan?.durationDays,
        isLifetimeSnapshot: selectedPlan?.planType === "LIFETIME",
        maintenancePriceSnapshot: selectedPlan?.maintenanceEnabled ? selectedPlan.maintenancePrice : 0,
        maintenanceIntervalSnapshot: selectedPlan?.maintenanceInterval,
      });
    } else {
      // ─── 2. Shopping Cart checkout flow ──────────────────────────────────────
      const cart = await prisma.cart.findUnique({
        where: { clerkUserId: userId },
        include: {
          items: {
            include: {
              automation: true,
              plan: true,
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
      }

      for (const item of cart.items) {
        if (item.automation.status !== "PUBLISHED") {
          return NextResponse.json(
            { error: `Product "${item.automation.title}" is no longer available.` },
            { status: 400 }
          );
        }

        const plan = item.plan;
        const itemPrice = plan ? plan.price : item.automation.price;

        totalAmount += itemPrice * item.quantity;
        orderItemsData.push({
          automationId: item.automation.id,
          planId: plan?.id,
          titleSnapshot: item.automation.title,
          priceSnapshot: itemPrice,
          quantity: item.quantity,
          planNameSnapshot: plan?.name,
          planCodeSnapshot: plan?.code,
          durationDaysSnapshot: plan?.durationDays,
          isLifetimeSnapshot: plan?.planType === "LIFETIME",
          maintenancePriceSnapshot: plan?.maintenanceEnabled ? plan.maintenancePrice : 0,
          maintenanceIntervalSnapshot: plan?.maintenanceInterval,
        });
      }
    }

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount. Free products can be added directly without checkout." },
        { status: 400 }
      );
    }

    // ─── 3. Create initial order in database (PENDING) ─────────────────────────
    const order = await prisma.order.create({
      data: {
        clerkUserId: userId,
        totalAmount,
        currency: "INR",
        status: "PENDING",
        paymentStatus: "PENDING",
        items: {
          create: orderItemsData,
        },
      },
    });

    // ─── 4. Create Razorpay order (amounts strictly calculated in paise server-side)
    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });

    const rzpOrder = await razorpay.orders.create({
      amount: totalAmount, // in paise
      currency: "INR",
      receipt: order.id,
      notes: {
        userId,
        orderId: order.id,
      },
    });

    // ─── 5. Link Razorpay order ID to database order ───────────────────────────
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id },
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amount: totalAmount,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("[Orders/Create Error]", {
      message: error?.message || "Unknown error",
      code: error?.code || error?.error?.code,
      description: error?.error?.description,
      field: error?.error?.field,
      statusCode: error?.statusCode,
    });

    return NextResponse.json(
      { error: "Failed to initialize order checkout." },
      { status: 500 }
    );
  }
}
