"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

interface ShareButtonProps {
  title: string;
  text?: string;
  url: string;
}

export default function ShareButton({ title, text, url }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    const shareData = {
      title,
      text: text || `Check out ${title}`,
      url,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className="p-3 bg-white/5 border border-white/10 text-on-surface hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center gap-2"
      title="Share"
    >
      <Share2 className="w-5 h-5" />
    </button>
  );
}
