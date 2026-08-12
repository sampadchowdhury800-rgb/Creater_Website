import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getCurrentUserDetails } from "@/lib/auth-server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const automation = await prisma.automation.findUnique({
      where: { slug: resolvedParams.slug, status: "PUBLISHED" },
    });

    if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const reviews = await prisma.automationReview.findMany({
      where: { automationId: automation.id },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const resolvedParams = await params;
    const { rating, body } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    const automation = await prisma.automation.findUnique({
      where: { slug: resolvedParams.slug, status: "PUBLISHED" }
    });

    if (!automation) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Ensure the user actually bought the item (optional rule, but good practice)
    const hasPurchased = await prisma.order.findFirst({
      where: {
        clerkUserId: userId,
        status: "CONFIRMED",
        items: { some: { automationId: automation.id } }
      }
    });

    if (!hasPurchased) {
      return NextResponse.json({ error: "You must purchase this product to review it." }, { status: 403 });
    }

    // Fetch user details to cache in DB
    const userDetails = await getCurrentUserDetails();
    const clerkUserName = userDetails?.userName || "User";
    const clerkUserImage = userDetails?.userImage || "";

    const review = await prisma.automationReview.create({
      data: {
        clerkUserId: userId,
        clerkUserName,
        clerkUserImage,
        automationId: automation.id,
        rating,
        body
      }
    });

    // Update automation stats
    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        ratingSum: { increment: rating },
        reviewCount: { increment: 1 }
      }
    });

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "You have already reviewed this product." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
