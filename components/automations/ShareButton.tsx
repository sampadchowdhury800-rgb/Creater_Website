"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

export interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export default function ShareButton({
  title = "Chowdhury Duo",
  text,
  url,
  label,
  className = "",
  iconOnly = false,
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isSharing) return;
    setIsSharing(true);

    const resolvedUrl = url
      ? url.startsWith("http")
        ? url
        : typeof window !== "undefined"
        ? `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`
        : url
      : typeof window !== "undefined"
      ? window.location.href
      : "https://chowdhuryduo.com";

    const shareData = {
      title,
      text: text || `Check out ${title} on Chowdhury Duo`,
      url: resolvedUrl,
    };

    try {
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(resolvedUrl);
        toast.success("Link copied to clipboard!");
      } else {
        toast.info("Share URL: " + resolvedUrl);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            await navigator.clipboard.writeText(resolvedUrl);
            toast.success("Link copied to clipboard!");
          }
        } catch {
          // Silent fallback
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const defaultStyles = iconOnly
    ? "p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
    : label
    ? "px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
    : "p-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer";

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={className || defaultStyles}
      title={`Share ${title}`}
      aria-label={`Share ${title}`}
      type="button"
    >
      <Share2 className="w-4 h-4 shrink-0" />
      {label && <span>{label}</span>}
    </button>
  );
}
