import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Handle payment capture / order paid events
    if (event.event === "order.paid" || event.event === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const rzpPaymentId = paymentEntity?.id;

      // Ensure payment state is captured or paid
      const paymentStatus = paymentEntity?.status;
      if (paymentStatus && paymentStatus !== "captured" && paymentStatus !== "paid" && event.event !== "order.paid") {
        return NextResponse.json({ message: "Payment not in captured state yet." });
      }

      if (rzpOrderId) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId: rzpOrderId },
          include: { items: true },
        });

        if (order && order.paymentStatus !== "PAID") {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "CONFIRMED",
              paymentStatus: "PAID",
              razorpayPaymentId: rzpPaymentId || order.razorpayPaymentId,
            },
          });

          // Remove purchased items from the user's cart
          const purchasedIds = order.items.map((item) => item.automationId);
          if (purchasedIds.length > 0) {
            await prisma.cartItem.deleteMany({
              where: {
                cart: { clerkUserId: order.clerkUserId },
                automationId: { in: purchasedIds },
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
