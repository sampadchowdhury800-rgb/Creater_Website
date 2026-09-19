import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";
import { grantOrExtendEntitlement } from "@/lib/entitlement/checker";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = await req.json();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !orderId) {
      return NextResponse.json(
        { error: "Missing required payment verification parameters." },
        { status: 400 }
      );
    }

    // 1. Fetch internal order with strict user ownership check
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder || existingOrder.clerkUserId !== userId) {
      return NextResponse.json(
        { error: "Order not found or access denied." },
        { status: 404 }
      );
    }

    // 2. Validate internal Razorpay order ID matches
    if (!existingOrder.razorpayOrderId || existingOrder.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Mismatched Razorpay order reference." },
        { status: 400 }
      );
    }

    // 3. Prevent duplicate payment attempts / already confirmed orders
    if (existingOrder.paymentStatus === "PAID" && existingOrder.status === "CONFIRMED") {
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        alreadyProcessed: true,
      });
    }

    // 4. Cryptographic HMAC-SHA256 signature verification using server-stored order ID
    const payload = `${existingOrder.razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpaySignature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Invalid cryptographic payment signature." },
        { status: 400 }
      );
    }

    // 5. Update Order Status to CONFIRMED & PAID
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        razorpayPaymentId,
        razorpaySignature,
      },
    });

    // 6. Create UserAutomation records for all purchased automation products
    const purchasedAutomationIds = existingOrder.items.map((item) => item.automationId);
    let primaryUserAutomationId: string | null = null;

    for (const item of existingOrder.items) {
      const ua = await prisma.userAutomation.upsert({
        where: {
          clerkUserId_automationId: {
            clerkUserId: userId,
            automationId: item.automationId,
          },
        },
        update: {},
        create: {
          clerkUserId: userId,
          automationId: item.automationId,
          status: "NOT_CONFIGURED",
        },
      });

      // Provision or extend entitlement based on plan purchased
      await grantOrExtendEntitlement({
        clerkUserId: userId,
        automationId: item.automationId,
        planId: item.planId,
        orderId: updatedOrder.id,
        userAutomationId: ua.id,
        durationDays: item.durationDaysSnapshot,
        isLifetime: item.isLifetimeSnapshot,
        maintenanceEnabled: !!(item.maintenancePriceSnapshot && item.maintenancePriceSnapshot > 0),
      });

      if (!primaryUserAutomationId) {
        primaryUserAutomationId = ua.id;
      }
    }

    // 7. Clear purchased items from user's shopping cart
    if (purchasedAutomationIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: {
          cart: { clerkUserId: userId },
          automationId: { in: purchasedAutomationIds },
        },
      });
    }

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
      userAutomationId: primaryUserAutomationId,
    });
  } catch (error) {
    console.error("Order verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment." },
      { status: 500 }
    );
  }
}
