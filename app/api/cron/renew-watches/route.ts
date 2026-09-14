/**
 * app/api/cron/renew-watches/route.ts
 *
 * Scheduled endpoint to proactively renew Gmail Pub/Sub push watches expiring within 48 hours.
 * Secured by CRON_SECRET header authorization.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { renewExpiringWatches } from "@/lib/integrations/watch-service";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, errorMessage: "Unauthorized cron execution." },
        { status: 401 }
      );
    }
  }

  try {
    const result = await renewExpiringWatches();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        errorMessage: err?.message || "Failed to renew watches.",
      },
      { status: 500 }
    );
  }
}
