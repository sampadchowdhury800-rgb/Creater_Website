import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ServiceForm from "../ServiceForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminServiceEditPage({ params }: PageProps) {
  const resolvedParams = await params;
  const isNew = resolvedParams.id === "new";

  if (isNew) {
    return <ServiceForm isNew={true} />;
  }

  const service = await prisma.service.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!service) {
    notFound();
  }

  return <ServiceForm initialData={service} isNew={false} />;
}
