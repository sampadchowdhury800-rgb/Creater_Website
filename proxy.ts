import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Admin session check (existing system — separate from Clerk)
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_COOKIE_NAME = "admin_session";

function handleAdminRoutes(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  if (!isAdminPage) return null; // not an admin route — let Clerk handle

  const isLoginPage = pathname === "/admin/login";
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSession = !!(cookieValue && cookieValue.includes("."));

  if (isLoginPage) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined proxy: admin session check first, then Clerk for everything else
// ─────────────────────────────────────────────────────────────────────────────
export default clerkMiddleware((auth, req: NextRequest) => {
  const adminResponse = handleAdminRoutes(req);
  if (adminResponse) return adminResponse;
  // For non-admin routes, Clerk handles auth state passively (no forced protection)
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk frontend routes
    "/__clerk/(.*)",
  ],
};
