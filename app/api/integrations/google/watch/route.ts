/**
 * app/api/integrations/google/watch/route.ts
 *
 * Configures or removes real-time Gmail push notification watches for a connection.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { setupWatchForConnection, stopWatchForConnection } from "@/lib/integrations/watch-service";

export async function POST(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { connectionId } = body;
  if (!connectionId || typeof connectionId !== "string") {
    return NextResponse.json({ error: "connectionId is required." }, { status: 400 });
  }

  const result = await setupWatchForConnection(connectionId, clerkUserId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.errorMessage || "Failed to setup Gmail watch." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    historyId: result.historyId,
    expiration: result.expiration,
  });
}

export async function DELETE(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId query parameter is required." }, { status: 400 });
  }

  const result = await stopWatchForConnection(connectionId, clerkUserId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.errorMessage || "Failed to stop Gmail watch." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
