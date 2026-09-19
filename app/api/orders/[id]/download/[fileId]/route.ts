import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { checkAutomationAccess } from "@/lib/entitlement/checker";
import { streamProtectedDeliverable } from "@/lib/storage/protected-download";

interface RouteParams {
  params: Promise<{
    id: string;
    fileId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Verify Clerk user authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId, fileId } = await params;

    // 2. Fetch order with ownership check
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            automation: {
              include: {
                files: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // 3. Enforce order ownership (IDOR Protection)
    if (order.clerkUserId !== userId) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // 4. Verify payment status
    if (order.paymentStatus !== "PAID" || order.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Payment confirmation required to download resources." },
        { status: 403 }
      );
    }

    // 5. Verify the file belongs to an automation in this order
    let targetFile = null;
    let targetAutomationId: string | null = null;
    for (const item of order.items) {
      const match = item.automation?.files.find((f) => f.id === fileId);
      if (match) {
        targetFile = match;
        targetAutomationId = item.automationId;
        break;
      }
    }

    if (!targetFile || !targetAutomationId) {
      return NextResponse.json(
        { error: "Requested resource is not associated with this order." },
        { status: 404 }
      );
    }

    // 6. Enforce active entitlement or lifetime ownership
    const access = await checkAutomationAccess(userId, targetAutomationId);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.errorMessage || "Access pass has expired. Please renew your plan to download files." },
        { status: 403 }
      );
    }

    // 7. Stream file directly from secure storage to client via server-signed retrieval
    return await streamProtectedDeliverable(targetFile);
  } catch (error) {
    console.error("[SecureDownload] Order download error:", error);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
