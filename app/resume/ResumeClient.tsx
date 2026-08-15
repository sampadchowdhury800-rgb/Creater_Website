"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";

interface PersonData {
  name: string;
  title: string;
  shortBio: string | null;
  bio: string | null;
  email: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  youtube: string | null;
  skills: string[];
  achievements: string[];
  education: any;
  experience: any;
}

interface ResumeClientProps {
  person: PersonData | null;
  services: Array<{
    id: string;
    name: string;
    slug: string;
    shortDesc: string | null;
    technologies: string[];
  }>;
  projects: Array<{
    id: string;
    title: string;
    slug: string;
    shortDesc: string | null;
    role: string | null;
    technologies: string[];
    demoUrl: string | null;
    githubUrl: string | null;
  }>;
}

export default function ResumeClient({
  person,
  services,
  projects,
}: ResumeClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const name = person?.name || "Sampad Chowdhury";
  const title =
    person?.title || "Entrepreneur | Full Stack Developer | Automation Specialist";
  const email = person?.email || "sampadchowdhury777@gmail.com";
  const linkedin =
    person?.linkedin ||
    "https://www.linkedin.com/in/sampad-chowdhury-321812317";
  const github = person?.github || "https://github.com/sampadchowdhury";

  const experiences = Array.isArray(person?.experience) ? person.experience : [];
  const educations = Array.isArray(person?.education) ? person.education : [];
  const skills = person?.skills || [];
  const achievements = person?.achievements || [];

  return (
    <ThemeProvider>
      <div className="bg-[#0A0D14] text-white min-h-screen selection:bg-cyan-400 selection:text-black">
        <div className="print:hidden">
          <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
          <MobileMenu
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            videos={[]}
          />
        </div>

        {/* Top Actions */}
        <div className="pt-28 pb-4 px-6 md:px-12 max-w-[1100px] mx-auto flex justify-between items-center print:hidden">
          <nav className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <Link href="/" className="hover:text-cyan-400 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-cyan-400">Resume</span>
          </nav>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono flex items-center gap-2 hover:bg-cyan-900/60 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            PRINT / SAVE PDF
          </button>
        </div>

        {/* Resume Container */}
        <main className="py-8 px-6 md:px-12 max-w-[1100px] mx-auto print:p-0 print:m-0 print:max-w-full">
          <div className="bg-[#111622]/90 border border-white/10 rounded-3xl p-8 md:p-14 backdrop-blur-xl space-y-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
            {/* Header / Identity */}
            <header className="border-b border-white/10 pb-8 print:border-black/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white print:text-black">
                    {name}
                  </h1>
                  <p className="text-cyan-400 print:text-blue-700 font-mono text-sm md:text-base font-semibold mt-1">
                    {title}
                  </p>
                  <p className="text-gray-400 print:text-gray-600 text-xs md:text-sm mt-1">
                    India • Remote Available • Full-Stack &amp; Automation
                  </p>
                </div>

                {/* Social & Contact Badges */}
                <div className="flex flex-wrap gap-2 print:text-black">
                  <a
                    href={`mailto:${email}`}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 hover:text-cyan-300 transition-colors flex items-center gap-1.5 print:border-gray-300 print:text-black"
                  >
                    <span className="material-symbols-outlined text-[14px]">mail</span>
                    {email}
                  </a>
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#0077b5]/20 border border-[#0077b5]/30 text-xs text-[#0077b5] hover:bg-[#0077b5]/30 transition-colors flex items-center gap-1.5 print:border-gray-300"
                  >
                    <span className="material-symbols-outlined text-[14px]">link</span>
                    LinkedIn
                  </a>
                  <a
                    href={github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 hover:text-white transition-colors flex items-center gap-1.5 print:border-gray-300 print:text-black"
                  >
                    <span className="material-symbols-outlined text-[14px]">code</span>
                    GitHub
                  </a>
                </div>
              </div>
            </header>

            {/* Professional Summary */}
            <section className="space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 print:text-blue-800 font-bold">
                01 // Professional Summary
              </h2>
              <p className="text-gray-300 print:text-gray-800 text-sm md:text-base leading-relaxed">
                {person?.bio ||
                  "Entrepreneur, Full Stack Developer, and Automation Specialist building scalable web applications, AI business workflows, and backend infrastructure. Specialized in Next.js, TypeScript, Python, FastAPI, Docker, cloud deployment, and automated business operations."}
              </p>
            </section>

            {/* Core Competencies & Skills */}
            <section className="space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 print:text-blue-800 font-bold">
                02 // Technical Skills &amp; Domain Expertise
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 print:border-gray-200 print:bg-gray-50">
                  <h3 className="text-xs font-mono text-gray-400 print:text-gray-600 uppercase mb-2">
                    Full-Stack &amp; Frameworks
                  </h3>
                  <p className="text-xs md:text-sm text-gray-200 print:text-black leading-relaxed">
                    React, Next.js (App Router), TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS, Material UI, Shadcn, Node.js, Express, Python, FastAPI, Flask, Flutter, Dart
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 print:border-gray-200 print:bg-gray-50">
                  <h3 className="text-xs font-mono text-gray-400 print:text-gray-600 uppercase mb-2">
                    Automation &amp; AI Systems
                  </h3>
                  <p className="text-xs md:text-sm text-gray-200 print:text-black leading-relaxed">
                    n8n, Make, OpenAI API, Claude API, Automated Cold Email Pipelines, AI Call Assistants, AI Chat Agents, Google Sheets/CRM Sync, Ollama/Qwen Local AI
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 print:border-gray-200 print:bg-gray-50">
                  <h3 className="text-xs font-mono text-gray-400 print:text-gray-600 uppercase mb-2">
                    Databases &amp; APIs
                  </h3>
                  <p className="text-xs md:text-sm text-gray-200 print:text-black leading-relaxed">
                    PostgreSQL, MySQL, MongoDB, Firebase, Prisma ORM, REST APIs, GraphQL, Razorpay, Stripe, Real-Time WebSockets
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 print:border-gray-200 print:bg-gray-50">
                  <h3 className="text-xs font-mono text-gray-400 print:text-gray-600 uppercase mb-2">
                    Infrastructure &amp; DevOps
                  </h3>
                  <p className="text-xs md:text-sm text-gray-200 print:text-black leading-relaxed">
                    Docker, Linux, Nginx, AWS, GCP, DigitalOcean, Technical SEO, Schema.org JSON-LD, Continuous Deployment (CI/CD)
                  </p>
                </div>
              </div>
            </section>

            {/* Work Experience */}
            <section className="space-y-6">
              <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 print:text-blue-800 font-bold">
                03 // Experience
              </h2>
              <div className="space-y-6">
                {experiences.length > 0 ? (
                  experiences.map((exp: any, idx: number) => (
                    <div
                      key={idx}
                      className="border-l-2 border-cyan-500/40 pl-4 space-y-2 print:border-blue-700"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <h3 className="text-base font-bold text-white print:text-black">
                          {exp.role} <span className="text-cyan-400 print:text-blue-800 font-normal">@ {exp.company}</span>
                        </h3>
                        <span className="text-xs font-mono text-gray-400 print:text-gray-600">
                          {exp.period}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-300 print:text-gray-700 leading-relaxed">
                        {exp.description}
                      </p>
                      {Array.isArray(exp.highlights) && (
                        <ul className="list-disc list-inside text-xs text-gray-400 print:text-gray-600 space-y-1">
                          {exp.highlights.map((hl: string, hIdx: number) => (
                            <li key={hIdx}>{hl}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="border-l-2 border-cyan-500/40 pl-4 space-y-2 print:border-blue-700">
                    <div className="flex justify-between items-center">
                      <h3 className="text-base font-bold text-white print:text-black">
                        Founder &amp; Full Stack Lead @ Chowdhury Duo
                      </h3>
                      <span className="text-xs font-mono text-gray-400">2023 – Present</span>
                    </div>
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      Engineering production web applications, automated workflow systems, digital product sales, and technical SEO architecture.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Featured Projects from Resume */}
            <section className="space-y-6">
              <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 print:text-blue-800 font-bold">
                04 // Featured Engineering Projects
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-5 rounded-xl bg-white/5 border border-white/5 print:border-gray-200 print:bg-gray-50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-white print:text-black">
                          {proj.title}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-300 print:text-gray-700 leading-relaxed mt-1">
                        {proj.shortDesc}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 print:border-gray-200 flex items-center justify-between text-xs font-mono">
                      <div className="flex flex-wrap gap-1">
                        {proj.technologies.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-400 print:text-gray-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <Link
                        href={`/projects/${proj.slug}`}
                        className="text-cyan-400 hover:text-cyan-300 print:hidden"
                      >
                        Case Study →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Education & Achievements */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/10 pt-8 print:border-black/20">
              <div className="space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 print:text-blue-800 font-bold">
                  05 // Education
                </h2>
                {educations.length > 0 ? (
                  educations.map((edu: any, idx: number) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <div className="font-bold text-white print:text-black">{edu.degree}</div>
                      <div className="text-gray-400 print:text-gray-600">{edu.institution} ({edu.year})</div>
                      {edu.details && <div className="text-gray-500">{edu.details}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-300">
                    Computer Science &amp; Engineering Studies
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 print:text-blue-800 font-bold">
                  06 // Key Strengths
                </h2>
                <ul className="text-xs text-gray-300 print:text-gray-700 space-y-1">
                  <li>• End-to-end full project lifecycle management</li>
                  <li>• Type-safe, scalable web architecture (Next.js / TypeScript)</li>
                  <li>• Deep hands-on workflow automation and AI agent integration</li>
                  <li>• Technical SEO, Schema.org entity linking &amp; performance tuning</li>
                </ul>
              </div>
            </section>
          </div>
        </main>

        <div className="print:hidden">
          <Footer />
        </div>
      </div>
    </ThemeProvider>
  );
}
