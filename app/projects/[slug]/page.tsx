import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getProjectSchema, getFaqPageSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import ProjectDetailClient from "./ProjectDetailClient";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const project = await prisma.project.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
  });

  if (!project) {
    return buildDynamicMetadata({
      title: "Project Not Found | Chowdhury Duo",
      canonicalPath: `/projects/${resolvedParams.slug}`,
    });
  }

  return buildDynamicMetadata({
    title: project.seoTitle || `${project.title} — Case Study | Chowdhury Duo`,
    description:
      project.seoDescription ||
      project.shortDesc ||
      `Case study on ${project.title} architected by Sampad Chowdhury.`,
    canonicalPath: `/projects/${project.slug}`,
    ogImage: project.ogImage,
    keywords: [
      project.title,
      ...project.technologies,
      "Case Study",
      "Sampad Chowdhury",
    ],
  });
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const project = await prisma.project.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
  });

  if (!project) {
    notFound();
  }

  const otherProjects = await prisma.project.findMany({
    where: { status: "PUBLISHED", id: { not: project.id } },
    take: 2,
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDesc: true,
      technologies: true,
    },
  });

  const projectSchema = getProjectSchema({
    title: project.title,
    slug: project.slug,
    shortDesc: project.shortDesc,
    fullDesc: project.fullDesc,
    technologies: project.technologies,
    demoUrl: project.demoUrl,
    githubUrl: project.githubUrl,
    image: project.ogImage,
  });

  const faqs = (project.faqs as any) || [];
  const faqSchema = getFaqPageSchema(faqs);

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Projects", url: "/projects" },
    { name: project.title, url: `/projects/${project.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectSchema) }}
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
      <ProjectDetailClient
        project={project}
        otherProjects={otherProjects}
      />
    </>
  );
}
