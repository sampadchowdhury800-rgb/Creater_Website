import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getPersonSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import ResumeClient from "./ResumeClient";

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return buildDynamicMetadata({
    title: "Sampad Chowdhury | Professional Resume & Profile",
    description:
      "Official professional resume of Sampad Chowdhury — Entrepreneur, Full Stack Developer, and Automation Specialist. Specializing in Next.js, TypeScript, Python, backend infrastructure, and business automations.",
    canonicalPath: "/resume",
    keywords: [
      "Sampad Chowdhury Resume",
      "Full Stack Developer Resume",
      "Automation Specialist Portfolio",
      "Next.js Developer India",
      "Python Automation Engineer",
      "Sampad Chowdhury",
    ],
  });
}

export default async function ResumePage() {
  const [person, services, projects] = await Promise.all([
    prisma.person.findUnique({
      where: { slug: "sampad-chowdhury" },
    }),
    prisma.service.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDesc: true,
        technologies: true,
      },
    }),
    prisma.project.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const personSchema = person
    ? getPersonSchema({
        name: person.name,
        title: person.title,
        bio: person.bio,
        slug: person.slug,
        image: person.avatarUrl,
        linkedin: person.linkedin,
        github: person.github,
        youtube: person.youtube,
        skills: person.skills,
      })
    : null;

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Resume", url: "/resume" },
  ]);

  return (
    <>
      {personSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ResumeClient
        person={person}
        services={services}
        projects={projects}
      />
    </>
  );
}
