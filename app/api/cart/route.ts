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
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({ cart: cart || { items: [] } });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { automationId } = await req.json();

    // Verify product exists and is published
    const automation = await prisma.automation.findUnique({
      where: { id: automationId }
    });

    if (!automation || automation.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Product not available" }, { status: 400 });
    }

    // Upsert Cart
    const cart = await prisma.cart.upsert({
      where: { clerkUserId: userId },
      update: {},
      create: { clerkUserId: userId }
    });

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_automationId: { cartId: cart.id, automationId } }
    });

    if (existingItem) {
      // For digital products we might just want to keep qty at 1, but let's allow it if desired,
      // actually, let's keep it at 1 for automations.
      return NextResponse.json({ message: "Already in cart" });
    }

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        automationId,
        quantity: 1
      }
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
    const { searchParams } = new URL(req.url);
    const automationId = searchParams.get("automationId");

    if (!automationId) return NextResponse.json({ error: "Missing automationId" }, { status: 400 });

    const cart = await prisma.cart.findUnique({
      where: { clerkUserId: userId }
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          automationId
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
