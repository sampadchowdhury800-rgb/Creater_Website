import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { notFound } from "next/navigation";
import AutomationForm from "../AutomationForm";

export const metadata = {
  title: "Edit Automation | Admin",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAutomationPage({ params }: PageProps) {
  await requireAdminSession();
  
  const resolvedParams = await params;

  const [automation, categories] = await Promise.all([
    prisma.automation.findUnique({
      where: { id: resolvedParams.id },
      include: {
        media: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.automationCategory.findMany({
      orderBy: { name: "asc" }
    })
  ]);

  if (!automation) notFound();

  return (
    <AutomationForm initialData={automation} categories={categories} />
  );
}
