import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PersonForm from "../PersonForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPersonEditPage({ params }: PageProps) {
  const resolvedParams = await params;
  const isNew = resolvedParams.id === "new";

  if (isNew) {
    return <PersonForm isNew={true} />;
  }

  const person = await prisma.person.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!person) {
    notFound();
  }

  return <PersonForm initialData={person} isNew={false} />;
}
