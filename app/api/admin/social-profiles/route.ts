import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

export async function GET() {
  try {
    await requireAdminSession();
    const profiles = await prisma.socialProfile.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = await request.json();
    const profile = await prisma.socialProfile.create({
      data: {
        platform: body.platform,
        label: body.label,
        url: body.url,
        icon: body.icon || null,
        color: body.color || null,
        isOfficial: body.isOfficial ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
