import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  const commonDisallow = [
    "/admin",
    "/admin/*",
    "/api/admin",
    "/api/admin/*",
    "/cart",
    "/wishlist",
    "/orders",
    "/orders/*",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: commonDisallow,
      },
      // Explicit rules for AI answer engines & LLM web crawlers (AEO / GEO)
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "CCBot",
          "Bytespider",
        ],
        allow: "/",
        disallow: commonDisallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
