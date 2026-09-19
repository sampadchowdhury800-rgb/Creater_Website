import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

function getRazorpayInstance() {
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * Gets or creates a synced Razorpay Plan for an AutomationPlan's maintenance fee.
 *
 * PLAN VERSIONING:
 * If an Admin changes the maintenance price, a new Razorpay Plan is provisioned.
 * Existing subscriptions continue using their original plan_id, while new customers
 * get the updated plan_id.
 */
export async function getOrCreateRazorpayPlan(automationPlanId: string): Promise<string | null> {
  const plan = await prisma.automationPlan.findUnique({
    where: { id: automationPlanId },
    include: { automation: true },
  });

  if (!plan || !plan.maintenanceEnabled || plan.maintenancePrice <= 0) {
    return null;
  }

  // If already linked to a Razorpay plan, return it
  if (plan.razorpayPlanId) {
    return plan.razorpayPlanId;
  }

  const razorpay = getRazorpayInstance();
  const period = plan.maintenanceInterval === "YEARLY" ? "yearly" : "monthly";

  try {
    const rzpPlan = await razorpay.plans.create({
      period: period as any,
      interval: 1,
      item: {
        name: `${plan.automation.title} - ${plan.name} Maintenance`,
        amount: plan.maintenancePrice, // in paise
        currency: plan.currency || "INR",
        description: `Recurring maintenance fee for ${plan.automation.title}`,
      },
      notes: {
        automationId: plan.automationId,
        automationPlanId: plan.id,
      },
    });

    await prisma.automationPlan.update({
      where: { id: plan.id },
      data: { razorpayPlanId: rzpPlan.id },
    });

    return rzpPlan.id;
  } catch (error) {
    console.error("[Razorpay Plan Creation Failed]:", error);
    throw error;
  }
}

/**
 * Creates a recurring Razorpay Subscription for monthly maintenance.
 */
export async function createMaintenanceSubscription(params: {
  clerkUserId: string;
  automationId: string;
  planId: string;
}) {
  const { clerkUserId, automationId, planId } = params;

  const plan = await prisma.automationPlan.findUnique({
    where: { id: planId },
    include: { automation: true },
  });

  if (!plan || !plan.maintenanceEnabled || plan.maintenancePrice <= 0) {
    throw new Error("This plan does not have recurring maintenance enabled.");
  }

  const razorpayPlanId = await getOrCreateRazorpayPlan(plan.id);
  if (!razorpayPlanId) {
    throw new Error("Failed to configure Razorpay billing plan for maintenance.");
  }

  const razorpay = getRazorpayInstance();

  // Create Razorpay Subscription with 120 cycles (10 years)
  const subscription = await razorpay.subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: 120,
    quantity: 1,
    notes: {
      clerkUserId,
      automationId,
      planId,
    },
  });

  // Persist UserSubscription record in DB
  const userSub = await prisma.userSubscription.create({
    data: {
      clerkUserId,
      automationId,
      planId,
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId,
      status: "PENDING",
      chargeAmount: plan.maintenancePrice,
      currency: plan.currency || "INR",
    },
  });

  return {
    subscriptionId: subscription.id,
    userSubscriptionId: userSub.id,
    shortUrl: subscription.short_url,
  };
}

/**
 * Cancels a user's maintenance subscription at the end of the current billing cycle.
 */
export async function cancelMaintenanceSubscription(userSubscriptionId: string, clerkUserId: string) {
  const sub = await prisma.userSubscription.findUnique({
    where: { id: userSubscriptionId },
  });

  if (!sub || sub.clerkUserId !== clerkUserId) {
    throw new Error("Subscription not found or access denied.");
  }

  const razorpay = getRazorpayInstance();

  try {
    // Cancel at end of current cycle (cancel_at_cycle_end: 1)
    await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, false);
  } catch (err) {
    console.error("[Razorpay Subscription Cancel Error]:", err);
  }

  const updated = await prisma.userSubscription.update({
    where: { id: sub.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  // Update associated active entitlements
  await prisma.automationEntitlement.updateMany({
    where: {
      maintenanceSubscriptionId: sub.id,
      clerkUserId,
      automationId: sub.automationId,
    },
    data: {
      maintenanceStatus: "CANCELLED",
    },
  });

  return updated;
}
