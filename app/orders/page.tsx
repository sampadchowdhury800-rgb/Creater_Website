import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "My Orders | Chowdhury Duo",
};

export default async function OrdersPage() {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    return <OrdersClient orders={[]} isAuthenticated={false} />;
  }

  const orders = await prisma.order.findMany({
    where: { clerkUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { automation: true }
      }
    }
  });

  return <OrdersClient orders={orders} isAuthenticated={true} />;
}
