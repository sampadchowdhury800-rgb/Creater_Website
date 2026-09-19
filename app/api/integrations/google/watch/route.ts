/**
 * app/api/integrations/google/watch/route.ts
 *
 * DEPRECATED / DECOMMISSIONED.
 * Gmail watches (Google Cloud Pub/Sub) are retired.
 * The Gmail AI Customer Support system uses scheduled polling via Supabase pg_cron.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: true,
      message: "Gmail push watches are retired. Inboxes are checked via scheduled polling.",
    },
    { status: 200 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: true,
      message: "Gmail push watches are retired.",
    },
    { status: 200 }
  );
}
