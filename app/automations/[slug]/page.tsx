import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { isOwnerTestAccount } from "@/lib/auth/owner-test";
import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";
import { checkAutomationAccess } from "@/lib/entitlement/checker";
import type { Metadata } from "next";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const automation = await prisma.automation.findUnique({
    where: { slug: resolvedParams.slug, status: "PUBLISHED" },
    select: { title: true, shortDesc: true, thumbnailUrl: true },
  });

  if (!automation) return { title: "Not Found" };

  return {
    title: `${automation.title} | Automations | Chowdhury Duo`,
    description: automation.shortDesc || `Get the ${automation.title} automation by Chowdhury Duo.`,
    openGraph: {
      title: automation.title,
      description: automation.shortDesc || "",
      images: automation.thumbnailUrl ? [{ url: automation.thumbnailUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: automation.title,
      description: automation.shortDesc || "",
      images: automation.thumbnailUrl ? [automation.thumbnailUrl] : [],
    },
  };
}

export default async function AutomationProductPage({ params }: PageProps) {
  const resolvedParams = await params;
  const userId = await getCurrentUserId();
  const isOwner = await isOwnerTestAccount(userId);

  const automation = await prisma.automation.findFirst({
    where: {
      slug: resolvedParams.slug,
      ...(isOwner ? {} : { status: "PUBLISHED" }),
    },
    include: {
      category: true,
      media: {
        orderBy: { sortOrder: "asc" },
      },
      plans: {
        where: { isActive: true },
        orderBy: [
          { sortOrder: "asc" },
          { price: "asc" },
        ],
      },
    },
  });

  if (!automation) {
    notFound();
  }

  const [existingWorkspace, accessResult] = await Promise.all([
    userId
      ? prisma.userAutomation.findUnique({
          where: {
            clerkUserId_automationId: {
              clerkUserId: userId,
              automationId: automation.id,
            },
          },
          select: { id: true },
        })
      : null,
    userId ? checkAutomationAccess(userId, automation.id) : null,
  ]);

  return (
    <ProductClient
      automation={automation}
      existingUserAutomationId={existingWorkspace?.id || null}
      accessResult={
        accessResult
          ? {
              hasAccess: accessResult.hasAccess,
              reason: accessResult.reason,
              remainingDays: accessResult.remainingDays ?? null,
              isLifetime: !!accessResult.isLifetime,
              isTrial: !!accessResult.isTrial,
              maintenanceStatus: accessResult.maintenanceStatus ?? "NOT_APPLICABLE",
              errorMessage: accessResult.errorMessage ?? null,
            }
          : null
      }
    />
  );
}
