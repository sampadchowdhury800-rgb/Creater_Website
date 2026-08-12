"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const trackedPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only track once per path per session to avoid spam on dev reloads
    if (!pathname || trackedPaths.current.has(pathname)) return;
    
    // Don't track admin or api routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    trackedPaths.current.add(pathname);

    fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: pathname,
        referer: document.referrer || null,
      }),
    }).catch(err => console.error("Analytics error", err));
  }, [pathname]);

  return null;
}
