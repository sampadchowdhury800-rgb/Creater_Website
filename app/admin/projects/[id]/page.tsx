import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProjectForm from "../ProjectForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProjectEditPage({ params }: PageProps) {
  const resolvedParams = await params;
  const isNew = resolvedParams.id === "new";

  if (isNew) {
    return <ProjectForm isNew={true} />;
  }

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!project) {
    notFound();
  }

  return <ProjectForm initialData={project} isNew={false} />;
}
