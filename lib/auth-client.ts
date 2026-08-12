"use client";

import { useUser, useClerk } from "@clerk/nextjs";

/**
 * Client-side authentication boundary — now powered by Clerk.
 *
 * Components call this hook to:
 * - Check if the user is loaded and authenticated (userId)
 * - Trigger the sign-in modal (openSignIn)
 *
 * Admin auth uses a separate cookie-based system; do NOT use this for admin.
 */
export function useAuth() {
  const { isLoaded, user } = useUser();
  const { openSignIn } = useClerk();

  return {
    isLoaded,
    userId: user?.id ?? null,
    openSignIn: () => openSignIn(),
  };
}
