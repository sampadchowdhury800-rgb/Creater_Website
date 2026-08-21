import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { notFound, redirect } from "next/navigation";
import WorkspaceClient from "./WorkspaceClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: PageProps) {
  const resolvedParams = await params;
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/automations");
  }

  const userAutomation = await prisma.userAutomation.findFirst({
    where: {
      id: resolvedParams.id,
      clerkUserId: userId,
    },
    include: {
      automation: {
        include: {
          category: true,
          files: true,
        },
      },
    },
  });

  if (!userAutomation) {
    notFound();
  }

  return <WorkspaceClient userAutomation={userAutomation} />;
}
