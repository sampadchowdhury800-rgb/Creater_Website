"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";

interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  fullDesc: string | null;
  client: string | null;
  role: string | null;
  technologies: string[];
  problem: string | null;
  solution: string | null;
  result: string | null;
  images: string[];
  videoUrl: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  directAnswer: string | null;
  faqs: any;
}

interface ProjectDetailClientProps {
  project: ProjectRecord;
  otherProjects: Array<{
    id: string;
    title: string;
    slug: string;
    shortDesc: string | null;
    technologies: string[];
  }>;
}

export default function ProjectDetailClient({
  project,
  otherProjects,
}: ProjectDetailClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = Array.isArray(project.faqs) ? project.faqs : [];

  return (
    <ThemeProvider>
      <div className="bg-[#0A0D14] text-white min-h-screen selection:bg-cyan-400 selection:text-black">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          videos={[]}
        />

        {/* Breadcrumb Header */}
        <div className="pt-28 pb-4 px-6 md:px-12 max-w-[1200px] mx-auto">
          <nav className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <Link href="/" className="hover:text-cyan-400 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/projects" className="hover:text-cyan-400 transition-colors">
              Projects
            </Link>
            <span>/</span>
            <span className="text-cyan-400 truncate">{project.title}</span>
          </nav>
        </div>

        {/* Hero Header */}
        <section className="py-8 px-6 md:px-12 max-w-[1200px] mx-auto">
          <div className="bg-[#111622]/90 border border-cyan-500/20 rounded-3xl p-8 md:p-12 backdrop-blur-xl relative overflow-hidden shadow-[0_0_50px_rgba(0,219,233,0.05)]">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-950/50 text-cyan-300 text-xs font-mono uppercase tracking-wider">
                  CASE STUDY
                </span>
                {project.role && (
                  <span className="px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-mono">
                    {project.role}
                  </span>
                )}
                {project.client && (
                  <span className="text-xs font-mono text-gray-400">
                    Client: {project.client}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {project.title}
              </h1>

              <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-3xl">
                {project.shortDesc}
              </p>

              {/* Direct Answer callout (AEO) */}
              {project.directAnswer && (
                <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-400/30 text-cyan-100 max-w-3xl shadow-inner">
                  <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
                    <span className="material-symbols-outlined text-[18px]">
                      verified
                    </span>
                    Executive Summary / Direct Answer
                  </div>
                  <p className="text-sm md:text-base leading-relaxed text-gray-200">
                    {project.directAnswer}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-4">
                {project.demoUrl && (
                  <a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_25px_rgba(0,219,233,0.3)] text-sm flex items-center gap-2"
                  >
                    <span>LIVE DEMO</span>
                    <span className="material-symbols-outlined text-[16px]">
                      open_in_new
                    </span>
                  </a>
                )}
                {project.githubUrl && (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all text-sm flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      code
                    </span>
                    <span>SOURCE REPOSITORY</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Case Study Details Grid */}
        <section className="py-12 px-6 md:px-12 max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            {project.fullDesc && (
              <div className="bg-[#111622]/60 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">
                    description
                  </span>
                  Project Background
                </h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {project.fullDesc}
                </p>
              </div>
            )}

            {/* Problem Statement */}
            {project.problem && (
              <div className="bg-[#111622]/60 border border-amber-500/20 rounded-2xl p-8 backdrop-blur-md space-y-4">
                <h2 className="text-xl font-bold text-amber-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400">
                    warning
                  </span>
                  The Problem &amp; Challenges
                </h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {project.problem}
                </p>
              </div>
            )}

            {/* Solution Architecture */}
            {project.solution && (
              <div className="bg-[#111622]/60 border border-cyan-500/20 rounded-2xl p-8 backdrop-blur-md space-y-4">
                <h2 className="text-xl font-bold text-cyan-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">
                    psychology
                  </span>
                  The Engineering Solution
                </h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {project.solution}
                </p>
              </div>
            )}

            {/* Results & Key Outcomes */}
            {project.result && (
              <div className="bg-[#111622]/60 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-md space-y-4">
                <h2 className="text-xl font-bold text-emerald-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">
                    trending_up
                  </span>
                  Results &amp; Impact
                </h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {project.result}
                </p>
              </div>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <div className="bg-[#111622]/60 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">
                    quiz
                  </span>
                  Frequently Asked Questions
                </h2>
                <div className="space-y-3">
                  {faqs.map((faq: any, idx: number) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-colors"
                      >
                        <button
                          onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                          className="w-full p-4 text-left flex items-center justify-between font-semibold text-sm text-white hover:text-cyan-300 transition-colors"
                        >
                          <span>{faq.question}</span>
                          <span className="material-symbols-outlined text-[18px] text-cyan-400">
                            {isOpen ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-xs md:text-sm text-gray-300 leading-relaxed border-t border-white/5 pt-3">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tech Stack */}
            <div className="bg-[#111622]/80 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-400">
                Technology Stack
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.technologies.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-gray-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Other Projects */}
            {otherProjects.length > 0 && (
              <div className="bg-[#111622]/80 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-400">
                  More Case Studies
                </h3>
                <div className="space-y-3">
                  {otherProjects.map((op) => (
                    <Link
                      key={op.id}
                      href={`/projects/${op.slug}`}
                      className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
                    >
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {op.title}
                      </h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                        {op.shortDesc}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Card */}
            <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-md text-center space-y-4">
              <h3 className="text-lg font-bold text-white">Have a Similar Project?</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Let&apos;s discuss how to architect your technical requirements.
              </p>
              <a
                href="mailto:sampadchowdhury777@gmail.com"
                className="w-full py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-1.5 hover:bg-cyan-300 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                DISCUSS THIS ARCHITECTURE
              </a>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
