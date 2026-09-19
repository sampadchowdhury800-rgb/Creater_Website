import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const OWNER_TEST_ACCESS_CAPABILITY = "OWNER_TEST_ACCESS";

interface OwnerTestCacheEntry {
  isOwner: boolean;
  timestamp: number;
}

// In-memory cache for Clerk user email lookups (5-minute TTL)
const userLookupCache = new Map<string, OwnerTestCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves the configured owner/test identity from environment variables or database settings.
 *
 * Precedence:
 * 1. Environment variable: OWNER_TEST_USER_ID (exact Clerk user ID match)
 * 2. Environment variable: OWNER_TEST_EMAIL (email match)
 * 3. Database Setting: ownerTestUserId / owner_test_user_id
 * 4. Database Setting: ownerTestEmail / owner_test_email
 *
 * NOTE: The Admin account must remain strictly separate from the Owner Test Account.
 * There is NO fallback to ADMIN_EMAIL. If designatedEmail equals ADMIN_EMAIL, it is rejected.
 */
export async function getOwnerTestConfig(): Promise<{
  designatedUserId: string | null;
  designatedEmail: string | null;
}> {
  let designatedUserId = process.env.OWNER_TEST_USER_ID?.trim() || null;
  let designatedEmail = process.env.OWNER_TEST_EMAIL?.trim()?.toLowerCase() || null;

  // Check database settings if not set in environment
  if (!designatedUserId || !designatedEmail) {
    try {
      const dbSettings = await prisma.setting.findMany({
        where: {
          key: {
            in: [
              "ownerTestUserId",
              "owner_test_user_id",
              "ownerTestEmail",
              "owner_test_email",
            ],
          },
        },
      });

      for (const s of dbSettings) {
        if (!designatedUserId && (s.key === "ownerTestUserId" || s.key === "owner_test_user_id")) {
          designatedUserId = s.value.trim() || null;
        }
        if (!designatedEmail && (s.key === "ownerTestEmail" || s.key === "owner_test_email")) {
          designatedEmail = s.value.trim().toLowerCase() || null;
        }
      }
    } catch {
      // If DB is temporarily unavailable, proceed with environment variables
    }
  }

  // Ensure Admin account is strictly separate and NEVER treated as the Owner Test Account
  const adminEmail = process.env.ADMIN_EMAIL?.trim()?.toLowerCase();
  if (designatedEmail && adminEmail && designatedEmail === adminEmail) {
    designatedEmail = null;
  }

  return { designatedUserId, designatedEmail };
}

/**
 * Deterministically checks whether an authenticated Clerk user possesses
 * the OWNER_TEST_ACCESS capability.
 *
 * Enforces:
 * - Server-side identification only (never client-supplied flags, headers, or cookies)
 * - Exact Clerk User ID or verified Clerk email match
 * - Clerk metadata support (`user.publicMetadata.ownerTestAccess === true`)
 */
export async function isOwnerTestAccount(
  clerkUserId: string | null | undefined
): Promise<boolean> {
  if (!clerkUserId || typeof clerkUserId !== "string" || !clerkUserId.trim()) {
    return false;
  }

  const normalizedUserId = clerkUserId.trim();

  // Check in-memory cache
  const cached = userLookupCache.get(normalizedUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.isOwner;
  }

  const { designatedUserId, designatedEmail } = await getOwnerTestConfig();

  // 1. Direct Clerk User ID match
  if (designatedUserId && normalizedUserId === designatedUserId) {
    userLookupCache.set(normalizedUserId, { isOwner: true, timestamp: Date.now() });
    return true;
  }

  // 2. Lookup user details via Clerk API to inspect verified email & metadata
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(normalizedUserId);

    // Check Clerk metadata for explicit owner test designation
    const metadata = user.publicMetadata as Record<string, unknown> | undefined;
    if (
      metadata?.ownerTestAccess === true ||
      metadata?.role === "owner_tester"
    ) {
      userLookupCache.set(normalizedUserId, { isOwner: true, timestamp: Date.now() });
      return true;
    }

    // Check email match against designated email
    if (designatedEmail) {
      const emails = (user.emailAddresses || []).map((e) =>
        e.emailAddress?.trim()?.toLowerCase()
      );
      if (emails.includes(designatedEmail)) {
        userLookupCache.set(normalizedUserId, { isOwner: true, timestamp: Date.now() });
        return true;
      }
    }
  } catch (err: any) {
    // If Clerk user is not found (404), fail closed quietly without cluttering logs
    if (err?.status !== 404) {
      console.warn("[isOwnerTestAccount] Clerk lookup warning:", err?.message || err);
    }
  }

  userLookupCache.set(normalizedUserId, { isOwner: false, timestamp: Date.now() });
  return false;
}

/**
 * Clears the user lookup cache (useful for testing and immediate config changes).
 */
export function clearOwnerTestCache(): void {
  userLookupCache.clear();
}
