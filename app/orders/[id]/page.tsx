import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { notFound, redirect } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";

export const metadata = {
  title: "Order Details | Chowdhury Duo",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return <OrderDetailClient order={null} isAuthenticated={false} />;
  }

  const resolvedParams = await params;

  const order = await prisma.order.findUnique({
    where: { id: resolvedParams.id },
    include: {
      items: {
        include: {
          automation: {
            include: {
              files: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  if (order.clerkUserId !== userId) {
    redirect("/orders");
  }

  return <OrderDetailClient order={order} isAuthenticated={true} />;
}
