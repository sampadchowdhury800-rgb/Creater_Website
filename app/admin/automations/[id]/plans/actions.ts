"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const planSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  code: z.string().min(1, "Plan code is required").regex(/^[a-zA-Z0-9_-]+$/, "Code must be alphanumeric with dashes or underscores"),
  description: z.string().optional().nullable(),
  planType: z.enum(["TRIAL", "TIME_LIMITED", "LIFETIME"]),
  price: z.number().int().min(0, "Price cannot be negative"), // in paise
  originalPrice: z.number().int().min(0).optional().nullable(),
  currency: z.string().default("INR"),
  durationDays: z.number().int().min(1).optional().nullable(),
  trialDays: z.number().int().min(1).optional().nullable(),
  maintenanceEnabled: z.boolean().default(false),
  maintenancePrice: z.number().int().min(0).default(0), // in paise
  maintenanceInterval: z.enum(["NONE", "MONTHLY", "YEARLY"]).default("NONE"),
  maintenanceStartRule: z.enum(["IMMEDIATELY", "AFTER_ACCESS_EXPIRY"]).default("AFTER_ACCESS_EXPIRY"),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function createPlanAction(automationId: string, rawData: unknown) {
  await requireAdminSession();

  const parsed = planSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid plan data" };
  }

  const data = parsed.data;

  // Enforce type-specific invariants
  if (data.planType === "TRIAL") {
    data.price = 0;
    if (!data.trialDays || data.trialDays <= 0) {
      return { success: false, error: "Trial duration in days is required for Trial plans." };
    }
    data.durationDays = null;
    data.maintenanceEnabled = false;
    data.maintenancePrice = 0;
  } else if (data.planType === "LIFETIME") {
    data.durationDays = null;
    data.trialDays = null;
  } else if (data.planType === "TIME_LIMITED") {
    if (!data.durationDays || data.durationDays <= 0) {
      return { success: false, error: "Access duration in days is required for Time-Limited plans." };
    }
    data.trialDays = null;
  }

  if (data.maintenanceEnabled) {
    if (data.maintenancePrice <= 0) {
      return { success: false, error: "Maintenance price must be greater than zero when maintenance is enabled." };
    }
    if (data.maintenanceInterval === "NONE") {
      data.maintenanceInterval = "MONTHLY";
    }
  } else {
    data.maintenancePrice = 0;
    data.maintenanceInterval = "NONE";
  }

  try {
    const existingCode = await prisma.automationPlan.findUnique({
      where: {
        automationId_code: {
          automationId,
          code: data.code,
        },
      },
    });

    if (existingCode) {
      return { success: false, error: `A plan with code "${data.code}" already exists for this automation.` };
    }

    const plan = await prisma.automationPlan.create({
      data: {
        automationId,
        ...data,
      },
    });

    revalidatePath(`/admin/automations/${automationId}`);
    revalidatePath(`/admin/automations/${automationId}/plans`);
    revalidatePath(`/automations`);

    return { success: true, plan };
  } catch (err: any) {
    console.error("[Create Plan Error]:", err);
    return { success: false, error: err.message || "Failed to create plan." };
  }
}

export async function updatePlanAction(planId: string, rawData: unknown) {
  await requireAdminSession();

  const parsed = planSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid plan data" };
  }

  const data = parsed.data;

  // Enforce type-specific invariants
  if (data.planType === "TRIAL") {
    data.price = 0;
    if (!data.trialDays || data.trialDays <= 0) {
      return { success: false, error: "Trial duration in days is required for Trial plans." };
    }
    data.durationDays = null;
    data.maintenanceEnabled = false;
    data.maintenancePrice = 0;
  } else if (data.planType === "LIFETIME") {
    data.durationDays = null;
    data.trialDays = null;
  } else if (data.planType === "TIME_LIMITED") {
    if (!data.durationDays || data.durationDays <= 0) {
      return { success: false, error: "Access duration in days is required for Time-Limited plans." };
    }
    data.trialDays = null;
  }

  if (data.maintenanceEnabled) {
    if (data.maintenancePrice <= 0) {
      return { success: false, error: "Maintenance price must be greater than zero when maintenance is enabled." };
    }
    if (data.maintenanceInterval === "NONE") {
      data.maintenanceInterval = "MONTHLY";
    }
  } else {
    data.maintenancePrice = 0;
    data.maintenanceInterval = "NONE";
  }

  try {
    const existing = await prisma.automationPlan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      return { success: false, error: "Plan not found." };
    }

    // Check code uniqueness if changed
    if (existing.code !== data.code) {
      const duplicateCode = await prisma.automationPlan.findUnique({
        where: {
          automationId_code: {
            automationId: existing.automationId,
            code: data.code,
          },
        },
      });

      if (duplicateCode) {
        return { success: false, error: `A plan with code "${data.code}" already exists for this automation.` };
      }
    }

    // If maintenance price changed, clear razorpayPlanId so a new plan version will be generated on next subscription
    const razorpayPlanId =
      data.maintenancePrice !== existing.maintenancePrice || data.maintenanceInterval !== existing.maintenanceInterval
        ? null
        : existing.razorpayPlanId;

    const plan = await prisma.automationPlan.update({
      where: { id: planId },
      data: {
        ...data,
        razorpayPlanId,
      },
    });

    revalidatePath(`/admin/automations/${existing.automationId}`);
    revalidatePath(`/admin/automations/${existing.automationId}/plans`);
    revalidatePath(`/automations`);

    return { success: true, plan };
  } catch (err: any) {
    console.error("[Update Plan Error]:", err);
    return { success: false, error: err.message || "Failed to update plan." };
  }
}

export async function togglePlanStatusAction(planId: string) {
  await requireAdminSession();

  try {
    const plan = await prisma.automationPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) return { success: false, error: "Plan not found." };

    const updated = await prisma.automationPlan.update({
      where: { id: planId },
      data: { isActive: !plan.isActive },
    });

    revalidatePath(`/admin/automations/${plan.automationId}/plans`);
    revalidatePath(`/automations`);

    return { success: true, isActive: updated.isActive };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle plan status." };
  }
}

export async function deletePlanAction(planId: string) {
  await requireAdminSession();

  try {
    const plan = await prisma.automationPlan.findUnique({
      where: { id: planId },
      include: {
        orderItems: { select: { id: true }, take: 1 },
        entitlements: { select: { id: true }, take: 1 },
      },
    });

    if (!plan) return { success: false, error: "Plan not found." };

    // If orders or entitlements reference this plan, soft-deactivate instead of hard delete
    if (plan.orderItems.length > 0 || plan.entitlements.length > 0) {
      await prisma.automationPlan.update({
        where: { id: planId },
        data: { isActive: false },
      });

      revalidatePath(`/admin/automations/${plan.automationId}/plans`);
      revalidatePath(`/automations`);

      return {
        success: true,
        deactivated: true,
        message: "Plan has existing purchase history and was deactivated instead of deleted to preserve audit trails.",
      };
    }

    await prisma.automationPlan.delete({
      where: { id: planId },
    });

    revalidatePath(`/admin/automations/${plan.automationId}/plans`);
    revalidatePath(`/automations`);

    return { success: true, deleted: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete plan." };
  }
}
