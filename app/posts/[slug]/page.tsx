import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PostDetailClient from "./PostDetailClient";
import { toPostCard } from "@/lib/postTypes";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await prisma.post.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
    select: {
      title: true,
      shortDesc: true,
      seoTitle: true,
      seoDescription: true,
      featuredImage: true,
      ogImage: true,
      ogTitle: true,
      ogDescription: true,
      twitterImage: true,
      twitterTitle: true,
      twitterDescription: true,
      canonicalUrl: true,
      slug: true,
    },
  });

  if (!post) return { title: "Post Not Found | Chowdhury Duo" };

  const title = post.seoTitle || `${post.title} | Chowdhury Duo`;
  const description = post.seoDescription || post.shortDesc || `Explore "${post.title}" on Chowdhury Duo.`;
  const image = post.ogImage || post.featuredImage || "/favicon.ico";

  return {
    title,
    description,
    alternates: {
      canonical: post.canonicalUrl || `https://chowdhuryduo.com/posts/${post.slug}`,
    },
    openGraph: {
      title: post.ogTitle || title,
      description: post.ogDescription || description,
      url: `https://chowdhuryduo.com/posts/${post.slug}`,
      images: image ? [{ url: image }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.twitterTitle || title,
      description: post.twitterDescription || description,
      images: post.twitterImage || image ? [post.twitterImage || image] : [],
    },
  };
}

export default async function PostDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const post = await prisma.post.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
    include: {
      tags: true,
      categories: true,
      comments: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!post) {
    notFound();
  }

  // Also fetch latest posts for recommendations
  const recentPosts = await prisma.post.findMany({
    where: { status: "PUBLISHED", id: { not: post.id } },
    take: 3,
    orderBy: { publishDate: "desc" },
  });

  return (
    <PostDetailClient
      post={post}
      postCard={toPostCard(post as any)}
      recentPosts={recentPosts.map((p) => toPostCard(p as any))}
    />
  );
}
