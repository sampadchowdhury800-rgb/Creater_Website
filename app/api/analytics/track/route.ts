import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { path, referer } = await req.json();
    
    // Hash IP for privacy
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    await prisma.pageVisit.create({
      data: {
        path: path || "/",
        ipHash,
        referer: referer || null,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to track visit" }, { status: 500 });
  }
}
