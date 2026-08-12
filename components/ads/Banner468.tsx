"use client";

import { useEffect, useRef } from "react";

const AD_KEY = "2ea87ba06e0f3dfb64ca5c41eec2936b";
const SCRIPT_SRC = `https://www.highperformanceformat.com/${AD_KEY}/invoke.js`;

// Module-level flag so only ONE copy of the network script ever loads,
// even if multiple Banner468 instances exist simultaneously (e.g. page + modal).
// Once the script is appended to <head>, it is never removed.
let networkScriptLoaded = false;

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
 * 468×60 Banner Ad
 *
 * Strategy:
 * - The network invoke.js is loaded into <head> exactly ONCE per page session
 *   (module-level flag). Subsequent mounts (e.g. modal re-open) reuse it.
 * - atOptions is set/refreshed on every mount so the script can re-render
 *   its iframe into the current wrapperRef div.
 * - A unique per-instance script trigger is appended to the wrapper on each
 *   mount, then removed on unmount so the ad re-renders cleanly next open.
 * - Hidden on screens narrower than 480 px (sm:) to prevent overflow.
 * - Container height is reserved to prevent CLS.
 */
export default function Banner468() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;

    // Always (re)set atOptions before triggering the ad
    window.atOptions = {
      key: AD_KEY,
      format: "iframe",
      height: 60,
      width: 468,
      params: {},
    };

    // Load the network script into <head> exactly once per page session
    if (!networkScriptLoaded) {
      networkScriptLoaded = true;
      const headScript = document.createElement("script");
      headScript.src = SCRIPT_SRC;
      headScript.async = true;
      document.head.appendChild(headScript);
    }

    // Each mount appends a fresh inline trigger script to the wrapper.
    // This causes the already-loaded network module to emit a new iframe
    // into the wrapper for this render cycle.
    const triggerScript = document.createElement("script");
    triggerScript.src = SCRIPT_SRC;
    triggerScript.async = true;
    wrapper.appendChild(triggerScript);

    return () => {
      // On unmount (e.g. modal close), remove the trigger script and clear
      // the wrapper so the next mount starts with a clean container.
      if (wrapper.contains(triggerScript)) {
        wrapper.removeChild(triggerScript);
      }
      // Remove any iframes the ad inserted into the wrapper
      wrapper.innerHTML = "";
    };
  }, []);

  return (
    // Hidden below 480 px to avoid overflow on small screens
    <div
      className="hidden sm:flex justify-center items-center w-full"
      aria-label="Advertisement"
      role="complementary"
    >
      {/* Fixed 468×60 container; reserves height to prevent CLS */}
      <div
        ref={wrapperRef}
        style={{ width: 468, height: 60, overflow: "hidden", flexShrink: 0 }}
      />
    </div>
  );
}
