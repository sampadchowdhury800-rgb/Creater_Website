import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getArticleSchema, getFaqPageSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteConfig";
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
      noindex: true,
      nofollow: true,
      publishDate: true,
      updatedAt: true,
      keywords: true,
    },
  });

  if (!post) return { title: "Post Not Found | Chowdhury Duo" };

  return buildDynamicMetadata({
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.shortDesc || `Explore "${post.title}" on Chowdhury Duo.`,
    canonicalPath: `/posts/${post.slug}`,
    canonicalOverride: post.canonicalUrl || undefined,
    ogImage: post.ogImage || post.featuredImage,
    ogTitle: post.ogTitle || undefined,
    ogDescription: post.ogDescription || undefined,
    twitterImage: post.twitterImage || undefined,
    twitterTitle: post.twitterTitle || undefined,
    twitterDescription: post.twitterDescription || undefined,
    noindex: post.noindex,
    nofollow: post.nofollow,
    keywords: post.keywords || undefined,
    type: "article",
    publishedTime: post.publishDate ? new Date(post.publishDate).toISOString() : undefined,
    modifiedTime: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
  });
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

  // Build structured data
  const articleSchema = getArticleSchema({
    title: post.title,
    slug: post.slug,
    shortDesc: post.shortDesc,
    content: post.content,
    image: post.ogImage || post.featuredImage,
    publishDate: post.publishDate,
    updatedAt: post.updatedAt,
  });

  const faqs = Array.isArray(post.faqs) ? post.faqs as { question: string; answer: string; sortOrder?: number }[] : [];
  const faqSchema = getFaqPageSchema(faqs);

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Posts", url: "/news" },
    { name: post.title, url: `/posts/${post.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PostDetailClient
        post={post}
        postCard={toPostCard(post as any)}
        recentPosts={recentPosts.map((p) => toPostCard(p as any))}
        directAnswer={(post as any).directAnswer || null}
        faqs={faqs}
      />
    </>
  );
}
