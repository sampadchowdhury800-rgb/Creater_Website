"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

type PostInput = {
  title: string;
  slug?: string;
  shortDesc?: string;
  content?: string;
  featuredImage?: string;
  galleryUrls?: string[];
  videoUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  platform: "INSTAGRAM" | "YOUTUBE";
  publishDate?: string;
  status?: "DRAFT" | "PUBLISHED";
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  keywords?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  noindex?: boolean;
  nofollow?: boolean;
  readingTime?: number;

  // Relations
  tagIds?: string[];
  categoryIds?: string[];
};

export async function createPost(data: PostInput) {
  await requireAdminSession();

  const slug = data.slug || generateSlug(data.title);

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      shortDesc: data.shortDesc,
      content: data.content,
      featuredImage: data.featuredImage,
      galleryUrls: data.galleryUrls || [],
      videoUrl: data.videoUrl,
      instagramUrl: data.instagramUrl,
      youtubeUrl: data.youtubeUrl,
      platform: data.platform,
      publishDate: data.publishDate ? new Date(data.publishDate) : undefined,
      status: data.status,
      
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      canonicalUrl: data.canonicalUrl,
      keywords: data.keywords,
      ogImage: data.ogImage,
      ogTitle: data.ogTitle,
      ogDescription: data.ogDescription,
      twitterImage: data.twitterImage,
      twitterTitle: data.twitterTitle,
      twitterDescription: data.twitterDescription,
      noindex: data.noindex,
      nofollow: data.nofollow,
      readingTime: data.readingTime,
      
      tags: data.tagIds ? { connect: data.tagIds.map(id => ({ id })) } : undefined,
      categories: data.categoryIds ? { connect: data.categoryIds.map(id => ({ id })) } : undefined,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");

  return { success: true, post };
}

export async function updatePost(id: string, data: Partial<PostInput>) {
  await requireAdminSession();

  const post = await prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      slug: data.slug,
      shortDesc: data.shortDesc,
      content: data.content,
      featuredImage: data.featuredImage,
      galleryUrls: data.galleryUrls || [],
      videoUrl: data.videoUrl,
      instagramUrl: data.instagramUrl,
      youtubeUrl: data.youtubeUrl,
      platform: data.platform,
      publishDate: data.publishDate ? new Date(data.publishDate) : undefined,
      status: data.status,
      
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      canonicalUrl: data.canonicalUrl,
      keywords: data.keywords,
      ogImage: data.ogImage,
      ogTitle: data.ogTitle,
      ogDescription: data.ogDescription,
      twitterImage: data.twitterImage,
      twitterTitle: data.twitterTitle,
      twitterDescription: data.twitterDescription,
      noindex: data.noindex,
      nofollow: data.nofollow,
      readingTime: data.readingTime,
      
      tags: data.tagIds !== undefined ? { set: data.tagIds.map(id => ({ id })) } : undefined,
      categories: data.categoryIds !== undefined ? { set: data.categoryIds.map(id => ({ id })) } : undefined,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");

  return { success: true, post };
}

export async function deletePost(id: string) {
  await requireAdminSession();
  await prisma.post.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");
  return { success: true };
}

export async function togglePostStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  await requireAdminSession();
  await prisma.post.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");
  return { success: true };
}
