import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { NextResponse } from "next/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wishlist = await prisma.wishlist.findUnique({
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

  return NextResponse.json({ wishlist: wishlist || { items: [] } });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { automationId } = await req.json();

    const wishlist = await prisma.wishlist.upsert({
      where: { clerkUserId: userId },
      update: {},
      create: { clerkUserId: userId }
    });

    const existingItem = await prisma.wishlistItem.findUnique({
      where: { wishlistId_automationId: { wishlistId: wishlist.id, automationId } }
    });

    if (!existingItem) {
      await prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          automationId
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Wishlist POST error:", error);
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

    const wishlist = await prisma.wishlist.findUnique({
      where: { clerkUserId: userId }
    });

    if (wishlist) {
      await prisma.wishlistItem.deleteMany({
        where: {
          wishlistId: wishlist.id,
          automationId
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Wishlist DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
