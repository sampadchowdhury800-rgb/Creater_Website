/**
 * app/api/integrations/google/disconnect/route.ts
 *
 * Disconnects an integration connection, scrubs local credentials,
 * unlinks workspaces, and attempts upstream token revocation.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { disconnectIntegration } from "@/lib/integrations/token-service";

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

  const result = await disconnectIntegration(clerkUserId, connectionId);

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to disconnect." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
