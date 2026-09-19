/**
 * app/api/cron/renew-watches/route.ts
 *
 * DEPRECATED.
 * Gmail watches (Google Cloud Pub/Sub) are retired.
 * Scheduled polling replaces push watches, so watch renewals are no longer required.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Gmail watches are retired. Scheduled polling is active; no watches to renew.",
    timestamp: new Date().toISOString(),
  });
}
