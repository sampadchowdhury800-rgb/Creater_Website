import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/siteConfig";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  let automations: Array<{ slug: string; updatedAt: Date }> = [];
  let posts: Array<{ slug: string; updatedAt: Date }> = [];
  let services: Array<{ slug: string; updatedAt: Date }> = [];
  let projects: Array<{ slug: string; updatedAt: Date }> = [];

  try {
    const [dbAutomations, dbPosts, dbServices, dbProjects] = await Promise.all([
      prisma.automation.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { status: "PUBLISHED", noindex: false },
        select: { slug: true, updatedAt: true },
      }),
      prisma.service.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.project.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    automations = dbAutomations;
    posts = dbPosts;
    services = dbServices;
    projects = dbProjects;
  } catch (err) {
    console.error("Sitemap generation error:", err);
  }

  const automationUrls: MetadataRoute.Sitemap = automations.map((a) => ({
    url: `${baseUrl}/automations/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${baseUrl}/posts/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const serviceUrls: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${baseUrl}/services/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const projectUrls: MetadataRoute.Sitemap = projects.map((pr) => ({
    url: `${baseUrl}/projects/${pr.slug}`,
    lastModified: pr.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/resume`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/automations`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/achievements`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/bharti-shaw`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  return [
    ...staticUrls,
    ...serviceUrls,
    ...projectUrls,
    ...automationUrls,
    ...postUrls,
  ];
}
