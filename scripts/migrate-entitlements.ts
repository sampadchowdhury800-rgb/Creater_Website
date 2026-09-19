/**
 * migrate-entitlements.ts
 *
 * Grandfathering & Entitlement Backfill Script
 *
 * Finds all existing UserAutomation records in the database.
 * If any UserAutomation does not have an AutomationEntitlement,
 * it creates a grandfathered Lifetime entitlement with no maintenance requirement,
 * ensuring no legitimate existing owner loses access to their automations.
 */

import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting Entitlement Grandfathering & Backfill...");

  const userAutomations = await prisma.userAutomation.findMany({
    include: {
      automation: true,
      entitlements: true,
    },
  });

  console.log(`Found ${userAutomations.length} UserAutomation records.`);

  let createdCount = 0;
  let alreadyCoveredCount = 0;

  for (const ua of userAutomations) {
    if (ua.entitlements && ua.entitlements.length > 0) {
      alreadyCoveredCount++;
      continue;
    }

    // Check if there are any existing entitlements for this clerkUserId and automationId
    const existingEntitlement = await prisma.automationEntitlement.findFirst({
      where: {
        clerkUserId: ua.clerkUserId,
        automationId: ua.automationId,
      },
    });

    if (existingEntitlement) {
      // Link to UserAutomation if unlinked
      if (!existingEntitlement.userAutomationId) {
        await prisma.automationEntitlement.update({
          where: { id: existingEntitlement.id },
          data: { userAutomationId: ua.id },
        });
      }
      alreadyCoveredCount++;
      continue;
    }

    // Grandfather as Lifetime Active Entitlement with NO maintenance requirement
    await prisma.automationEntitlement.create({
      data: {
        clerkUserId: ua.clerkUserId,
        automationId: ua.automationId,
        userAutomationId: ua.id,
        status: "ACTIVE",
        isLifetime: true,
        startsAt: ua.createdAt || new Date(),
        expiresAt: null,
        maintenanceStatus: "NOT_APPLICABLE",
        notes: "Grandfathered lifetime access from legacy ownership",
      },
    });

    createdCount++;
    console.log(
      `✓ Grandfathered UserAutomation ${ua.id} for user ${ua.clerkUserId} (Product: "${ua.automation.title}")`
    );
  }

  console.log("Grandfathering migration complete.");
  console.log({
    totalProcessed: userAutomations.length,
    newlyGrandfathered: createdCount,
    alreadyCovered: alreadyCoveredCount,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
