import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";

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

    // 6. Clear purchased items from user's shopping cart
    const purchasedAutomationIds = existingOrder.items.map((item) => item.automationId);
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
    });
  } catch (error) {
    console.error("Order verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment." },
      { status: 500 }
    );
  }
}
