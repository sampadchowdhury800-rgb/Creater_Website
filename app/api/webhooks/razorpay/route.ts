import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === "order.paid") {
      const payment = event.payload.payment.entity;
      const rzpOrderId = payment.order_id;
      
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: rzpOrderId }
      });

      if (order && order.status !== "CONFIRMED") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            razorpayPaymentId: payment.id,
          }
        });

        // Clear cart for the user
        await prisma.cartItem.deleteMany({
          where: { cart: { clerkUserId: order.clerkUserId } }
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
