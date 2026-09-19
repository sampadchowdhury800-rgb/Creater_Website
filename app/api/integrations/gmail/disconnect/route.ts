/**
 * app/api/integrations/gmail/disconnect/route.ts
 *
 * Disconnects a Gmail integration connection, scrubs local credentials,
 * and unlinks associated automation bindings.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { disconnectIntegration } from "@/lib/integrations/token-service";

export async function POST(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json(
      { success: false, errorCode: "UNAUTHORIZED", errorMessage: "Authentication required." },
      { status: 401 }
    );
  }

  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "INVALID_JSON", errorMessage: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { connectionId } = body;
  if (!connectionId || typeof connectionId !== "string") {
    return NextResponse.json(
      { success: false, errorCode: "INVALID_ARGUMENT", errorMessage: "connectionId is required." },
      { status: 400 }
    );
  }

  const result = await disconnectIntegration(clerkUserId, connectionId);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errorCode: "DISCONNECT_FAILED", errorMessage: result.error || "Failed to disconnect." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
