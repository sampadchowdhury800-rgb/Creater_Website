import { prisma } from "@/lib/prisma";
import AutomationsClient from "./AutomationsClient";

export const revalidate = 0; // Dynamic page

export const metadata = {
  title: "Automations Marketplace | Chowdhury Duo",
  description: "Browse and purchase premium automation tools by Chowdhury Duo.",
};

export default async function AutomationsPage() {
  const automations = await prisma.automation.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDesc: true,
      price: true,
      originalPrice: true,
      thumbnailUrl: true,
      ratingSum: true,
      reviewCount: true,
    }
  });

  return <AutomationsClient automations={automations} />;
}

