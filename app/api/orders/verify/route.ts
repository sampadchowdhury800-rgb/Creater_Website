import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = await req.json();

    // 1. Verify Signature
    const generatedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // 2. Update Order Status
    const order = await prisma.order.update({
      where: { id: orderId, clerkUserId: userId },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        razorpayPaymentId,
        razorpaySignature,
      },
    });

    // 3. Clear Cart for this user
    await prisma.cartItem.deleteMany({
      where: { cart: { clerkUserId: userId } }
    });

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error) {
    console.error("Order verify error:", error);
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}
