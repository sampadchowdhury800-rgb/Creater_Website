import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const platform = searchParams.get("platform") as "INSTAGRAM" | "YOUTUBE" | null;

    const posts = await prisma.post.findMany({
      where: {
        ...(platform ? { platform } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      },
      include: {
        _count: { select: { comments: true, categories: true, tags: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const slug = body.slug || generateSlug(body.title);

    const post = await prisma.post.create({
      data: {
        title: body.title,
        slug,
        shortDesc: body.shortDesc || null,
        content: body.content || null,
        featuredImage: body.featuredImage || null,
        galleryUrls: body.galleryUrls || [],
        videoUrl: body.videoUrl || null,
        instagramUrl: body.instagramUrl || null,
        youtubeUrl: body.youtubeUrl || null,
        platform: body.platform || "INSTAGRAM",
        publishDate: body.publishDate ? new Date(body.publishDate) : new Date(),
        status: body.status || "DRAFT",
        seoTitle: body.seoTitle || null,
        seoDescription: body.seoDescription || null,
        canonicalUrl: body.canonicalUrl || null,
        keywords: body.keywords || null,
        ogImage: body.ogImage || null,
        tags: body.tagIds?.length ? { connect: body.tagIds.map((id: string) => ({ id })) } : undefined,
        categories: body.categoryIds?.length ? { connect: body.categoryIds.map((id: string) => ({ id })) } : undefined,
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/posts");
    revalidatePath("/instagram");
    revalidatePath("/youtube");

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

