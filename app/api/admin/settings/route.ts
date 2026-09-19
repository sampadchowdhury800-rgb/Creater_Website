import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { clearOwnerTestCache } from "@/lib/auth/owner-test";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await prisma.setting.findMany();
    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);

    return NextResponse.json({ settings: config });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Validate Owner Test Account email if provided
    if (body.ownerTestEmail !== undefined && body.ownerTestEmail !== null) {
      const testEmail = String(body.ownerTestEmail).trim().toLowerCase();
      if (testEmail) {
        // 1. Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmail)) {
          return NextResponse.json(
            { error: "Please enter a valid email address for Owner Test Account." },
            { status: 400 }
          );
        }

        // 2. Reject if equals Admin email
        const sessionAdminEmail = admin.email?.trim().toLowerCase();
        const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

        let isAdminEmailMatch =
          (sessionAdminEmail && testEmail === sessionAdminEmail) ||
          (envAdminEmail && testEmail === envAdminEmail);

        if (!isAdminEmailMatch) {
          const dbAdmin = await prisma.admin.findUnique({ where: { email: testEmail } });
          if (dbAdmin) {
            isAdminEmailMatch = true;
          }
        }

        if (isAdminEmailMatch) {
          return NextResponse.json(
            { error: "Owner Test Account must use a different email address from the Admin account." },
            { status: 400 }
          );
        }
      }
    }
    
    // Process settings updates in a transaction
    const updatePromises = Object.entries(body).map(([key, value]) => {
      return prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    });

    await prisma.$transaction(updatePromises);

    // Clear owner test account resolution cache immediately
    clearOwnerTestCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
