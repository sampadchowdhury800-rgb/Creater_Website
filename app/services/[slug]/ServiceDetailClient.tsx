"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";

interface ServiceRecord {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  fullDesc: string | null;
  category: string | null;
  features: string[];
  technologies: string[];
  useCases: string[];
  icon: string | null;
  coverImage: string | null;
  directAnswer: string | null;
  faqs: any;
}

interface ServiceDetailClientProps {
  service: ServiceRecord;
  otherServices: Array<{
    id: string;
    name: string;
    slug: string;
    shortDesc: string | null;
    icon: string | null;
  }>;
}

export default function ServiceDetailClient({
  service,
  otherServices,
}: ServiceDetailClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = Array.isArray(service.faqs) ? service.faqs : [];

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
            <Link href="/services" className="hover:text-cyan-400 transition-colors">
              Services
            </Link>
            <span>/</span>
            <span className="text-cyan-400 truncate">{service.name}</span>
          </nav>
        </div>

        {/* Hero Section */}
        <section className="py-8 px-6 md:px-12 max-w-[1200px] mx-auto">
          <div className="bg-[#111622]/90 border border-cyan-500/20 rounded-3xl p-8 md:p-12 backdrop-blur-xl relative overflow-hidden shadow-[0_0_50px_rgba(0,219,233,0.05)]">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-950/50 text-cyan-300 text-xs font-mono uppercase tracking-wider">
                  {service.category || "ENGINEERING"}
                </span>
                <span className="text-xs font-mono text-gray-400">
                  Chowdhury Duo Architecture
                </span>
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {service.name}
              </h1>

              <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-3xl">
                {service.shortDesc}
              </p>

              {/* AEO Direct Answer Callout */}
              {service.directAnswer && (
                <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-400/30 text-cyan-100 max-w-3xl shadow-inner">
                  <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
                    <span className="material-symbols-outlined text-[18px]">
                      verified
                    </span>
                    Executive Summary / Direct Answer
                  </div>
                  <p className="text-sm md:text-base leading-relaxed text-gray-200">
                    {service.directAnswer}
                  </p>
                </div>
              )}

              <div className="pt-2 flex flex-wrap gap-4">
                <a
                  href="mailto:sampadchowdhury777@gmail.com"
                  className="px-8 py-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_25px_rgba(0,219,233,0.3)] text-sm"
                >
                  REQUEST THIS SERVICE
                </a>
                <Link
                  href="/resume"
                  className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all text-sm"
                >
                  VIEW LEAD DEVELOPER PROFILE
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Breakdown */}
        <section className="py-12 px-6 md:px-12 max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content column */}
          <div className="lg:col-span-2 space-y-12">
            {/* Full description */}
            <div className="bg-[#111622]/60 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">
                  architecture
                </span>
                Detailed Overview
              </h2>
              <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm md:text-base">
                {service.fullDesc || service.shortDesc}
              </p>
            </div>

            {/* Features */}
            {service.features.length > 0 && (
              <div className="bg-[#111622]/60 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">
                    checklist
                  </span>
                  What&apos;s Included in this Service
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {service.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3 text-sm text-gray-200"
                    >
                      <span className="text-cyan-400 font-bold mt-0.5">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Use cases */}
            {service.useCases.length > 0 && (
              <div className="bg-[#111622]/60 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">
                    lightbulb
                  </span>
                  Typical Real-World Use Cases
                </h2>
                <div className="space-y-3">
                  {service.useCases.map((uc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 text-sm text-gray-200"
                    >
                      <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs font-mono flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span>{uc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQs Accordion (AEO) */}
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
                          <span className="material-symbols-outlined text-[18px] text-cyan-400 transition-transform duration-200">
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
                Technologies Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {service.technologies.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-gray-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Other Services */}
            {otherServices.length > 0 && (
              <div className="bg-[#111622]/80 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-400">
                  Other Services
                </h3>
                <div className="space-y-3">
                  {otherServices.map((os) => (
                    <Link
                      key={os.id}
                      href={`/services/${os.slug}`}
                      className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
                    >
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {os.name}
                      </h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                        {os.shortDesc}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Contact box */}
            <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-md text-center space-y-4">
              <h3 className="text-lg font-bold text-white">Have Questions?</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Contact Sampad directly to discuss scope, milestones, and deliverables.
              </p>
              <a
                href="mailto:sampadchowdhury777@gmail.com"
                className="w-full py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-1.5 hover:bg-cyan-300 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                EMAIL DIRECTLY
              </a>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
