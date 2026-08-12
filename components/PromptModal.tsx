"use client";

import { useState, useCallback, useEffect, useRef, useId } from "react";
import type { ToolLink } from "@/lib/postTypes";
import Banner468 from "@/components/ads/Banner468";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sectionTitle?: string;
  links: ToolLink[];
}

// ── Favicon with fallback ─────────────────────────────────────────────────────

function FaviconIcon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    /* keep empty */
  }

  if (!domain || failed) {
    return (
      <span
        className="material-symbols-outlined text-[15px] transition-transform duration-300 group-hover/wb:rotate-[-5deg]"
        style={{ fontVariationSettings: '"FILL" 0' }}
      >
        open_in_new
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      className="w-4 h-4 rounded-sm object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({
  text,
  size = "sm",
  label = "Copy",
  count,
}: {
  text: string;
  size?: "sm" | "md";
  label?: string;
  count?: number;
}) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  const handleCopy = useCallback(async () => {
    if (state === "copied") return;
    try {
      await navigator.clipboard.writeText(text.trim());
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {/* silently fail */}
  }, [text, state]);

  const isMd = size === "md";
  const isCopied = state === "copied";

  const displayLabel = count !== undefined
    ? `${label} (${count})`
    : label;

  return (
    <button
      onClick={handleCopy}
      aria-label={isCopied ? "Copied!" : displayLabel}
      className={`
        group/copy relative inline-flex items-center gap-1.5 font-medium
        select-none overflow-hidden
        transition-all duration-300 ease-out rounded-lg
        ${isMd ? "px-3.5 py-2 text-sm border" : "px-2.5 py-1.5 text-xs border"}
        ${isCopied
          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/8 shadow-[0_0_16px_rgba(16,185,129,0.2)]"
          : "border-[#00DBEE]/20 text-[#00DBEE]/75 bg-[#00DBEE]/5 hover:bg-[#00DBEE]/10 hover:border-[#00DBEE]/40 hover:text-[#00DBEE] hover:shadow-[0_0_14px_rgba(0,219,238,0.18)] active:scale-[0.97]"
        }
        focus:outline-none focus:ring-2 focus:ring-[#00DBEE]/35 focus:ring-offset-1 focus:ring-offset-transparent
      `}
    >
      <span
        className={`material-symbols-outlined transition-all duration-300 ${isCopied ? "scale-110" : "scale-100"}`}
        style={{
          fontSize: isMd ? "16px" : "14px",
          fontVariationSettings: isCopied ? '"FILL" 1' : '"FILL" 0',
        }}
      >
        {isCopied ? "check_circle" : "content_copy"}
      </span>
      <span className="transition-all duration-300">
        {isCopied ? "Copied!" : displayLabel}
      </span>
    </button>
  );
}

// ── Premium Website CTA button ────────────────────────────────────────────────

