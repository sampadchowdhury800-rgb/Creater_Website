import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, cleanupAuthData } from "@/lib/session";

export async function POST(req: NextRequest) {
  // Fire and forget cleanup
  cleanupAuthData();

  try {
    // Basic CSRF Protection: Verify Origin/Referer against Host
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (cookieValue && cookieValue.includes(".")) {
      const [token] = cookieValue.split(".");

      // 1. Audit Log
      const session = await prisma.adminSession.findUnique({
        where: { token },
        select: { adminId: true },
      });

      if (session) {
        const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
        const userAgent = req.headers.get("user-agent") || "Unknown";
        
        await prisma.auditLog.create({
          data: {
            action: "LOGOUT",
            ipAddress,
            userAgent,
            details: `Admin ID: ${session.adminId}`,
          },
        });
      }

      // 2. Delete Session from DB
      await prisma.adminSession.delete({
        where: { token },
      }).catch(() => {});
    }

    // 3. Clear Cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
