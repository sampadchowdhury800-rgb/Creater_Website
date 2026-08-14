import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";

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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 3. Enforce order ownership
    if (order.clerkUserId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
    for (const item of order.items) {
      const match = item.automation.files.find((f) => f.id === fileId);
      if (match) {
        targetFile = match;
        break;
      }
    }

    if (!targetFile) {
      return NextResponse.json(
        { error: "Requested resource is not associated with this order." },
        { status: 404 }
      );
    }

    // 6. Stream file directly from secure storage to client (Vercel memory-safe streaming)
    const fileRes = await fetch(targetFile.fileUrl);
    if (!fileRes.ok || !fileRes.body) {
      console.error("Storage fetch failed:", targetFile.fileUrl, fileRes.status);
      return NextResponse.json(
        { error: "Failed to download resource from storage." },
        { status: 502 }
      );
    }

    return new NextResponse(fileRes.body as any, {
      status: 200,
      headers: {
        "Content-Type": targetFile.fileType || fileRes.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(targetFile.fileName || "resource")}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Secure download error:", error);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
