import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { env } from "@/lib/env";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { clerkUserId: userId },
      include: {
        items: {
          include: { automation: true }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // 2. Calculate total directly from database prices (NEVER from client)
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of cart.items) {
      if (item.automation.status !== "PUBLISHED") {
        return NextResponse.json({ error: `Product ${item.automation.title} is no longer available.` }, { status: 400 });
      }
      totalAmount += item.automation.price * item.quantity;
      
      orderItemsData.push({
        automationId: item.automation.id,
        titleSnapshot: item.automation.title,
        priceSnapshot: item.automation.price,
        quantity: item.quantity
      });
    }

    // 3. Create initial order in DB (PENDING)
    const order = await prisma.order.create({
      data: {
        clerkUserId: userId,
        totalAmount,
        currency: "INR",
        status: "PENDING",
        paymentStatus: "PENDING",
        items: {
          create: orderItemsData
        }
      }
    });

    // 4. Create Razorpay order
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
        orderId: order.id
      }
    });

    // 5. Update order with Razorpay order ID
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id }
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amount: totalAmount,
      currency: "INR"
    });

  } catch (error) {
    console.error("Order create error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
