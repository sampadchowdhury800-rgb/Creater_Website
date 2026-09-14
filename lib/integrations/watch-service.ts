/**
 * lib/integrations/watch-service.ts
 *
 * Registration, renewal, and teardown service for Gmail Pub/Sub push watches.
 * Ensures multi-tenant isolation, automatic lease refresh, and state tracking.
 * SERVER-SIDE ONLY.
 */

import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/integrations/token-service";
import { executeGmailWatch, executeGmailStopWatch } from "@/lib/integrations/providers/google";

export interface WatchSetupResult {
  success: boolean;
  historyId?: string;
  expiration?: Date;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Registers or renews a Gmail Pub/Sub push watch for a specific customer integration connection.
 */
export async function setupWatchForConnection(
  connectionId: string,
  clerkUserId: string
): Promise<WatchSetupResult> {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC_NAME;
  if (!topicName) {
    return {
      success: false,
      errorCode: "CONFIG_ERROR",
      errorMessage: "GOOGLE_PUBSUB_TOPIC_NAME is not configured in server environment.",
    };
  }

  // Verify connection ownership (IDOR check)
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      id: connectionId,
      clerkUserId,
      provider: "GOOGLE",
      status: "CONNECTED",
    },
  });

  if (!connection) {
    return {
      success: false,
      errorCode: "CONNECTION_NOT_FOUND",
      errorMessage: "Google connection not found or not in CONNECTED status.",
    };
  }

  // Get a concurrency-safe, refreshed access token
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(connectionId);
  } catch (err: any) {
    return {
      success: false,
      errorCode: "TOKEN_REFRESH_FAILED",
      errorMessage: err?.message || "Failed to retrieve a valid Google access token.",
    };
  }

  // Invoke Gmail API to register the Pub/Sub watch
  const watchResult = await executeGmailWatch(accessToken, {
    topicName,
    labelIds: ["INBOX"],
    labelFilterBehavior: "include",
  });

  if (!watchResult.success || !watchResult.historyId || !watchResult.expiration) {
    return {
      success: false,
      errorCode: watchResult.errorCode || "GMAIL_WATCH_FAILED",
      errorMessage: watchResult.errorMessage || "Failed to register Gmail watch.",
    };
  }

  const expirationDate = new Date(Number(watchResult.expiration));

  // Upsert the subscription tracking record atomically
  await prisma.gmailWatchSubscription.upsert({
    where: { integrationConnectionId: connectionId },
    update: {
      historyId: watchResult.historyId,
      expiration: expirationDate,
      resourceId: `watch_${Date.now()}`,
    },
    create: {
      clerkUserId,
      integrationConnectionId: connectionId,
      historyId: watchResult.historyId,
      expiration: expirationDate,
      resourceId: `watch_${Date.now()}`,
    },
  });

  return {
    success: true,
    historyId: watchResult.historyId,
    expiration: expirationDate,
  };
}

/**
 * Stops Gmail push notifications and removes the database subscription.
 */
export async function stopWatchForConnection(
  connectionId: string,
  clerkUserId: string
): Promise<{ success: boolean; errorMessage?: string }> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, clerkUserId },
  });

  if (!connection) {
    return { success: false, errorMessage: "Connection not found." };
  }

  try {
    const accessToken = await getValidAccessToken(connectionId);
    await executeGmailStopWatch(accessToken);
  } catch {
    // Continue even if remote stop fails (e.g. token revoked)
  }

  await prisma.gmailWatchSubscription.deleteMany({
    where: { integrationConnectionId: connectionId },
  });

  return { success: true };
}

/**
 * Proactively renews all active Gmail watches expiring within 48 hours.
 * Designed to be called by a scheduled cron job.
 */
export async function renewExpiringWatches(): Promise<{
  renewedCount: number;
  failedCount: number;
  errors: string[];
}> {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC_NAME;
  if (!topicName) {
    return {
      renewedCount: 0,
      failedCount: 0,
      errors: ["GOOGLE_PUBSUB_TOPIC_NAME is not configured."],
    };
  }

  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000); // within 48 hours

  const subscriptions = await prisma.gmailWatchSubscription.findMany({
    where: {
      expiration: { lte: cutoff },
    },
    include: {
      integrationConnection: true,
    },
  });

  let renewedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    if (sub.integrationConnection.status !== "CONNECTED") {
      continue;
    }

    try {
      const accessToken = await getValidAccessToken(sub.integrationConnectionId);
      const res = await executeGmailWatch(accessToken, {
        topicName,
        labelIds: ["INBOX"],
      });

      if (res.success && res.historyId && res.expiration) {
        await prisma.gmailWatchSubscription.update({
          where: { id: sub.id },
          data: {
            historyId: res.historyId,
            expiration: new Date(Number(res.expiration)),
          },
        });
        renewedCount++;
      } else {
        failedCount++;
        errors.push(`Failed for ${sub.clerkUserId}: ${res.errorMessage}`);
      }
    } catch (err: any) {
      failedCount++;
      errors.push(`Exception for ${sub.clerkUserId}: ${err.message}`);
    }
  }

  return { renewedCount, failedCount, errors };
}
