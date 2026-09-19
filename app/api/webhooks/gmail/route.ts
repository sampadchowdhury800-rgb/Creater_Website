/**
 * app/api/webhooks/gmail/route.ts
 *
 * DEPRECATED / DECOMMISSIONED.
 * Google Cloud Pub/Sub push notifications have been permanently retired.
 * The Gmail AI Customer Support platform now operates exclusively via
 * scheduled polling against the Gmail REST API (Supabase Edge Function: gmail-check).
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Google Cloud Pub/Sub webhook is decommissioned. Gmail automation runs via scheduled polling.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      status: "decommissioned",
      message: "Gmail automation uses scheduled polling. Pub/Sub push notifications are retired.",
    },
    { status: 410 }
  );
}
