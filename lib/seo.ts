import type { Metadata } from "next";
import { siteConfig, getCanonicalUrl, getAbsoluteImageUrl } from "./siteConfig";

export interface DynamicSeoOptions {
  title?: string | null;
  description?: string | null;
  canonicalPath?: string | null;
  canonicalOverride?: string | null;
  ogImage?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  keywords?: string[] | string | null;
  noindex?: boolean;
  nofollow?: boolean;
  type?: "website" | "article" | "profile";
  publishedTime?: string | null;
  modifiedTime?: string | null;
}

/**
 * Builds dynamic metadata with intelligent, future-proof fallbacks.
 * When admin leaves SEO fields blank, sensible defaults are automatically populated.
 */
export function buildDynamicMetadata(opts: DynamicSeoOptions): Metadata {
  const rawTitle = opts.title?.trim();
  const pageTitle = rawTitle
    ? rawTitle.includes(siteConfig.name)
      ? rawTitle
      : `${rawTitle} | ${siteConfig.name}`
    : `${siteConfig.name} — ${siteConfig.tagline}`;

  const metaDescription =
    opts.description?.trim() || siteConfig.shortDescription;

  const canonicalUrl =
    opts.canonicalOverride?.trim() ||
    getCanonicalUrl(opts.canonicalPath || "");

  const ogImageUrl = getAbsoluteImageUrl(opts.ogImage || opts.twitterImage);

  const keywordsArray = Array.isArray(opts.keywords)
    ? opts.keywords
    : typeof opts.keywords === "string"
    ? opts.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : [
        "Chowdhury Duo",
        "Sampad Chowdhury",
        "Full Stack Developer",
        "Business Automation",
        "AI Chatbots",
        "SaaS Development",
        "Next.js Developer",
        "Python Developer",
      ];

  return {
    title: pageTitle,
    description: metaDescription,
    keywords: keywordsArray,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: !opts.noindex,
      follow: !opts.nofollow,
      googleBot: {
        index: !opts.noindex,
        follow: !opts.nofollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title: opts.ogTitle?.trim() || pageTitle,
      description: opts.ogDescription?.trim() || metaDescription,
      url: canonicalUrl,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
      type: opts.type || "website",
      ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      ...(opts.modifiedTime ? { modifiedTime: opts.modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: opts.twitterTitle?.trim() || opts.ogTitle?.trim() || pageTitle,
      description:
        opts.twitterDescription?.trim() ||
        opts.ogDescription?.trim() ||
        metaDescription,
      images: [ogImageUrl],
    },
  };
}
