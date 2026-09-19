import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security/ip-utils";
import crypto from "crypto";
import { z } from "zod";

// Input validation schema — strict max lengths to prevent DB bloat
const trackSchema = z.object({
  path: z
    .string()
    .max(2048, "path too long")
    .optional()
    .default("/"),
  referer: z
    .string()
    .max(2048, "referer too long")
    .nullable()
    .optional()
    .default(null),
});

// In-memory rate limiter — 10 track events per IP per minute
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const analyticsRateMap = new Map<string, RateLimitEntry>();
let lastEviction = Date.now();

function checkAnalyticsRateLimit(ip: string): boolean {
  const now = Date.now();

  // Periodic eviction every 2 minutes
  if (now - lastEviction > 120_000) {
    lastEviction = now;
    for (const [key, val] of analyticsRateMap.entries()) {
      if (now > val.resetAt) analyticsRateMap.delete(key);
    }
  }

  // Bound map size to prevent memory abuse
  if (analyticsRateMap.size > 5000) analyticsRateMap.clear();

  const entry = analyticsRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    analyticsRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting — prevent bulk DB ingestion abuse
    const ip = getClientIp(req);
    if (!checkAnalyticsRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 2. Parse and validate input
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = trackSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { path, referer } = parsed.data;

    // 3. Hash IP for privacy
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    await prisma.pageVisit.create({
      data: {
        path,
        ipHash,
        referer,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to track visit" }, { status: 500 });
  }
}
