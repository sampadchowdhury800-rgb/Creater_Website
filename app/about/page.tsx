import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getOrganizationSchema, getPersonSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import AboutClient from "./AboutClient";

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return buildDynamicMetadata({
    title: "About Chowdhury Duo & Founders | Sampad Chowdhury",
    description:
      "Learn about Chowdhury Duo — founded by Sampad Chowdhury (Entrepreneur, Full Stack Developer & Automation Specialist) and co-creator Bharti Shaw. Discover our mission, tech stack, and engineering capabilities.",
    canonicalPath: "/about",
    keywords: [
      "About Chowdhury Duo",
      "Sampad Chowdhury",
      "Bharti Shaw",
      "Full Stack Developer India",
      "Automation Specialist",
      "Next.js Development",
      "AI Workflow Automation",
    ],
  });
}

export default async function AboutPage() {
  const [people, services, projects, settingsList] = await Promise.all([
    prisma.person.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.service.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDesc: true,
        category: true,
        icon: true,
      },
    }),
    prisma.project.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDesc: true,
        role: true,
        technologies: true,
      },
    }),
    prisma.setting.findMany(),
  ]);

  const settings = settingsList.reduce(
    (acc, s) => ({ ...acc, [s.key]: s.value }),
    {} as Record<string, string>
  );

  const orgSchema = getOrganizationSchema();
  const sampad = people.find((p) => p.slug === "sampad-chowdhury");
  const personSchema = sampad
    ? getPersonSchema({
        name: sampad.name,
        title: sampad.title,
        bio: sampad.bio,
        slug: sampad.slug,
        image: sampad.avatarUrl,
        linkedin: sampad.linkedin,
        github: sampad.github,
        youtube: sampad.youtube,
        skills: sampad.skills,
      })
    : null;

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "About", url: "/about" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
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
      <AboutClient
        people={people}
        services={services}
        projects={projects}
        settings={settings}
      />
    </>
  );
}
