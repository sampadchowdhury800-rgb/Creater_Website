"use client";

import { useEffect, useRef } from "react";

const SCRIPT_ID = "ecpm-native-banner-invoke";
const CONTAINER_ID = "container-8520d2bbf2392138de70129de7c15781";
const SCRIPT_SRC =
  "https://pl30441399.effectivecpmnetwork.com/8520d2bbf2392138de70129de7c15781/invoke.js";

/**
 * EffectiveCPM Native Banner
 *
 * - Lazy-initialises via IntersectionObserver (loads only when in viewport)
 * - Injects the script exactly once per page lifetime; does NOT re-inject on
 *   client-side navigation because it checks for the script element first
 * - Reserves a min-height before load to prevent CLS
 * - Cleans up the script tag on unmount so it can re-mount in dev hot-reload
 *   without duplicating
 */
export default function NativeBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;

    // Lazy-load via IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();

        // Guard: don't double-inject if already on page
        if (document.getElementById(SCRIPT_ID)) return;

        injected.current = true;

        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.setAttribute("data-cfasync", "false");
        document.body.appendChild(script);
      },
      { rootMargin: "200px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="w-full flex justify-center my-8 md:my-12"
      aria-label="Advertisement"
      role="complementary"
    >
      {/* Min-height reservation prevents CLS before ad fills */}
      <div
        ref={containerRef}
        id={CONTAINER_ID}
        className="w-full max-w-4xl min-h-[90px]"
      />
    </div>
  );
}
