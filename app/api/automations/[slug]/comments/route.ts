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

    const comments = await prisma.automationComment.findMany({
      where: { automationId: automation.id, parentId: null },
      include: {
        replies: {
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const resolvedParams = await params;
    const { content, parentId } = await req.json();

    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    const automation = await prisma.automation.findUnique({
      where: { slug: resolvedParams.slug, status: "PUBLISHED" }
    });

    if (!automation) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Ensure a reply's parent comment belongs to the SAME automation —
    // prevents cross-product comment injection and orphaned replies.
    if (parentId) {
      const parent = await prisma.automationComment.findUnique({
        where: { id: parentId },
        select: { automationId: true }
      });

      if (!parent || parent.automationId !== automation.id) {
        return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
      }
    }

    const userDetails = await getCurrentUserDetails();
    const clerkUserName = userDetails?.userName || "User";
    const clerkUserImage = userDetails?.userImage || "";

    const comment = await prisma.automationComment.create({
      data: {
        clerkUserId: userId,
        clerkUserName,
        clerkUserImage,
        automationId: automation.id,
        content: content.trim(),
        parentId: parentId || null
      }
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Comment create error:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

    const comment = await prisma.automationComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only allow deletion if the user is the author
    if (comment.clerkUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized to delete this comment" }, { status: 403 });
    }

    await prisma.automationComment.delete({
      where: { id: commentId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
