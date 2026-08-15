"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";

interface Person {
  id: string;
  name: string;
  slug: string;
  title: string;
  shortBio: string | null;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  youtube: string | null;
  instagram: string | null;
  skills: string[];
  achievements: string[];
  education: any;
  experience: any;
}

interface ServiceSummary {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  category: string | null;
  icon: string | null;
}

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  role: string | null;
  technologies: string[];
}

interface AboutClientProps {
  people: Person[];
  services: ServiceSummary[];
  projects: ProjectSummary[];
  settings: Record<string, string>;
}

export default function AboutClient({
  people,
  services,
  projects,
}: AboutClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sampad = people.find((p) => p.slug === "sampad-chowdhury");
  const bharti = people.find((p) => p.slug === "bharti-shaw");

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
        <section className="relative pt-36 pb-20 px-6 md:px-12 max-w-[1300px] mx-auto overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6">
            <span className="inline-block px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono tracking-widest uppercase">
              ABOUT CHOWDHURY DUO
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
              Engineering Digital Products, Automations & Media
            </h1>
            <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
              Chowdhury Duo is a multifaceted technology and media brand. We architect full-stack web applications, autonomous business workflow pipelines, custom SaaS platforms, and digital storytelling experiences.
            </p>
          </div>
        </section>

        {/* Founders Grid */}
        <section className="py-16 px-6 md:px-12 max-w-[1300px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
              Meet the Founders
            </h2>
            <p className="text-gray-400 mt-2">
              The minds behind the technical architecture and creative vision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sampad Chowdhury */}
            {sampad && (
              <div className="bg-[#111622]/80 border border-cyan-500/20 rounded-3xl p-8 backdrop-blur-xl hover:border-cyan-400/40 transition-all duration-300 flex flex-col justify-between shadow-[0_0_40px_rgba(0,219,233,0.05)]">
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-black overflow-hidden shadow-lg border border-cyan-300/30">
                      {sampad.avatarUrl ? (
                        <Image
                          src={sampad.avatarUrl}
                          alt={sampad.name}
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        "SC"
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{sampad.name}</h3>
                      <p className="text-cyan-400 text-sm font-medium font-mono">
                        {sampad.title}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                    {sampad.bio}
                  </p>

                  {/* Skills tags */}
                  <div>
                    <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">
                      Core Specializations
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {sampad.skills.slice(0, 8).map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {sampad.linkedin && (
                      <a
                        href={sampad.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#0077b5]/20 text-[#0077b5] border border-[#0077b5]/30 text-xs font-medium hover:bg-[#0077b5]/30 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">link</span>
                        LinkedIn
                      </a>
                    )}
                    {sampad.github && (
                      <a
                        href={sampad.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 border border-white/20 text-xs font-medium hover:bg-white/20 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">code</span>
                        GitHub
                      </a>
                    )}
                  </div>
                  <Link
                    href="/resume"
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-mono flex items-center gap-1 font-semibold group"
                  >
                    View Full Resume
                    <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            )}

            {/* Bharti Shaw */}
            {bharti && (
              <div className="bg-[#140f1a]/80 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl hover:border-purple-400/40 transition-all duration-300 flex flex-col justify-between shadow-[0_0_40px_rgba(167,91,255,0.05)]">
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-lg border border-purple-300/30">
                      {bharti.avatarUrl ? (
                        <Image
                          src={bharti.avatarUrl}
                          alt={bharti.name}
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        "BS"
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{bharti.name}</h3>
                      <p className="text-purple-400 text-sm font-medium font-mono">
                        {bharti.title}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                    {bharti.bio ||
                      "Bharti Shaw is the creative artist and co-creator of Chowdhury Duo, focusing on design aesthetics, visual arts, and lifestyle storytelling across platforms."}
                  </p>

                  {/* Skills tags */}
                  <div>
                    <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">
                      Creative Disciplines
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {bharti.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {bharti.instagram && (
                      <a
                        href={bharti.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#E1306C]/20 text-[#E1306C] border border-[#E1306C]/30 text-xs font-medium hover:bg-[#E1306C]/30 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                        Instagram
                      </a>
                    )}
                  </div>
                  <Link
                    href="/bharti-shaw"
                    className="text-purple-400 hover:text-purple-300 text-xs font-mono flex items-center gap-1 font-semibold group"
                  >
                    View Portfolio
                    <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Services Capability Section */}
        <section className="py-16 px-6 md:px-12 max-w-[1300px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest">
                WHAT WE SOLVE
              </span>
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white mt-1">
                Engineering &amp; Automation Capabilities
              </h2>
            </div>
            <Link
              href="/services"
              className="text-cyan-400 hover:text-cyan-300 font-mono text-sm font-semibold flex items-center gap-1"
            >
              Browse All Services
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.slice(0, 6).map((svc) => (
              <Link
                key={svc.id}
                href={`/services/${svc.slug}`}
                className="group p-6 rounded-2xl bg-[#111622]/60 border border-white/10 hover:border-cyan-500/40 hover:bg-[#111622] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">
                      {svc.icon || "code"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {svc.name}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2 line-clamp-3 leading-relaxed">
                    {svc.shortDesc}
                  </p>
                </div>
                <div className="mt-6 flex items-center text-cyan-400 text-xs font-mono font-medium">
                  <span>Explore Architecture</span>
                  <span className="material-symbols-outlined text-[14px] ml-1 group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Case Studies Section */}
        <section className="py-16 px-6 md:px-12 max-w-[1300px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest">
                PORTFOLIO &amp; CASE STUDIES
              </span>
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white mt-1">
                Featured Engineering Projects
              </h2>
            </div>
            <Link
              href="/projects"
              className="text-cyan-400 hover:text-cyan-300 font-mono text-sm font-semibold flex items-center gap-1"
            >
              View All Case Studies
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.slug}`}
                className="group p-6 rounded-2xl bg-[#111622]/60 border border-white/10 hover:border-cyan-500/40 hover:bg-[#111622] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-mono text-cyan-400 mb-2">
                    {proj.role || "Lead Engineer"}
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {proj.title}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2 line-clamp-3 leading-relaxed">
                    {proj.shortDesc}
                  </p>
                </div>
                <div className="mt-6">
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {proj.technologies.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-white/5 rounded text-[11px] font-mono text-gray-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center text-cyan-400 text-xs font-mono font-medium">
                    <span>Read Case Study</span>
                    <span className="material-symbols-outlined text-[14px] ml-1 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 md:px-12 max-w-[1100px] mx-auto text-center">
          <div className="bg-gradient-to-br from-cyan-950/40 via-[#111622] to-blue-950/40 border border-cyan-500/30 rounded-3xl p-12 backdrop-blur-xl shadow-[0_0_50px_rgba(0,219,233,0.1)] space-y-6">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white">
              Ready to Build or Automate?
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto text-base md:text-lg">
              Whether you need full-stack web engineering, custom AI chatbot workflows, or backend infrastructure optimization, let&apos;s build scalable solutions.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <a
                href="mailto:sampadchowdhury777@gmail.com"
                className="px-8 py-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(0,219,233,0.3)] text-sm"
              >
                START A CONVERSATION
              </a>
              <Link
                href="/services"
                className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all active:scale-95 text-sm"
              >
                VIEW SERVICES
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
