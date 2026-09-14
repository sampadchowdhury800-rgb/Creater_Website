import { prisma } from "@/lib/prisma";

export interface EntitlementAccessResult {
  hasAccess: boolean;
  reason:
    | "VALID"
    | "LIFETIME"
    | "TRIAL_ACTIVE"
    | "EXPIRED"
    | "TRIAL_EXPIRED"
    | "MAINTENANCE_PAST_DUE"
    | "NO_ENTITLEMENT"
    | "REVOKED";
  effectiveEntitlement?: any;
  remainingDays?: number | null;
  isLifetime?: boolean;
  isTrial?: boolean;
  maintenanceStatus?: string;
  errorMessage?: string;
}

/**
 * Deterministically evaluates access authority for a user and an automation product.
 *
 * PRECEDENCE RULES:
 * 1. Lifetime entitlement takes highest precedence unless maintenance is past due beyond grace.
 * 2. Active time-limited entitlement (with latest expiry) takes second precedence.
 * 3. Active trial entitlement takes third precedence.
 * 4. Expired entitlement blocks access without destroying workspace or secrets.
 * 5. Missing entitlement returns NO_ENTITLEMENT.
 */
export async function checkAutomationAccess(
  clerkUserId: string,
  automationId: string
): Promise<EntitlementAccessResult> {
  if (!clerkUserId || !automationId) {
    return {
      hasAccess: false,
      reason: "NO_ENTITLEMENT",
      errorMessage: "User ID and Automation ID are required.",
    };
  }

  const entitlements = await prisma.automationEntitlement.findMany({
    where: {
      clerkUserId,
      automationId,
      status: { notIn: ["REVOKED", "SUPERSEDED"] },
    },
    include: {
      plan: true,
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!entitlements || entitlements.length === 0) {
    return {
      hasAccess: false,
      reason: "NO_ENTITLEMENT",
      errorMessage: "No entitlement found for this automation.",
    };
  }

  const now = new Date();

  // 1. Check Lifetime Entitlements
  const lifetime = entitlements.find((e) => e.isLifetime && e.status === "ACTIVE");
  if (lifetime) {
    // Check maintenance if required
    if (
      lifetime.maintenanceStatus === "PAST_DUE" &&
      lifetime.gracePeriodEndsAt &&
      now > lifetime.gracePeriodEndsAt
    ) {
      return {
        hasAccess: false,
        reason: "MAINTENANCE_PAST_DUE",
        effectiveEntitlement: lifetime,
        isLifetime: true,
        maintenanceStatus: lifetime.maintenanceStatus,
        errorMessage: "Maintenance payment is past due. Access is temporarily suspended until renewed.",
      };
    }

    return {
      hasAccess: true,
      reason: "LIFETIME",
      effectiveEntitlement: lifetime,
      isLifetime: true,
      remainingDays: null,
      maintenanceStatus: lifetime.maintenanceStatus,
    };
  }

  // 2. Check Active Time-Limited Entitlements
  const activeTimeLimited = entitlements.filter(
    (e) => !e.isLifetime && e.status === "ACTIVE" && e.expiresAt && e.expiresAt > now
  );

  if (activeTimeLimited.length > 0) {
    // Pick the one with the furthest expiry
    activeTimeLimited.sort(
      (a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0)
    );
    const bestEntitlement = activeTimeLimited[0];

    // Check maintenance status
    if (
      bestEntitlement.maintenanceStatus === "PAST_DUE" &&
      bestEntitlement.gracePeriodEndsAt &&
      now > bestEntitlement.gracePeriodEndsAt
    ) {
      return {
        hasAccess: false,
        reason: "MAINTENANCE_PAST_DUE",
        effectiveEntitlement: bestEntitlement,
        isLifetime: false,
        maintenanceStatus: bestEntitlement.maintenanceStatus,
        errorMessage: "Maintenance payment is past due. Access is temporarily suspended until renewed.",
      };
    }

    const remainingDays = Math.ceil(
      ((bestEntitlement.expiresAt?.getTime() ?? 0) - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      hasAccess: true,
      reason: "VALID",
      effectiveEntitlement: bestEntitlement,
      isLifetime: false,
      remainingDays,
      maintenanceStatus: bestEntitlement.maintenanceStatus,
    };
  }

  // 3. Check Active Trial Entitlements
  const activeTrial = entitlements.find(
    (e) => e.status === "TRIAL" && e.expiresAt && e.expiresAt > now
  );

  if (activeTrial) {
    const remainingDays = Math.ceil(
      ((activeTrial.expiresAt?.getTime() ?? 0) - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      hasAccess: true,
      reason: "TRIAL_ACTIVE",
      effectiveEntitlement: activeTrial,
      isLifetime: false,
      isTrial: true,
      remainingDays,
      maintenanceStatus: activeTrial.maintenanceStatus,
    };
  }

  // 4. If all entitlements are expired
  const hadTrial = entitlements.some((e) => e.status === "TRIAL");
  return {
    hasAccess: false,
    reason: hadTrial ? "TRIAL_EXPIRED" : "EXPIRED",
    effectiveEntitlement: entitlements[0],
    isLifetime: false,
    remainingDays: 0,
    errorMessage: hadTrial
      ? "Your trial period has ended. Upgrade to a paid plan to continue using this automation."
      : "Your access pass has expired. Please renew your plan to continue execution.",
  };
}

/**
 * Provisions a new entitlement or extends an existing active entitlement upon purchase.
 *
 * EXTENSION RULE:
 * If the user already has an active time-limited entitlement, the duration is added
 * to the CURRENT expiresAt timestamp (so the user loses zero remaining days).
 * If the plan is Lifetime, isLifetime becomes true immediately.
 */
export async function grantOrExtendEntitlement(params: {
  clerkUserId: string;
  automationId: string;
  planId?: string | null;
  orderId?: string | null;
  userAutomationId?: string | null;
  durationDays?: number | null;
  isLifetime?: boolean;
  maintenancePrice?: number;
  maintenanceEnabled?: boolean;
}) {
  const {
    clerkUserId,
    automationId,
    planId,
    orderId,
    userAutomationId,
    durationDays,
    isLifetime = false,
    maintenanceEnabled = false,
  } = params;

  const now = new Date();

  // If lifetime purchase
  if (isLifetime || durationDays === null || durationDays === undefined) {
    return prisma.automationEntitlement.create({
      data: {
        clerkUserId,
        automationId,
        planId: planId || undefined,
        orderId: orderId || undefined,
        userAutomationId: userAutomationId || undefined,
        status: "ACTIVE",
        isLifetime: true,
        startsAt: now,
        expiresAt: null,
        maintenanceStatus: maintenanceEnabled ? "ACTIVE" : "NOT_APPLICABLE",
      },
    });
  }

  // Check for existing active entitlement to extend
  const existingActive = await prisma.automationEntitlement.findFirst({
    where: {
      clerkUserId,
      automationId,
      status: "ACTIVE",
      isLifetime: false,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "desc" },
  });

  let newExpiresAt: Date;
  if (existingActive?.expiresAt) {
    // Add days to current expiry
    newExpiresAt = new Date(existingActive.expiresAt.getTime() + durationDays * 86400000);
  } else {
    // Starts from now
    newExpiresAt = new Date(now.getTime() + durationDays * 86400000);
  }

  return prisma.automationEntitlement.create({
    data: {
      clerkUserId,
      automationId,
      planId: planId || undefined,
      orderId: orderId || undefined,
      userAutomationId: userAutomationId || undefined,
      status: "ACTIVE",
      isLifetime: false,
      startsAt: now,
      expiresAt: newExpiresAt,
      maintenanceStatus: maintenanceEnabled ? "ACTIVE" : "NOT_APPLICABLE",
    },
  });
}
