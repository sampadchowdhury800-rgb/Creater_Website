import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { notFound } from "next/navigation";
import PlansManagerClient from "./PlansManagerClient";

export const metadata = {
  title: "Pricing & Plans Manager | Admin",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AutomationPlansPage({ params }: PageProps) {
  await requireAdminSession();

  const { id } = await params;

  const automation = await prisma.automation.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      plans: {
        orderBy: [
          { sortOrder: "asc" },
          { price: "asc" },
        ],
      },
    },
  });

  if (!automation) notFound();

  return (
    <PlansManagerClient
      automation={{
        id: automation.id,
        title: automation.title,
        slug: automation.slug,
        price: automation.price,
      }}
      initialPlans={automation.plans as any}
    />
  );
}