function WebsiteBtn({ label, url }: { label: string; url: string }) {
  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      aria-label={`Open ${label}`}
      className="
        group/wb relative inline-flex items-center justify-center gap-2.5
        w-full sm:w-auto min-w-[180px]
        h-[46px] px-7
        rounded-xl font-semibold text-sm text-white
        transition-all duration-300 ease-out
        hover:-translate-y-0.5
        hover:shadow-[0_0_32px_rgba(0,219,238,0.3),0_8px_24px_rgba(0,0,0,0.4)]
        focus:outline-none focus:ring-2 focus:ring-[#00DBEE]/50 focus:ring-offset-2 focus:ring-offset-transparent
        active:translate-y-0 active:scale-[0.98]
      "
      style={{
        background: "linear-gradient(135deg, #00DBEE 0%, #0EA5E9 55%, #6366F1 100%)",
        boxShadow: "0 0 20px rgba(0,219,238,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      {/* Hover shimmer layer */}
      <span
        className="absolute inset-0 rounded-xl opacity-0 group-hover/wb:opacity-100 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />
      {/* Favicon / fallback icon */}
      <span className="relative z-10 shrink-0">
        <FaviconIcon url={url} />
      </span>
      {/* Label */}
      <span className="relative z-10 truncate">{label}</span>
      {/* External link chevron */}
      <span
        className="relative z-10 material-symbols-outlined text-[13px] text-white/70 transition-transform duration-300 group-hover/wb:translate-x-0.5 group-hover/wb:-translate-y-0.5 shrink-0"
        style={{ fontVariationSettings: '"FILL" 0' }}
      >
        open_in_new
      </span>
    </button>
  );
}

// ── Single prompt section ─────────────────────────────────────────────────────

function PromptSection({
  link,
  index,
  total,
  sectionTitle,
}: {
  link: ToolLink;
  index: number;
  total: number;
  sectionTitle: string;
}) {
  const hasWebsite = !!(link.websiteUrl?.trim());
  const websiteLabel = link.websiteLabel?.trim() || "Visit Website";

  return (
    <div className={index < total - 1 ? "border-b border-white/5 pb-6 mb-6" : ""}>

      {/* ── Prompt header ── */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          {/* Label row: index + sectionTitle badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-[#00DBEE]/45 uppercase">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.18em] uppercase text-[#00DBEE]/40">
              <span
                className="material-symbols-outlined text-[10px]"
                style={{ fontVariationSettings: '"FILL" 1', color: "#00DBEE", opacity: 0.5 }}
              >
                auto_awesome
              </span>
              {sectionTitle}
            </span>
          </div>
          {/* Title — max 2 lines desktop, 3 lines mobile, never ellipsis after 1 */}
          <h4
            className="
              text-[15px] font-semibold text-white/90 leading-snug break-words
              overflow-hidden
              [display:-webkit-box] [-webkit-box-orient:vertical]
              [-webkit-line-clamp:3] sm:[-webkit-line-clamp:2]
            "
          >
            {link.label}
          </h4>
        </div>
        {/* Copy single prompt */}
        <div className="shrink-0 pt-0.5">
          <CopyBtn text={link.url} label="Copy" size="sm" />
        </div>
      </div>

      {/* ── VS Code-style prompt block ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(5, 8, 16, 0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        {/* Terminal top bar */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5 border-b"
          style={{
            borderColor: "rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,95,87,0.6)" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,189,46,0.6)" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(40,201,64,0.6)" }} />
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/20">prompt.txt</span>
            <span className="text-[10px] font-mono text-white/15">{link.url.length} chars</span>
          </span>
        </div>

        {/* Prompt text */}
        <pre
          className="
            px-5 py-4 text-[13px] leading-[1.75] font-mono
            text-[#A8D8E0] whitespace-pre-wrap break-words
            select-text overflow-y-auto
          "
          style={{
            wordBreak: "break-word",
            overflowWrap: "break-word",
            maxHeight: "18rem",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.08) transparent",
          }}
        >
          {link.url}
        </pre>
      </div>

      {/* ── Helpful Resource section ── */}
      {hasWebsite && (
        <div
          className="mt-5 rounded-xl px-4 py-4"
          style={{
            background: "rgba(0,219,238,0.025)",
            border: "1px solid rgba(0,219,238,0.08)",
          }}
        >
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#00DBEE]/40 mb-3 flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[11px]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              link
            </span>
            Helpful Resource
          </p>
          <div className="flex justify-center sm:justify-start">
            <WebsiteBtn label={websiteLabel} url={link.websiteUrl!} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function PromptModal({
  isOpen,
  onClose,
  title,
  sectionTitle = "AI Prompts",
  links,
}: PromptModalProps) {
  const id = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [isOpen]);

  const allText = links.map((l) => `=== ${l.label} ===\n${l.url}`).join("\n\n");

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        background: "rgba(4, 6, 12, 0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: "prompt-overlay-in 0.22s ease-out both",
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={panelRef}
        className="
          relative w-full sm:max-w-2xl
          max-h-[96dvh] sm:max-h-[88vh]
          flex flex-col
          rounded-t-2xl sm:rounded-2xl
          overflow-hidden
        "
        style={{
          background: "linear-gradient(160deg, rgba(13,20,34,0.99) 0%, rgba(7,11,20,0.99) 100%)",
          border: "1px solid rgba(0,219,238,0.11)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.035) inset, " +
            "0 40px 80px -20px rgba(0,0,0,0.85), " +
            "0 0 80px rgba(0,219,238,0.05)",
          animation: "prompt-panel-in 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between gap-4 px-6 py-5 shrink-0 border-b border-white/5"
          style={{
            background: "linear-gradient(90deg, rgba(0,219,238,0.035) 0%, transparent 65%)",
          }}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Icon badge */}
            <div
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
              style={{
                background: "rgba(0,219,238,0.08)",
                border: "1px solid rgba(0,219,238,0.18)",
                boxShadow: "0 0 16px rgba(0,219,238,0.12)",
              }}
            >
              <span
                className="material-symbols-outlined text-[17px]"
                style={{ color: "#00DBEE", fontVariationSettings: '"FILL" 1' }}
              >
                auto_awesome
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-mono font-bold tracking-[0.2em] uppercase text-[#00DBEE]/45 mb-1">
                {sectionTitle}
              </p>
              {/* Title: never clips, max 2 lines desktop / 3 mobile */}
              <h3
                id={`${id}-title`}
                className="
                  text-base sm:text-[17px] font-bold text-white leading-snug break-words
                  overflow-hidden
                  [display:-webkit-box] [-webkit-box-orient:vertical]
                  [-webkit-line-clamp:3] sm:[-webkit-line-clamp:2]
                "
              >
                {title}
              </h3>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close prompt modal"
            className="
              shrink-0 w-8 h-8 flex items-center justify-center rounded-full mt-0.5
              text-white/35 hover:text-white hover:bg-white/8
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-white/20
              active:scale-95
            "
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* ── Actions bar ── */}
        <div
          className="px-6 py-3 shrink-0 border-b border-white/5 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.01)" }}
        >
          <span className="text-[11px] text-white/25 mr-auto font-mono tracking-wide">
            {links.length} prompt{links.length !== 1 ? "s" : ""}
          </span>
          <CopyBtn text={allText} label="Copy All" size="md" count={links.length} />
        </div>

        {/* ── Scrollable prompt sections ── */}
        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.08) transparent",
          }}
        >
          {links.map((link, i) => (
            <PromptSection key={i} link={link} index={i} total={links.length} sectionTitle={sectionTitle} />
          ))}
        </div>

        {/* ── 468×60 Banner — desktop only ── */}
        <div
          className="hidden sm:flex shrink-0 items-center justify-center border-t border-white/5 py-3"
          style={{ background: "rgba(7,11,20,0.97)" }}
          aria-label="Advertisement"
          role="complementary"
        >
          <Banner468 />
        </div>

        {/* ── Mobile sticky bottom bar ── */}
        <div
          className="sm:hidden shrink-0 px-4 py-3 border-t border-white/5 flex gap-2"
          style={{ background: "rgba(7,11,20,0.97)" }}
        >
          <CopyBtn text={allText} label="Copy All" size="md" count={links.length} />
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes prompt-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes prompt-panel-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 639px) {
          @keyframes prompt-panel-in {
            from { opacity: 0; transform: translateY(40px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  );
}
