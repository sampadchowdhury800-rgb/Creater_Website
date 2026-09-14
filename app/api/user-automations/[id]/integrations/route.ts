/**
 * app/api/user-automations/[id]/integrations/route.ts
 *
 * GET: Returns the integration status, requirements, and connected accounts for a workspace.
 * POST: Binds or unbinds a specific IntegrationConnection to a workspace role.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id: userAutomationId } = await params;

  const userAuto = await prisma.userAutomation.findUnique({
    where: { id: userAutomationId },
    include: {
      automation: {
        select: {
          id: true,
          title: true,
          integrationRequirements: true,
        },
      },
      integrations: {
        include: {
          integrationConnection: {
            select: {
              id: true,
              provider: true,
              accountEmail: true,
              accountName: true,
              status: true,
              lastRefreshedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!userAuto || userAuto.clerkUserId !== clerkUserId) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  // Also fetch all available active connections for this customer to populate selector dropdown if needed
  const userConnections = await prisma.integrationConnection.findMany({
    where: {
      clerkUserId,
      status: { not: "DISCONNECTED" },
    },
    select: {
      id: true,
      provider: true,
      accountEmail: true,
      accountName: true,
      status: true,
      lastRefreshedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rawReqs = (userAuto.automation.integrationRequirements ?? {}) as {
    requirements?: unknown[];
  };
  const requirements = Array.isArray(rawReqs.requirements) ? rawReqs.requirements : [];

  return NextResponse.json({
    workspaceId: userAuto.id,
    requirements,
    boundIntegrations: userAuto.integrations.map((bi) => ({
      id: bi.id,
      role: bi.role,
      connection: bi.integrationConnection,
    })),
    availableConnections: userConnections,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id: userAutomationId } = await params;

  let body: { integrationConnectionId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { integrationConnectionId, role = "gmail" } = body;
  if (!integrationConnectionId) {
    return NextResponse.json({ error: "integrationConnectionId is required." }, { status: 400 });
  }

  // Verify workspace ownership
  const userAuto = await prisma.userAutomation.findUnique({
    where: { id: userAutomationId },
    select: { clerkUserId: true },
  });
  if (!userAuto || userAuto.clerkUserId !== clerkUserId) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  // Verify connection ownership
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: integrationConnectionId },
    select: { clerkUserId: true, status: true },
  });
  if (!connection || connection.clerkUserId !== clerkUserId) {
    return NextResponse.json({ error: "Connection not found or access denied." }, { status: 403 });
  }

  if (connection.status === "DISCONNECTED") {
    return NextResponse.json({ error: "Cannot bind a disconnected account." }, { status: 400 });
  }

  // Bind or switch connection for role
  const bound = await prisma.userAutomationIntegration.upsert({
    where: {
      userAutomationId_role: {
        userAutomationId,
        role,
      },
    },
    create: {
      userAutomationId,
      integrationConnectionId,
      role,
    },
    update: {
      integrationConnectionId,
    },
  });

  return NextResponse.json({ success: true, bound });
}
