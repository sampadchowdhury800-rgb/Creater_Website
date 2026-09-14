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

    const { id: userAutomationId, fileId } = await params;

    // 2. Fetch UserAutomation workspace record with ownership check
    const userAutomation = await prisma.userAutomation.findUnique({
      where: { id: userAutomationId },
      include: {
        automation: {
          include: {
            files: true,
          },
        },
      },
    });

    if (!userAutomation) {
      return NextResponse.json(
        { error: "Automation workspace not found." },
        { status: 404 }
      );
    }

    // 3. Enforce strict workspace ownership (IDOR Protection)
    if (userAutomation.clerkUserId !== userId) {
      return NextResponse.json(
        { error: "Access denied. You do not own this automation workspace." },
        { status: 403 }
      );
    }

    // 4. Verify underlying automation product
    const automation = userAutomation.automation;
    if (!automation) {
      return NextResponse.json(
        { error: "Automation product not found." },
        { status: 404 }
      );
    }

    if (automation.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "This automation product has been archived." },
        { status: 403 }
      );
    }

    // 5. Verify the requested file is bound to this specific automation
    const targetFile = automation.files.find((f) => f.id === fileId);
    if (!targetFile) {
      return NextResponse.json(
        { error: "Requested resource is not associated with this automation workspace." },
        { status: 404 }
      );
    }

    // 6. Enforce active entitlement / lifetime access
    const access = await checkAutomationAccess(userId, automation.id);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.errorMessage || "Access pass has expired. Please renew your plan to download files." },
        { status: 403 }
      );
    }

    // 7. Stream file directly from secure storage via server-side signed retrieval
    return await streamProtectedDeliverable(targetFile);
  } catch (error) {
    console.error("[SecureDownload] Workspace download error:", error);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
