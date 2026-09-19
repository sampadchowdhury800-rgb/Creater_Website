/**
 * lib/integrations/watch-service.ts
 *
 * DEPRECATED.
 * Gmail watches via Google Cloud Pub/Sub have been retired.
 * The platform operates on scheduled polling via Supabase Edge Function: gmail-check.
 */

export interface WatchSetupResult {
  success: boolean;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function setupWatchForConnection(
  _connectionId: string,
  _clerkUserId: string
): Promise<WatchSetupResult> {
  return {
    success: true,
    message: "Gmail push watch retired. Scheduled polling is active.",
  };
}

export async function stopWatchForConnection(
  _connectionId: string,
  _clerkUserId: string
): Promise<WatchSetupResult> {
  return {
    success: true,
    message: "Gmail push watch retired.",
  };
}

export async function renewExpiringWatches(): Promise<{ renewed: number; failed: number }> {
  return { renewed: 0, failed: 0 };
}
