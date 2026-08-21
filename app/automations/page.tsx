import { prisma } from "@/lib/prisma";
import AutomationsClient from "./AutomationsClient";

export const revalidate = 0; // Dynamic page

export const metadata = {
  title: "Automation SaaS Marketplace | Chowdhury Duo",
  description: "Automate repetitive business workflows with enterprise-grade ready-to-use automation products.",
};

export default async function AutomationsPage() {
  const [automations, categories] = await Promise.all([
    prisma.automation.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDesc: true,
        price: true,
        originalPrice: true,
        pricingType: true,
        featured: true,
        thumbnailUrl: true,
        ratingSum: true,
        reviewCount: true,
        integrations: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    prisma.automationCategory.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  return <AutomationsClient automations={automations} dbCategories={categories} />;
}
