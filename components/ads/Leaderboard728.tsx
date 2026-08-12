"use client";

import { useEffect, useRef } from "react";

const AD_KEY = "a9c60bf57bdfe646285b7363d8e135d6";
const SCRIPT_SRC = `https://www.highperformanceformat.com/${AD_KEY}/invoke.js`;
const SCRIPT_ID = `hpf-leaderboard728-${AD_KEY}`;

declare global {
  interface Window {
    atOptions?: {
      key: string;
      format: string;
      height: number;
      width: number;
      params: Record<string, unknown>;
    };
  }
}

/**
 * 728×90 Leaderboard Ad
 *
 * - Hidden on mobile (< 768 px) to prevent overflow and broken layout
 * - Centers correctly on tablet and desktop
 * - Sets atOptions, then injects script exactly once
 * - Container reserves 90 px height to prevent CLS on desktop
 */
export default function Leaderboard728() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    if (document.getElementById(SCRIPT_ID)) {
      injected.current = true;
      return;
    }

    injected.current = true;

    window.atOptions = {
      key: AD_KEY,
      format: "iframe",
      height: 90,
      width: 728,
      params: {},
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    if (wrapperRef.current) {
      wrapperRef.current.appendChild(script);
    }

    return () => {
      const el = document.getElementById(SCRIPT_ID);
      if (el) el.remove();
      injected.current = false;
    };
  }, []);

  return (
    // Hidden on mobile — 728 px cannot fit on small viewports
    <div
      className="hidden md:flex justify-center items-center w-full my-4 overflow-hidden"
      aria-label="Advertisement"
      role="complementary"
    >
      {/* Reserves 90 px height to prevent CLS on desktop */}
      <div
        ref={wrapperRef}
        style={{ width: 728, height: 90, overflow: "hidden", flexShrink: 0 }}
      />
    </div>
  );
}
