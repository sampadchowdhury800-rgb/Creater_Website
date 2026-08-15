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
  services?: Array<{
    id: string;
    name: string;
    slug: string;
    shortDesc: string | null;
    icon: string | null;
    category: string | null;
  }>;
  projects?: Array<{
    id: string;
    title: string;
    slug: string;
    shortDesc: string | null;
    role: string | null;
    technologies: string[];
  }>;
}

function HeroPortfolioDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" id="hero-portfolio-wrap">
      <button
        id="hero-portfolio-btn"
        className="px-8 py-4 bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 text-on-tertiary-fixed dark:text-white font-bold rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        VIEW PROFILES{" "}
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
            <Link
              href="/resume"
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/5 dark:hover:bg-white/5 transition-colors text-on-surface border-b border-white/5 font-semibold text-sm"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-primary-fixed-dim text-[20px]">
                description
              </span>
              Sampad Chowdhury (Resume)
            </Link>
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

export default function HomeClient({
  posts,
  services = [],
  projects = [],
}: HomeClientProps) {
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

          <div className="relative z-10 text-center px-gutter max-w-5xl mx-auto">
            <h1 className="font-display-lg text-display-lg md:text-[110px] text-primary-fixed-dim dark:text-primary tracking-tighter font-extrabold mb-4 drop-shadow-[0_0_50px_rgba(0,219,233,0.3)]">
              Chowdhury Duo
            </h1>
            <div className="flex flex-wrap justify-center gap-3 md:gap-6 font-label-caps text-label-caps text-on-tertiary-fixed-variant dark:text-primary-fixed-dim tracking-[0.25em] text-xs md:text-sm">
              <span>AI &amp; AUTOMATION</span>
              <span className="text-black/10 dark:text-white/20">•</span>
              <span>FULL STACK DEV</span>
              <span className="text-black/10 dark:text-white/20">•</span>
              <span>SAAS SOLUTIONS</span>
              <span className="text-black/10 dark:text-white/20">•</span>
              <span>DIGITAL PRODUCTS</span>
            </div>

            <p className="text-gray-300 max-w-2xl mx-auto mt-6 text-sm md:text-base leading-relaxed">
              Engineering high-performance web applications, intelligent business workflow automations, and digital storytelling platforms founded by Sampad Chowdhury.
            </p>

            <div className="mt-12 flex gap-4 justify-center flex-wrap">
              <Link
                className="px-8 py-4 bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary font-bold rounded-full shadow-[0_0_30px_rgba(0,219,233,0.4)] hover:scale-105 transition-transform active:scale-95 inline-block text-sm"
                href="/services"
              >
                OUR SERVICES
              </Link>
              <HeroPortfolioDropdown />
              <Link
                href="/projects"
                className="px-8 py-4 bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 text-on-tertiary-fixed dark:text-white font-bold rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2 text-sm"
              >
                CASE STUDIES
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
            <span className="font-label-caps text-label-caps text-[10px] text-on-tertiary-fixed dark:text-on-surface">
              SCROLL
            </span>
            <div className="w-[1px] h-10 bg-gradient-to-b from-primary-fixed-dim dark:from-primary to-transparent" />
          </div>
        </section>

        {/* ── Services Hub Preview (SSR Crawlable) ────────────────────────── */}
        {services.length > 0 && (
          <section className="py-16 px-4 md:px-8 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest">
                  CORE EXPERTISE
                </span>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
                  Engineering &amp; Automation Services
                </h2>
              </div>
              <Link
                href="/services"
                className="text-cyan-400 hover:text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1"
              >
                Explore All Services
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services.map((s) => (
                <Link
                  key={s.id}
                  href={`/services/${s.slug}`}
                  className="group p-6 rounded-2xl bg-[#111622]/60 border border-white/10 hover:border-cyan-500/40 hover:bg-[#111622] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[24px]">
                        {s.icon || "code"}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {s.name}
                    </h3>
                    <p className="text-gray-400 text-xs md:text-sm mt-2 line-clamp-3 leading-relaxed">
                      {s.shortDesc}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center text-cyan-400 text-xs font-mono font-medium">
                    <span>Learn More</span>
                    <span className="material-symbols-outlined text-[14px] ml-1 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Video Showcase ────────────────────────────────────────────── */}
        <VideoShowcase videos={posts} />

        {/* ── Featured Projects Preview (SSR Crawlable) ─────────────────── */}
        {projects.length > 0 && (
          <section className="py-16 px-4 md:px-8 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest">
                  PORTFOLIO
                </span>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
                  Featured Case Studies
                </h2>
              </div>
              <Link
                href="/projects"
                className="text-cyan-400 hover:text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1"
              >
                View All Case Studies
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="group p-6 rounded-2xl bg-[#111622]/60 border border-white/10 hover:border-cyan-500/40 hover:bg-[#111622] transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-mono text-cyan-400 block mb-2">
                      {p.role || "Lead Engineer"}
                    </span>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-gray-400 text-xs md:text-sm mt-2 line-clamp-3 leading-relaxed">
                      {p.shortDesc}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-1">
                    {p.technologies.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-mono text-gray-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

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
      </div>
    </ThemeProvider>
  );
}
