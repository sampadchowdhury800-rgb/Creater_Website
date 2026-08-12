import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_DAYS = 30;

/**
 * Reads the session cookie and validates the session against the database.
 * Returns the admin if the session is valid, or null otherwise.
 */
export async function getAdminSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieValue || !cookieValue.includes(".")) return null;

  const [token, signature] = cookieValue.split(".");

  if (!token || !signature) return null;

  try {
    const expectedSignature = createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
    
    // Use timingSafeEqual to prevent timing attacks on the signature
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!session) return null;

    // Check expiry
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.adminSession.delete({ where: { token } }).catch(() => {});
      return null;
    }

    return session.admin;
  } catch {
    return null;
  }
}

/**
 * Validates that the current request is authenticated.
 * Throws if not. For use in Server Actions and API routes.
 */
export async function requireAdminSession() {
  const admin = await getAdminSession();
  if (!admin) {
    throw new Error("Unauthorized");
  }
  return admin;
}

/**
 * Cleans up expired sessions and old rate limit entries.
 * Safe to call in a fire-and-forget manner.
 */
export async function cleanupAuthData() {
  try {
    const now = new Date();
    await prisma.adminSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    await prisma.rateLimit.deleteMany({
      where: { lockoutUntil: { lt: now } },
    });
  } catch (error) {
    console.error("Failed to clean up auth data:", error);
  }
}
