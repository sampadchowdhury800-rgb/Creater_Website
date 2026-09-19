import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildDynamicMetadata } from "@/lib/seo";
import { getServiceSchema, getFaqPageSchema, getBreadcrumbSchema } from "@/lib/jsonld";
import ServiceDetailClient from "./ServiceDetailClient";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const service = await prisma.service.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
  });

  if (!service) {
    return buildDynamicMetadata({
      title: "Service Not Found | Chowdhury Duo",
      canonicalPath: `/services/${resolvedParams.slug}`,
    });
  }

  return buildDynamicMetadata({
    title: service.seoTitle || `${service.name} | Chowdhury Duo Services`,
    description:
      service.seoDescription ||
      service.shortDesc ||
      `Explore ${service.name} architectural capabilities, features, and use cases by Chowdhury Duo.`,
    canonicalPath: `/services/${service.slug}`,
    ogImage: service.ogImage,
    keywords: [
      service.name,
      ...service.technologies,
      "Chowdhury Duo Services",
      "Sampad Chowdhury",
    ],
  });
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const service = await prisma.service.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
  });

  if (!service) {
    notFound();
  }

  // Fetch other services for related navigation
  const otherServices = await prisma.service.findMany({
    where: { status: "PUBLISHED", id: { not: service.id } },
    take: 3,
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDesc: true,
      icon: true,
    },
  });

  const serviceSchema = getServiceSchema({
    name: service.name,
    slug: service.slug,
    shortDesc: service.shortDesc,
    fullDesc: service.fullDesc,
    image: service.ogImage || service.coverImage,
  });

  const faqs = (service.faqs as any) || [];
  const faqSchema = getFaqPageSchema(faqs);

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Services", url: "/services" },
    { name: service.name, url: `/services/${service.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
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
      <ServiceDetailClient service={service} otherServices={otherServices} />
    </>
  );
}
