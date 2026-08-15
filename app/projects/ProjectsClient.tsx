"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";

interface ProjectItem {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  client: string | null;
  role: string | null;
  technologies: string[];
  problem: string | null;
  solution: string | null;
  result: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  directAnswer: string | null;
}

export default function ProjectsClient({ projects }: { projects: ProjectItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
            PORTFOLIO &amp; CASE STUDIES
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
            Featured Engineering Projects
          </h1>
          <p className="text-gray-300 text-base md:text-lg max-w-2xl mx-auto mt-4 leading-relaxed">
            Real-world case studies detailing problem statements, technical architecture decisions, technologies used, and outcomes achieved.
          </p>
        </section>

        {/* Projects Grid */}
        <section className="py-12 px-6 md:px-12 max-w-[1300px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-[#111622]/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl hover:border-cyan-500/40 hover:bg-[#111622] transition-all duration-300 flex flex-col justify-between group shadow-[0_0_30px_rgba(0,0,0,0.3)]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
                      {project.role || "Lead Developer"}
                    </span>
                    {project.client && (
                      <span className="text-[11px] font-mono text-gray-500 truncate max-w-[150px]">
                        {project.client}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {project.title}
                  </h2>

                  <p className="text-gray-300 text-sm leading-relaxed">
                    {project.shortDesc}
                  </p>

                  {/* Direct Answer callout (AEO) */}
                  {project.directAnswer && (
                    <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed">
                      <span className="font-semibold text-cyan-400 block mb-1">Direct Summary:</span>
                      {project.directAnswer}
                    </div>
                  )}

                  {/* Technologies */}
                  <div className="pt-2">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-2">
                      Stack:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {project.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 bg-white/5 rounded text-[11px] font-mono text-gray-300"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between gap-3">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-cyan-400 hover:text-black text-cyan-400 font-semibold text-xs font-mono transition-all flex items-center justify-center gap-1.5 group/btn border border-white/10 hover:border-cyan-400"
                  >
                    <span>Read Full Case Study</span>
                    <span className="material-symbols-outlined text-[14px] group-hover/btn:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </Link>
                  {project.demoUrl && (
                    <a
                      href={project.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors"
                      title="Live Demo"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        open_in_new
                      </span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
