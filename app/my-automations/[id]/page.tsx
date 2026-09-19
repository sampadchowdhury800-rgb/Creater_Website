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
          category: {
            select: { name: true },
          },
          files: {
            select: {
              id: true,
              title: true,
              fileName: true,
              fileSize: true,
              fileType: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!userAutomation) {
    notFound();
  }

  // DTO Sanitization: Strip n8nWorkflowId, fileUrl, and publicId before sending to client
  const safeUserAutomation = {
    id: userAutomation.id,
    status: userAutomation.status,
    config: (userAutomation.config as Record<string, unknown>) ?? null,
    automation: {
      id: userAutomation.automation.id,
      title: userAutomation.automation.title,
      slug: userAutomation.automation.slug,
      shortDesc: userAutomation.automation.shortDesc,
      description: userAutomation.automation.description,
      integrations: userAutomation.automation.integrations,
      status: userAutomation.automation.status,
      isExecutable: userAutomation.automation.isExecutable,
      executionMode: userAutomation.automation.executionMode as "MANUAL" | "EVENT_DRIVEN",
      hasWorkflow: Boolean(userAutomation.automation.n8nWorkflowId),
      configSchema: (userAutomation.automation.configSchema as Record<string, unknown>) ?? null,
      category: userAutomation.automation.category,
      files: userAutomation.automation.files.map((f) => ({
        id: f.id,
        title: f.title,
        fileName: f.fileName,
        fileSize: f.fileSize,
        fileType: f.fileType,
      })),
    },
  };

  return <WorkspaceClient userAutomation={safeUserAutomation} />;
}

