"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import VideoShowcase from "@/components/VideoShowcase";
import SocialCard from "@/components/SocialCard";
import Footer from "@/components/Footer";
import NativeBanner from "@/components/ads/NativeBanner";
import type { PostCard } from "@/lib/postTypes";

interface HomeClientProps {
  posts: PostCard[];
}

function HeroPortfolioDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" id="hero-portfolio-wrap">
      <button
        id="hero-portfolio-btn"
        className="px-8 py-4 bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 text-on-tertiary-fixed dark:text-white font-bold rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        VIEW PORTFOLIO{" "}
        <span className="material-symbols-outlined text-[18px]">expand_more</span>
      </button>
      {open && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-[5]"
            onClick={() => setOpen(false)}
          />
          <div
            id="portfolio-dropdown"
            className="visible"
            style={{ zIndex: 10 }}
          >
            <a
              href="https://mine-portfolio.pages.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/5 dark:hover:bg-white/5 transition-colors text-on-surface border-b border-white/5 font-semibold text-sm"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-primary-fixed-dim text-[20px]">
                person
              </span>
              Sampad Chowdhury
            </a>
            <Link
              href="/bharti-shaw"
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/5 dark:hover:bg-white/5 transition-colors text-on-surface font-semibold text-sm"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-primary-fixed-dim text-[20px]">
                person
              </span>
              Bharti Shaw
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function HomeClient({ posts }: HomeClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="bg-background dark:bg-background selection:bg-primary-container selection:text-on-primary-container">
        <Navbar videos={posts} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          videos={posts}
        />

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="hero-section">
          <div className="absolute inset-0 hero-gradient" />
          {/* Light streaks */}
          <div className="absolute top-1/4 -left-64 w-[500px] h-[1px] light-streak opacity-20 dark:opacity-20 -rotate-45" />
          <div className="absolute bottom-1/4 -right-64 w-[500px] h-[1px] light-streak opacity-20 dark:opacity-20 -rotate-45" />

          <div className="relative z-10 text-center px-gutter">
            <h1 className="font-display-lg text-display-lg md:text-[120px] text-primary-fixed-dim dark:text-primary tracking-tighter font-extrabold mb-4 drop-shadow-[0_0_50px_rgba(0,219,233,0.3)]">
              Chowdhury Duo
            </h1>
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 font-label-caps text-label-caps text-on-tertiary-fixed-variant dark:text-primary-fixed-dim tracking-[0.3em]">
              <span>CREATOR</span>
              <span className="text-black/10 dark:text-white/20">•</span>
              <span>VIDEOS</span>
              <span className="text-black/10 dark:text-white/20">•</span>
              <span>AUTOMATIONS</span>
              <span className="text-black/10 dark:text-white/20">•</span>
              <span>LIFESTYLE</span>
            </div>
            <div className="mt-16 flex gap-6 justify-center flex-wrap">
              <a
                className="px-8 py-4 bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary font-bold rounded-full shadow-[0_0_30px_rgba(0,219,233,0.4)] hover:scale-105 transition-transform active:scale-95 inline-block"
                href="https://www.youtube.com/@ChowdhuryDuo"
                target="_blank"
                rel="noopener noreferrer"
              >
                WATCH NOW
              </a>
              <HeroPortfolioDropdown />
              {/* Sponsor CTA — ad link preserved exactly */}
              <a
                href="https://www.effectivecpmnetwork.com/hw6cqx8iiu?key=25783cbe17b96e13698472232bd383e4"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 text-on-tertiary-fixed dark:text-white font-bold rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2"
              >
                SPONSOR{" "}
                <span className="material-symbols-outlined text-[18px]">
                  open_in_new
                </span>
              </a>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
            <span className="font-label-caps text-label-caps text-[10px] text-on-tertiary-fixed dark:text-on-surface">
              SCROLL
            </span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-primary-fixed-dim dark:from-primary to-transparent" />
          </div>
        </section>

        {/* ── Video Showcase ────────────────────────────────────────────── */}
        <VideoShowcase videos={posts} />

        {/* ── Native Ad ─────────────────────────────────────────────────── */}
        <div className="px-4 md:px-6 max-w-[1440px] mx-auto">
          <NativeBanner />
        </div>

        {/* ── Anchor placeholders ────────────────────────────────────────── */}
        <div id="achievements" className="py-2" />
        <div id="projects" className="py-2" />
        <div id="news" className="py-2" />

        {/* ── Social Section ────────────────────────────────────────────── */}
        <SocialCard />

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <Footer />

        {/* ── FAB ───────────────────────────────────────────────────────── */}
        <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary rounded-full shadow-[0_0_20px_rgba(0,219,233,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40 group">
          <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">
            chat_bubble
          </span>
        </button>
      </div>
    </ThemeProvider>
  );
}
