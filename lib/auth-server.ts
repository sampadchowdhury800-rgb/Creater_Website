import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Server-side authentication boundary — now powered by Clerk.
 *
 * All server actions and API routes that need the authenticated user's ID
 * call this function. When Clerk adds a user, this returns their Clerk user_id.
 * Returning null means unauthenticated — the caller must return 401.
 *
 * Admin routes use a SEPARATE session system (requireAdminSession). Do NOT
 * use this function for admin auth.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getCurrentUserDetails(): Promise<{
  userId: string;
  userName: string;
  userImage: string;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return {
      userId,
      userName:
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        "User",
      userImage: user.imageUrl || "",
    };
  } catch {
    return { userId, userName: "User", userImage: "" };
  }
}
