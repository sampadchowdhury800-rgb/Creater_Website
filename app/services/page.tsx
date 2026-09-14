import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getOrganizationSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import ServicesClient from "./ServicesClient";

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return buildDynamicMetadata({
    title: "Engineering & Automation Services | Chowdhury Duo",
    description:
      "Explore full-stack web application development, business workflow automation pipelines, custom SaaS platforms, API & database architecture, and DevOps solutions.",
    canonicalPath: "/services",
    keywords: [
      "Full Stack Development Services",
      "Business Automation Services",
      "n8n Workflow Automation",
      "Next.js Development Agency",
      "Python AI Backend",
      "SaaS Development India",
      "DevOps and Cloud Infrastructure",
    ],
  });
}

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  const orgSchema = getOrganizationSchema();
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Services", url: "/services" },
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
      <ServicesClient services={services} />
    </>
  );
}
