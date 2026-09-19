"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PostCard, ToolLink } from "@/lib/postTypes";
import PromptModal from "./PromptModal";
import ShareButton from "@/components/ShareButton";

interface VideoCardProps {
  video: PostCard;
}

// ── Icon map: label keyword → material symbol ─────────────────────────────────
const ICON_MAP: Record<string, string> = {
  start: "play_circle",
  end: "stop_circle",
  frame: "image",
  animation: "animation",
  camera: "videocam",
  lighting: "light_mode",
  negative: "block",
  voice: "mic",
  scene: "movie",
  prompt: "auto_awesome",
  website: "language",
  final: "flag",
  master: "star",
  download: "download",
  default: "code",
};

function getIcon(label: string): string {
  const l = label.toLowerCase();
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (l.includes(key)) return icon;
  }
  return ICON_MAP.default;
}

// ── Compact prompt card ───────────────────────────────────────────────────────
function PromptCard({
  link,
  index,
  onOpen,
}: {
  link: ToolLink;
  index: number;
  onOpen: () => void;
}) {
  const icon = getIcon(link.label);

  return (
    <button
      onClick={onOpen}
      aria-label={`View prompt: ${link.label}`}
      className="
        group/card w-full text-left
        flex items-center gap-3 px-3 py-2.5 rounded-xl
        border border-white/6
        bg-white/[0.02] hover:bg-white/[0.05]
        hover:border-[#00DBEE]/20
        transition-all duration-200
        hover:shadow-[0_0_16px_rgba(0,219,238,0.07)]
      "
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Icon pill */}
      <div
        className="
          shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
          bg-[#00DBEE]/8 border border-[#00DBEE]/12
          group-hover/card:bg-[#00DBEE]/14 group-hover/card:border-[#00DBEE]/25
          transition-all duration-200
        "
      >
        <span
          className="material-symbols-outlined text-[14px] text-[#00DBEE]/70 group-hover/card:text-[#00DBEE]"
          style={{ fontVariationSettings: '"FILL" 1' }}
        >
          {icon}
        </span>
      </div>

      {/* Label */}
      <span className="flex-1 text-[12px] font-medium text-white/60 group-hover/card:text-white/90 transition-colors truncate leading-none">
        {link.label}
      </span>

      {/* View chevron */}
      <span className="shrink-0 material-symbols-outlined text-[13px] text-white/20 group-hover/card:text-[#00DBEE]/70 transition-colors">
        chevron_right
      </span>
    </button>
  );
}

// ── Prompts panel ─────────────────────────────────────────────────────────────
function PromptsPanel({ title, links, videoTitle }: { title: string; links: ToolLink[]; videoTitle: string }) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openModal = useCallback((idx: number) => {
    setSelectedIndex(idx);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedIndex(null);
  }, []);

  const openAllModal = useCallback(() => {
    setSelectedIndex(null);
    setModalOpen(true);
  }, []);

  const modalLinks = selectedIndex !== null ? [links[selectedIndex]] : links;
  const modalTitle = selectedIndex !== null
    ? `${videoTitle} — ${links[selectedIndex].label}`
    : videoTitle;

  return (
    <div className="px-4 pb-4">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="
          group/trigger w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
          border border-[#00DBEE]/15
          bg-[#00DBEE]/4 hover:bg-[#00DBEE]/8
          text-[#00DBEE]/80 hover:text-[#00DBEE]
          transition-all duration-200
          hover:border-[#00DBEE]/30
          hover:shadow-[0_0_20px_rgba(0,219,238,0.1)]
        "
        aria-expanded={open}
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
      >
        <span
          className="material-symbols-outlined text-[15px]"
          style={{ fontVariationSettings: '"FILL" 1' }}
        >
          auto_awesome
        </span>
        <span className="flex-1 text-left text-[11px] font-bold tracking-[0.1em] uppercase">
          {title}
        </span>
        <span className="text-[10px] font-mono text-[#00DBEE]/40 mr-1">
          {links.length}
        </span>
        <span
          className="material-symbols-outlined text-[14px] transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          expand_more
        </span>
      </button>

      {/* Expanded list */}
      {open && (
        <div className="mt-2 space-y-1.5">
          {links.map((link, i) => (
            <PromptCard
              key={i}
              link={link}
              index={i}
              onOpen={() => openModal(i)}
            />
          ))}

          {links.length > 1 && (
            <button
              onClick={openAllModal}
              className="
                w-full mt-1 py-2 rounded-xl text-[11px] font-bold tracking-[0.08em] uppercase
                text-[#00DBEE]/50 hover:text-[#00DBEE]
                border border-dashed border-white/8 hover:border-[#00DBEE]/25
                transition-all duration-200
              "
            >
              View All {links.length} Items
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      <PromptModal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalTitle}
        sectionTitle={title}
        links={modalLinks}
      />
    </div>
  );
}

// ── Video card ────────────────────────────────────────────────────────────────

export default function VideoCardComponent({ video }: VideoCardProps) {
  const isYoutube = video.platform === "YOUTUBE";
  const thumbClass = isYoutube ? "thumb-youtube" : "thumb-instagram";
  const internalHref = `/posts/${video.slug}`;
  const shareUrl = `/posts/${video.slug}`;

  const CardContent = (
    <>
      {/* Thumbnail */}
      <div className={thumbClass}>
        {video.comingSoon && !video.featuredImage ? (
          <div className="coming-soon-placeholder w-full h-full bg-black/5 dark:bg-surface-container-low flex items-center justify-center">
            <span className="font-label-caps text-label-caps text-on-tertiary-fixed-variant/40 dark:text-on-surface-variant/40 tracking-widest">
              COMING SOON...
            </span>
          </div>
        ) : (
          video.featuredImage && (
            <Image
              src={video.featuredImage}
              alt={video.title}
              fill
              className="object-cover"
              unoptimized
            />
          )
        )}
        {/* Play overlay */}
        <div className="play-overlay">
          <div className="play-btn-circle">
            <span
              className="material-symbols-outlined text-[28px] text-[#002022]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              play_arrow
            </span>
          </div>
        </div>
        {/* Badge */}
        {video.badge && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-label-caps font-label-caps text-[10px] text-white">
            {video.badge}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="p-6 pb-4 flex-grow">
        <h3 className="font-headline-md text-[20px] text-on-tertiary-fixed dark:text-on-surface mb-2 leading-tight group-hover:text-primary-fixed-dim dark:group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        {video.shortDesc && (
          <p className="font-body-md text-on-tertiary-fixed-variant dark:text-on-surface-variant text-sm opacity-80 line-clamp-2">
            {video.shortDesc}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="video-card group relative bg-white/60 dark:bg-surface-container-low/40 backdrop-blur-2xl border border-black/5 dark:border-white/5 glass-border flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Share Button top-left absolute */}
      <div className="absolute top-3 left-3 z-20">
        <ShareButton
          title={video.title}
          url={shareUrl}
          iconOnly
          className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white rounded-full transition-transform active:scale-90"
        />
      </div>

      {/* Internal Navigation to Content Detail Page */}
      <Link href={internalHref} className="block flex-grow">
        {CardContent}
      </Link>

      {/* Prompts panel */}
      <div className="mt-auto">
        {video.promptSections && video.promptSections.length > 0 ? (
          video.promptSections.map((section) => (
            <PromptsPanel
              key={section.id}
              title={section.sectionTitle}
              links={section.items}
              videoTitle={video.title}
            />
          ))
        ) : (
          video.toolLinks && video.toolLinks.length > 0 && (
            <PromptsPanel title="AI Prompts" links={video.toolLinks} videoTitle={video.title} />
          )
        )}
      </div>
    </div>
  );
}
