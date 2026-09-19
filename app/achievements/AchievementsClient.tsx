"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import ShareButton from "@/components/ShareButton";
import { Trophy, Award, TrendingUp, Sparkles, Play } from "lucide-react";

const achievements = [
  {
    icon: Trophy,
    title: "Silver Creator Award",
    organization: "YouTube",
    date: "100,000+ Subscribers",
    description:
      "Awarded by YouTube for surpassing 100,000 dedicated creators, developers, and tech enthusiasts on the official Chowdhury Duo channel.",
    highlight: "100K+ Community",
  },
  {
    icon: TrendingUp,
    title: "Over 10 Million+ Video Impressions",
    organization: "Global Reach",
    date: "2024 - Present",
    description:
      "Empowering developers and content creators worldwide with cutting-edge AI tutorials, workflow automations, and technology breakdowns.",
    highlight: "10M+ Reach",
  },
  {
    icon: Sparkles,
    title: "Top AI Automation Marketplace",
    organization: "Chowdhury Duo Lab",
    date: "Official Launch",
    description:
      "Engineered production-grade automation systems and AI workflows that save businesses and solo operators hundreds of hours weekly.",
    highlight: "50+ Automations",
  },
  {
    icon: Award,
    title: "Industry Collaboration & Brand Partnerships",
    organization: "Tech & AI Ecosystem",
    date: "Ongoing",
    description:
      "Partnered with premier AI toolmakers, SaaS builders, and dev platforms to deliver high-impact developer content and educational guides.",
    highlight: "Trusted Partners",
  },
];

export default function AchievementsClient() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="bg-background dark:bg-background selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-24 px-4 sm:px-6 max-w-[1200px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 text-primary text-sm font-label-caps uppercase tracking-widest mb-3">
                <Trophy className="w-4 h-4" />
                <span>Our Milestones</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Achievements & Impact
              </h1>
            </div>

            <ShareButton
              title="Chowdhury Duo Achievements"
              url="/achievements"
              label="Share Achievements"
            />
          </div>

          {/* Key Stats Counter Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-primary mb-1">100K+</p>
              <p className="text-xs text-on-surface-variant font-label-caps tracking-wider uppercase">Subscribers</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-primary mb-1">10M+</p>
              <p className="text-xs text-on-surface-variant font-label-caps tracking-wider uppercase">Impressions</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-primary mb-1">100+</p>
              <p className="text-xs text-on-surface-variant font-label-caps tracking-wider uppercase">AI Guides</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-primary mb-1">99.8%</p>
              <p className="text-xs text-on-surface-variant font-label-caps tracking-wider uppercase">Positive Feedback</p>
            </div>
          </div>

          {/* Achievement Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {achievements.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-8 bg-white/5 border border-white/10 hover:border-primary/40 rounded-2xl transition-all duration-300 relative group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="px-3 py-1 bg-white/5 border border-white/10 text-xs font-mono text-primary rounded-full">
                        {item.highlight}
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider mb-4">
                      {item.organization} • {item.date}
                    </p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-white/40">Verified Milestone</span>
                    <ShareButton
                      title={`${item.title} — Chowdhury Duo`}
                      url="/achievements"
                      iconOnly
                      className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action CTA */}
          <div className="p-8 md:p-12 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent border border-cyan-500/20 rounded-3xl text-center flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Join the Chowdhury Duo Journey</h2>
            <p className="text-sm text-on-surface-variant max-w-lg mb-6">
              Subscribe to the channel, explore our automation workflows, and elevate your tech stack.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href="https://www.youtube.com/@ChowdhuryDuo"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Subscribe on YouTube
              </a>
              <Link
                href="/automations"
                className="px-8 py-3.5 bg-primary text-black hover:bg-primary-fixed font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(0,219,238,0.3)]"
              >
                Explore Automations
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
