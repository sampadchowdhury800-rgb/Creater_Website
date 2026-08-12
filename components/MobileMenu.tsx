"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { socialGroups } from "@/lib/socials";
import type { PostCard } from "@/lib/postTypes";
import { getPostHref } from "@/lib/postTypes";
import { SignInButton, SignUpButton, UserButton, Show, useUser } from "@clerk/nextjs";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  videos: PostCard[];
}

export default function MobileMenu({ isOpen, onClose, videos }: MobileMenuProps) {
  const [query, setQuery] = useState("");
  const { user } = useUser();

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const filtered = query
    ? videos.filter((v) => v.title.toLowerCase().includes(query.toLowerCase()))
    : [];

  function scrollTo(id: string) {
    onClose();
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 320);
  }

  return (
    <div
      id="mobile-menu"
      className={`fixed inset-y-0 right-0 w-full sm:w-80 bg-white/98 dark:bg-surface-container-lowest/98 backdrop-blur-2xl z-[70] border-l border-black/10 dark:border-white/10 shadow-2xl overflow-y-auto${isOpen ? " active" : ""}`}
    >
      <div className="flex flex-col h-full p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="font-display-lg-mobile text-[24px] font-bold text-primary-fixed-dim dark:text-primary tracking-tighter">
            Navigation
          </div>
          <button
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-on-tertiary-fixed dark:text-on-surface">
              close
            </span>
          </button>
        </div>

        {/* Mobile Search */}
        <div className="mb-8 flex items-center bg-black/5 dark:bg-white/5 rounded-full px-4 py-2 border border-black/5 dark:border-white/10">
          <span className="material-symbols-outlined text-on-tertiary-fixed-variant dark:text-on-surface-variant text-[18px] mr-2">
            search
          </span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm text-on-tertiary-fixed dark:text-on-surface p-0 flex-1 placeholder:text-on-tertiary-fixed-variant/50 dark:placeholder:text-on-surface-variant/50 outline-none"
            placeholder="Search videos..."
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="ml-1 text-on-tertiary-fixed-variant hover:text-on-tertiary-fixed dark:text-on-surface-variant dark:hover:text-on-surface transition-colors"
              onClick={() => setQuery("")}
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Search results */}
        {query && (
          <div className="mb-4 flex flex-col gap-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-on-surface-variant px-1">No videos found</p>
            ) : (
              filtered.map((v) => (
                <a
                  key={v.id}
                  href={getPostHref(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  onClick={onClose}
                >
                  {v.featuredImage ? (
                    <Image
                      src={v.featuredImage}
                      className="w-14 h-10 object-cover rounded flex-shrink-0"
                      alt={v.title}
                      width={56}
                      height={40}
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-10 bg-white/5 rounded flex-shrink-0 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                        play_circle
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-semibold line-clamp-2">{v.title}</span>
                </a>
              ))
            )}
          </div>
        )}

        {/* Nav links */}
        <nav className="flex flex-col gap-6 font-headline-md text-[24px]">

          {/* Clerk auth section — mobile */}
          <div className="pb-6 border-b border-black/10 dark:border-white/10">
            <Show when="signed-out">
              <div className="flex flex-col gap-3">
                <SignInButton>
                  <button
                    className="w-full py-3 border border-primary-fixed-dim/40 text-on-tertiary-fixed dark:text-on-surface font-medium text-[16px] rounded-xl hover:bg-primary-fixed-dim/10 transition-colors"
                    onClick={onClose}
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button
                    className="w-full py-3 bg-primary-container text-on-primary-container font-bold text-[16px] rounded-xl hover:bg-primary-fixed transition-colors active:scale-95"
                    onClick={onClose}
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-4">
                <UserButton
                  appearance={{
                    elements: { avatarBox: "w-10 h-10" },
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-on-tertiary-fixed dark:text-on-surface">
                    {user?.firstName || user?.username || "Account"}
                  </span>
                  <span className="text-[12px] text-on-tertiary-fixed-variant dark:text-on-surface-variant">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </span>
                </div>
              </div>
            </Show>
          </div>
          <button
            className="text-on-tertiary-fixed dark:text-on-surface hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-left"
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); onClose(); }}
          >
            Home
          </button>
          <button
            className="text-on-tertiary-fixed dark:text-on-surface hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-left"
            onClick={() => scrollTo("videos")}
          >
            Videos
          </button>
          <Link
            href="/automations"
            className="text-on-tertiary-fixed dark:text-on-surface hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-left"
            onClick={onClose}
          >
            Automations
          </Link>
          <div className="flex flex-col gap-2">
            <span className="text-on-tertiary-fixed dark:text-on-surface cursor-default">
              Portfolio
            </span>
            <div className="flex flex-col gap-3 pl-4 border-l border-black/10 dark:border-white/10 mt-1">
              <a
                className="text-on-tertiary-fixed-variant dark:text-on-surface-variant hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-[18px] flex items-center gap-2"
                href="https://mine-portfolio.pages.dev/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <span className="material-symbols-outlined text-[18px]">person</span>{" "}
                Sampad Chowdhury
              </a>
              <Link
                className="text-on-tertiary-fixed-variant dark:text-on-surface-variant hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-[18px] flex items-center gap-2"
                href="/bharti-shaw"
                onClick={onClose}
              >
                <span className="material-symbols-outlined text-[18px]">person</span>{" "}
                Bharti Shaw
              </Link>
            </div>
          </div>
          <button
            className="text-on-tertiary-fixed dark:text-on-surface hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-left"
            onClick={() => scrollTo("achievements")}
          >
            Achievements
          </button>
          <button
            className="text-on-tertiary-fixed dark:text-on-surface hover:text-primary-fixed-dim dark:hover:text-primary transition-colors text-left"
            onClick={() => scrollTo("news")}
          >
            News
          </button>

          {/* Socials */}
          <div className="pt-6 mt-6 border-t border-black/10 dark:border-white/10">
            <p className="font-label-caps text-label-caps text-on-tertiary-fixed-variant/50 dark:text-on-surface-variant/50 mb-5 tracking-widest uppercase">
              Socials
            </p>
            {socialGroups.map((group) => (
              <div key={group.platform} className="mb-5">
                <p className="font-label-caps text-[9px] tracking-widest text-primary-fixed-dim dark:text-primary-fixed uppercase mb-2">
                  {group.platform}
                </p>
                <div className="flex flex-col gap-3 text-[15px]">
                  {group.links.map((link) => (
                    <a
                      key={link.url}
                      className="flex items-center gap-3 text-on-tertiary-fixed-variant dark:text-on-surface-variant hover:text-black dark:hover:text-white transition-colors"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClose}
                    >
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ color: link.color }}
                      >
                        {link.icon}
                      </span>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="mt-auto pt-12 text-center">
          <p className="font-label-caps text-label-caps text-on-tertiary-fixed-variant/30 dark:text-on-surface-variant/30 text-[10px]">
            © 2024 CHOWDHURY DUO
          </p>
        </div>
      </div>
    </div>
  );
}
