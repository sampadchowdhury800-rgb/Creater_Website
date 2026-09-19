import { NextRequest } from "next/server";

/**
 * Extract the authoritative client IP from a Next.js request.
 *
 * On Vercel (and most reverse-proxy setups), `x-real-ip` is set by the
 * infrastructure to the real connecting IP and cannot be spoofed by the client.
 * We prefer it over `x-forwarded-for` because the first entry in that header
 * can be injected by a client before the request reaches the proxy.
 *
 * Fallback chain:
 *   1. x-real-ip       — set by Vercel / nginx; not client-controllable
 *   2. x-forwarded-for — last entry is most trusted when set by a proxy,
 *                        but we take the first entry as a best-effort fallback
 *                        for local dev where x-real-ip is absent.
 *   3. "127.0.0.1"     — safe sentinel for local / test environments.
 */
export function getClientIp(req: NextRequest): string {
  // Prefer x-real-ip — set by Vercel edge and not spoof-able by the client.
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  // Fallback: first entry in x-forwarded-for (best-effort for local dev).
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return "127.0.0.1";
}
