import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    if (id === "new") {
      return NextResponse.json({ post: null });
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        categories: true,
        tags: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.shortDesc !== undefined && { shortDesc: body.shortDesc }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.featuredImage !== undefined && { featuredImage: body.featuredImage }),
        ...(body.galleryUrls !== undefined && { galleryUrls: body.galleryUrls }),
        ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
        ...(body.instagramUrl !== undefined && { instagramUrl: body.instagramUrl }),
        ...(body.youtubeUrl !== undefined && { youtubeUrl: body.youtubeUrl }),
        ...(body.platform !== undefined && { platform: body.platform }),
        ...(body.publishDate !== undefined && { publishDate: new Date(body.publishDate) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.seoTitle !== undefined && { seoTitle: body.seoTitle }),
        ...(body.seoDescription !== undefined && { seoDescription: body.seoDescription }),
        ...(body.canonicalUrl !== undefined && { canonicalUrl: body.canonicalUrl }),
        ...(body.keywords !== undefined && { keywords: body.keywords }),
        ...(body.ogImage !== undefined && { ogImage: body.ogImage }),
        ...(body.tagIds !== undefined && { tags: { set: body.tagIds.map((tid: string) => ({ id: tid })) } }),
        ...(body.categoryIds !== undefined && { categories: { set: body.categoryIds.map((cid: string) => ({ id: cid })) } }),
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/posts");
    revalidatePath("/instagram");
    revalidatePath("/youtube");

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Update post error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Alias PATCH for full updates
  return PATCH(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Delete in correct order to handle relations
    await prisma.comment.deleteMany({ where: { postId: id } });
    await prisma.post.delete({ where: { id } });

    revalidatePath("/", "layout");
    revalidatePath("/admin/posts");
    revalidatePath("/instagram");
    revalidatePath("/youtube");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
