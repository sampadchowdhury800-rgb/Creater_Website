import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";
import type { Metadata } from "next";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const automation = await prisma.automation.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
    select: { title: true, shortDesc: true, thumbnailUrl: true }
  });

  if (!automation) return { title: "Not Found" };

  return {
    title: `${automation.title} | Automations | Chowdhury Duo`,
    description: automation.shortDesc || `Get the ${automation.title} automation by Chowdhury Duo.`,
    openGraph: {
      title: automation.title,
      description: automation.shortDesc || "",
      images: automation.thumbnailUrl ? [{ url: automation.thumbnailUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: automation.title,
      description: automation.shortDesc || "",
      images: automation.thumbnailUrl ? [automation.thumbnailUrl] : [],
    },
  };
}

export default async function AutomationProductPage({ params }: PageProps) {
  const resolvedParams = await params;
  const automation = await prisma.automation.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
    include: {
      category: true,
      media: {
        orderBy: { sortOrder: "asc" }
      },
      // reviews and comments can be fetched client-side or we can pass initial data
    }
  });

  if (!automation) {
    notFound();
  }

  return <ProductClient automation={automation} />;
}
