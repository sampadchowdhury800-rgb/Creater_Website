"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "./ThemeProvider";
import { socialGroups } from "@/lib/socials";
import type { PostCard } from "@/lib/postTypes";
import { SignInButton, SignUpButton, UserButton, Show } from "@clerk/nextjs";

interface NavbarProps {
  videos: PostCard[];
  onMenuOpen: () => void;
}

export default function Navbar({ videos, onMenuOpen }: NavbarProps) {
  const { theme, toggleTheme, mounted } = useTheme();
  const [topQuery, setTopQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const filteredVideos = topQuery
    ? videos.filter((v) =>
        v.title.toLowerCase().includes(topQuery.toLowerCase())
      )
    : [];

  const handleVideosClick = (e: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      e.preventDefault();
      const el = document.getElementById("videos");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] md:w-[90%] rounded-full border border-black/5 dark:border-white/10 bg-white/60 dark:bg-surface/40 backdrop-blur-xl shadow-[0_0_30px_rgba(0,219,233,0.1)] flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 max-w-[1440px] mx-auto z-[60] transition-colors">
      {/* Logo */}
      <Link
        href="/"
        className="whitespace-nowrap shrink-0 font-display-lg-mobile text-[20px] sm:text-[24px] md:text-display-lg-mobile font-bold text-primary-fixed-dim dark:text-primary-fixed tracking-tighter hover:scale-105 active:scale-95 transition-transform cursor-pointer"
      >
        Chowdhury Duo
      </Link>

      {/* Desktop nav */}
      <nav className="hidden lg:flex items-center gap-4 xl:gap-6 font-label-caps text-xs xl:text-label-caps shrink-0">
        <Link
          href="/projects"
          className="whitespace-nowrap text-on-tertiary-fixed-variant dark:text-on-surface-variant font-medium hover:text-primary-fixed-dim dark:hover:text-primary-fixed transition-all duration-300 ease-out"
        >
          Projects
        </Link>

        <Link
          href="/my-automations"
          className="whitespace-nowrap text-on-tertiary-fixed-variant dark:text-on-surface-variant font-medium hover:text-primary-fixed-dim dark:hover:text-primary-fixed transition-all duration-300 ease-out flex items-center gap-1"
        >
          <span>My Automations</span>
        </Link>

        <Link
          href="/automations"
          className="whitespace-nowrap text-on-tertiary-fixed-variant dark:text-on-surface-variant font-medium hover:text-primary-fixed-dim dark:hover:text-primary-fixed transition-all duration-300 ease-out"
        >
          Automations
        </Link>

        {/* Socials dropdown */}
        <div className="relative group">
          <button className="whitespace-nowrap text-on-tertiary-fixed-variant dark:text-on-surface-variant font-medium hover:text-primary-fixed-dim dark:hover:text-primary-fixed transition-all duration-300 ease-out flex items-center gap-1 cursor-pointer">
            Socials{" "}
            <span className="material-symbols-outlined text-[14px]">
              expand_more
            </span>
          </button>
          <div className="absolute top-full right-0 mt-4 w-64 bg-white/95 dark:bg-surface-container-low/95 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-2xl max-h-[80vh] overflow-y-auto">
            {socialGroups.map((group, gi) => (
              <div key={group.platform}>
                <div
                  className={`px-4 pb-1 ${gi === 0 ? "pt-3" : "pt-4 border-t border-black/5 dark:border-white/5 mt-1"}`}
                >
                  <span className="text-[9px] font-label-caps tracking-widest text-primary-fixed-dim dark:text-primary-fixed uppercase">
                    {group.platform}
                  </span>
                </div>
                {group.links.map((link) => (
                  <a
                    key={link.url}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-on-tertiary-fixed dark:text-on-surface text-[13px]"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ color: link.color }}
                    >
                      {link.icon}
                    </span>{" "}
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Right side controls */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Desktop search */}
        <div className="relative hidden xl:block" ref={searchWrapRef}>
          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-full px-3.5 py-1.5 border border-black/5 dark:border-white/10 focus-within:border-primary-fixed-dim/50 transition-colors">
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant dark:text-on-surface-variant text-[18px] mr-2">
              search
            </span>
            <input
              className="bg-transparent border-none focus:ring-0 text-body-md text-on-tertiary-fixed dark:text-on-surface p-0 w-28 focus:w-44 transition-all duration-300 placeholder:text-on-tertiary-fixed-variant/50 dark:placeholder:text-on-surface-variant/50 outline-none"
              placeholder="Search content..."
              type="text"
              autoComplete="off"
              value={topQuery}
              onChange={(e) => {
                setTopQuery(e.target.value);
                setDropdownOpen(!!e.target.value);
              }}
              onFocus={() => {
                if (topQuery) setDropdownOpen(true);
              }}
            />
            {topQuery && (
              <button
                className="ml-1 text-on-tertiary-fixed-variant hover:text-on-tertiary-fixed dark:text-on-surface-variant dark:hover:text-on-surface transition-colors"
                onClick={() => {
                  setTopQuery("");
                  setDropdownOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[16px]">
                  close
                </span>
              </button>
            )}
          </div>

          {/* Search dropdown */}
          <div
            id="top-search-dropdown"
            className={dropdownOpen && topQuery ? "visible" : ""}
          >
            <div className="px-4 py-3 border-b border-white/5 text-[11px] font-label-caps text-on-surface-variant tracking-widest uppercase">
              Videos &amp; Posts
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredVideos.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
                  No content found
                </div>
              ) : (
                filteredVideos.map((v) => (
                  <Link
                    key={v.id}
                    href={`/posts/${v.slug}`}
                    onClick={() => {
                      setTopQuery("");
                      setDropdownOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    {v.featuredImage ? (
                      <Image
                        src={v.featuredImage}
                        className="w-12 h-8 object-cover rounded flex-shrink-0"
                        alt={v.title}
                        width={48}
                        height={32}
                        unoptimized
                      />
                    ) : (
                      <div className="w-12 h-8 bg-white/5 rounded flex-shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                          play_circle
                        </span>
                      </div>
                    )}
                    <span className="text-sm text-on-surface line-clamp-2">
                      {v.title}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          onClick={toggleTheme}
          title={mounted && theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          aria-label="Toggle light or dark theme"
          suppressHydrationWarning
        >
          {mounted && theme === "light" ? (
            <span className="material-symbols-outlined text-amber-500">
              light_mode
            </span>
          ) : (
            <span className="material-symbols-outlined text-primary-fixed-dim">
              dark_mode
            </span>
          )}
        </button>

        {/* Clerk auth controls — desktop */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <Show when="signed-out">
            <SignInButton>
              <button className="whitespace-nowrap shrink-0 px-4 py-1.5 text-xs lg:text-sm font-medium text-on-tertiary-fixed-variant dark:text-on-surface-variant hover:text-primary-fixed-dim dark:hover:text-primary-fixed border border-black/10 dark:border-white/10 rounded-full hover:border-primary-fixed-dim/40 transition-all duration-300 cursor-pointer">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="whitespace-nowrap shrink-0 px-4 py-1.5 text-xs lg:text-sm font-medium bg-primary-container text-on-primary-container rounded-full hover:bg-primary-fixed transition-all duration-300 active:scale-95 cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </Show>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2 cursor-pointer shrink-0"
          onClick={onMenuOpen}
          aria-label="Open mobile navigation menu"
        >
          <span className="material-symbols-outlined text-on-tertiary-fixed dark:text-on-surface">
            menu
          </span>
        </button>
      </div>
    </header>
  );
}
