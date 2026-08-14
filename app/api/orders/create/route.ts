import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: { automationId?: string } = {};
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
      titleSnapshot: string;
      priceSnapshot: number;
      quantity: number;
    }> = [];

    // 1. Direct "Buy Now" flow for a single automation
    if (body.automationId) {
      const automation = await prisma.automation.findUnique({
        where: { id: body.automationId },
      });

      if (!automation || automation.status !== "PUBLISHED") {
        return NextResponse.json(
          { error: "This automation product is currently unavailable." },
          { status: 400 }
        );
      }

      totalAmount = automation.price;
      orderItemsData.push({
        automationId: automation.id,
        titleSnapshot: automation.title,
        priceSnapshot: automation.price,
        quantity: 1,
      });
    } else {
      // 2. Shopping Cart checkout flow
      const cart = await prisma.cart.findUnique({
        where: { clerkUserId: userId },
        include: {
          items: {
            include: { automation: true },
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
        totalAmount += item.automation.price * item.quantity;
        orderItemsData.push({
          automationId: item.automation.id,
          titleSnapshot: item.automation.title,
          priceSnapshot: item.automation.price,
          quantity: item.quantity,
        });
      }
    }

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount." },
        { status: 400 }
      );
    }

    // 3. Create initial order in database (PENDING)
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

    // 4. Create Razorpay order (amounts strictly calculated in paise server-side)
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

    // 5. Link Razorpay order ID to database order
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
  } catch (error) {
    console.error("Order creation failed:", error);
    return NextResponse.json(
      { error: "Failed to initialize order checkout." },
      { status: 500 }
    );
  }
}
