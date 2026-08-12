import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL"; // ALL, PENDING, APPROVED, SPAM, REJECTED

    const comments = await prisma.comment.findMany({
      where: {
        ...(status !== "ALL" ? { status: status as any } : {}),
        ...(search ? {
          OR: [
            { content: { contains: search, mode: "insensitive" } },
            { authorName: { contains: search, mode: "insensitive" } },
            { authorEmail: { contains: search, mode: "insensitive" } },
          ]
        } : {}),
      },
      include: {
        post: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}
