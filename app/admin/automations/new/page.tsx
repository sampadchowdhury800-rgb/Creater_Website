import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import AutomationForm from "../AutomationForm";

export const metadata = {
  title: "New Automation | Admin",
};

export default async function NewAutomationPage() {
  await requireAdminSession();

  const categories = await prisma.automationCategory.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <AutomationForm categories={categories} />
  );
}
