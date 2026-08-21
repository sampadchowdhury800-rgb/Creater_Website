import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import MyAutomationsClient from "./MyAutomationsClient";

export const metadata = {
  title: "My Automations | SaaS Dashboard | Chowdhury Duo",
  description: "Manage and configure your business automation workflows.",
};

export default async function MyAutomationsPage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return <MyAutomationsClient userAutomations={[]} isAuthenticated={false} />;
  }

  const userAutomations = await prisma.userAutomation.findMany({
    where: { clerkUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      automation: {
        include: {
          category: true,
        },
      },
    },
  });

  return <MyAutomationsClient userAutomations={userAutomations} isAuthenticated={true} />;
}
