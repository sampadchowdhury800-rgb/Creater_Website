"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";

interface ServiceItem {
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
  directAnswer: string | null;
}

export default function ServicesClient({ services }: { services: ServiceItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const categories = ["ALL", ...Array.from(new Set(services.map((s) => s.category).filter(Boolean)))];

  const filteredServices =
    selectedCategory === "ALL"
      ? services
      : services.filter((s) => s.category === selectedCategory);

  return (
    <ThemeProvider>
      <div className="bg-[#0A0D14] text-white min-h-screen selection:bg-cyan-400 selection:text-black">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          videos={[]}
        />

        {/* Hero Section */}
        <section className="relative pt-36 pb-16 px-6 md:px-12 max-w-[1300px] mx-auto text-center">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <span className="inline-block px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono tracking-widest uppercase mb-4">
            SOLUTIONS &amp; CAPABILITIES
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
            Engineering &amp; Automation Services
          </h1>
          <p className="text-gray-300 text-base md:text-lg max-w-2xl mx-auto mt-4 leading-relaxed">
            High-performance web applications, intelligent automation pipelines, custom SaaS platforms, and enterprise cloud infrastructure built for speed and scalability.
          </p>

          {/* Category Filter */}
          {categories.length > 2 && (
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat as string)}
                  className={`px-4 py-2 rounded-full text-xs font-mono transition-all ${
                    selectedCategory === cat
                      ? "bg-cyan-400 text-black font-bold shadow-[0_0_20px_rgba(0,219,233,0.3)]"
                      : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Services List */}
        <section className="py-12 px-6 md:px-12 max-w-[1300px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-[#111622]/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl hover:border-cyan-500/40 hover:bg-[#111622] transition-all duration-300 flex flex-col justify-between group shadow-[0_0_30px_rgba(0,0,0,0.3)]"
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[28px]">
                      {service.icon || "code"}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {service.name}
                  </h2>

                  <p className="text-gray-300 text-sm leading-relaxed">
                    {service.shortDesc}
                  </p>

                  {/* Direct Answer callout (AEO) */}
                  {service.directAnswer && (
                    <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed font-sans">
                      <span className="font-semibold text-cyan-400 block mb-1">Direct Summary:</span>
                      {service.directAnswer}
                    </div>
                  )}

                  {/* Key Features */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">
                      Core Features:
                    </span>
                    {service.features.slice(0, 3).map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-cyan-400 mt-0.5">✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Technologies */}
                  <div className="pt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {service.technologies.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 bg-white/5 rounded text-[11px] font-mono text-gray-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10">
                  <Link
                    href={`/services/${service.slug}`}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-cyan-400 hover:text-black text-cyan-400 font-semibold text-xs font-mono transition-all flex items-center justify-center gap-2 group/btn border border-white/10 hover:border-cyan-400"
                  >
                    <span>View Full Service Architecture</span>
                    <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 md:px-12 max-w-[1100px] mx-auto text-center">
          <div className="bg-gradient-to-br from-cyan-950/40 via-[#111622] to-blue-950/40 border border-cyan-500/30 rounded-3xl p-12 backdrop-blur-xl">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              Need a Custom Solution Engineered?
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto text-sm md:text-base mb-6">
              Reach out with your project specifications, API requirements, or automation workflows.
            </p>
            <a
              href="mailto:sampadchowdhury777@gmail.com"
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(0,219,233,0.3)] text-sm inline-block"
            >
              SCHEDULE A TECHNICAL CONSULTATION
            </a>
          </div>
        </section>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
