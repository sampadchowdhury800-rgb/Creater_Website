import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total visits in last 30 days
    const totalVisits = await prisma.pageVisit.count({
      where: { timestamp: { gte: thirtyDaysAgo } }
    });

    // Top paths
    const topPathsRaw = await prisma.pageVisit.groupBy({
      by: ['path'],
      _count: { path: true },
      where: { timestamp: { gte: thirtyDaysAgo } },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });
    const topPaths = topPathsRaw.map(p => ({ path: p.path, count: p._count.path }));

    // Top referrers
    const referrersRaw = await prisma.pageVisit.groupBy({
      by: ['referer'],
      _count: { referer: true },
      where: { timestamp: { gte: thirtyDaysAgo }, referer: { not: null } },
      orderBy: { _count: { referer: 'desc' } },
      take: 10,
    });
    const topReferrers = referrersRaw.map(r => ({ referer: r.referer, count: r._count.referer }));

    return NextResponse.json({
      totalVisits,
      topPaths,
      topReferrers
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
