import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getOrganizationSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import ProjectsClient from "./ProjectsClient";

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return buildDynamicMetadata({
    title: "Engineering Projects & Case Studies | Chowdhury Duo",
    description:
      "Explore real-world full-stack web applications, mobile platforms, and algorithmic automation case studies architected by Sampad Chowdhury.",
    canonicalPath: "/projects",
    keywords: [
      "Full Stack Projects",
      "Software Case Studies",
      "Next.js Project Showcase",
      "Flutter Mobile App Case Study",
      "Python Automation Projects",
      "Sampad Chowdhury Portfolio",
    ],
  });
}

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  const orgSchema = getOrganizationSchema();
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Projects", url: "/projects" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ProjectsClient projects={projects} />
    </>
  );
}
