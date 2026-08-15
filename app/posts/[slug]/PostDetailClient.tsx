"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import ShareButton from "@/components/ShareButton";
import PromptModal from "@/components/PromptModal";
import VideoCardComponent from "@/components/VideoCard";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import type { PostCard, ToolLink } from "@/lib/postTypes";
import { Play, Camera, ExternalLink, Calendar, Clock, Tag as TagIcon, Sparkles, ArrowLeft, ChevronRight, ChevronDown } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
  sortOrder?: number;
}

interface PostDetailClientProps {
  post: any;
  postCard: PostCard;
  recentPosts: PostCard[];
  directAnswer?: string | null;
  faqs?: FaqItem[];
}

function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!faqs || faqs.length === 0) return null;
  const sorted = [...faqs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return (
    <section aria-label="Frequently Asked Questions" className="mb-10">
      <h2 className="text-2xl font-bold text-white mb-4">Frequently Asked Questions</h2>
      <div className="space-y-2">
        {sorted.map((faq, idx) => (
          <div key={idx} className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.03]">
            <button
              type="button"
              aria-expanded={openIndex === idx}
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-white font-semibold text-sm hover:bg-white/5 transition-colors"
            >
              <span>{faq.question}</span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-cyan-400 transition-transform ${openIndex === idx ? 'rotate-180' : ''}`}
              />
            </button>
            {openIndex === idx && (
              <div className="px-5 pb-5 text-on-surface-variant text-sm leading-relaxed">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PostDetailClient({ post, postCard, recentPosts, directAnswer, faqs = [] }: PostDetailClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSectionTitle, setModalSectionTitle] = useState("AI Prompts");
  const [modalLinks, setModalLinks] = useState<ToolLink[]>([]);

  const isYoutube = post.platform === "YOUTUBE";
  const isInstagram = post.platform === "INSTAGRAM";
  const embedUrl = isYoutube ? getYouTubeEmbedUrl(post.youtubeUrl || post.videoUrl) : null;
  const canonicalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/posts/${post.slug}`
    : `/posts/${post.slug}`;

  const openPromptsModal = (sectionTitle: string, links: ToolLink[]) => {
    setModalSectionTitle(sectionTitle);
    setModalLinks(links);
    setModalOpen(true);
  };

  return (
    <ThemeProvider>
      <div className="bg-background dark:bg-background selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-24 px-4 sm:px-6 max-w-[1100px] mx-auto w-full">
          {/* Back link & Category */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Link
              href="/#videos"
              className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Showcase</span>
            </Link>

            <div className="flex items-center gap-2">
              {isYoutube && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-bold">
                  <Play className="w-3 h-3 fill-current" />
                  YouTube
                </span>
              )}
              {isInstagram && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-full text-xs font-bold">
                  <Camera className="w-3 h-3" />
                  Instagram
                </span>
              )}
              {post.categories?.map((cat: any) => (
                <span
                  key={cat.id}
                  className="px-3 py-1 bg-white/5 border border-white/10 text-on-surface-variant rounded-full text-xs font-medium"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          </div>

          {/* Title and Meta */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{new Date(post.publishDate || post.createdAt).toLocaleDateString()}</span>
              </div>
              {post.readingTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{post.readingTime} min read</span>
                </div>
              )}
            </div>
          </div>

          {/* AEO Direct Answer — visible for AI + human answer engines */}
          {directAnswer && (
            <div className="mb-6 p-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/30" role="note" aria-label="Direct Answer">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-cyan-400 text-[18px]" aria-hidden="true">verified</span>
                <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest font-bold">Quick Answer</span>
              </div>
              <p className="text-white text-sm leading-relaxed">{directAnswer}</p>
            </div>
          )}

          {/* Main Media Player / Embed */}
          <div className="mb-8 rounded-2xl overflow-hidden border border-white/10 bg-black/60 shadow-2xl">
            {embedUrl ? (
              <div className="relative aspect-video w-full">
                <iframe
                  src={embedUrl}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
            ) : post.featuredImage ? (
              <div className="relative aspect-video w-full bg-black/40">
                <Image
                  src={post.featuredImage}
                  alt={post.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}

            {/* Action Bar Below Media */}
            <div className="p-4 sm:p-6 bg-white/[0.03] border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {post.youtubeUrl && (
                  <a
                    href={post.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Watch on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                )}
                {post.instagramUrl && (
                  <a
                    href={post.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(219,39,119,0.3)]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>View on Instagram</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-3">
                <ShareButton
                  title={post.title}
                  url={canonicalUrl}
                  label="Share Content"
                />
              </div>
            </div>
          </div>

          {/* Description & Prompts & Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            {/* Left Col: Short Desc & Body Content */}
            <div className="lg:col-span-2 space-y-6">
              {post.shortDesc && (
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <h2 className="text-lg font-bold text-white mb-2">Overview</h2>
                  <p className="text-on-surface-variant text-base leading-relaxed">{post.shortDesc}</p>
                </div>
              )}

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <TagIcon className="w-4 h-4 text-on-surface-variant mr-1" />
                  {post.tags.map((tag: any) => (
                    <span
                      key={tag.id}
                      className="px-3 py-1 bg-white/5 border border-white/10 text-on-surface-variant text-xs rounded-lg font-mono"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Prompts & AI Resources */}
            <div className="space-y-6">
              {postCard.promptSections && postCard.promptSections.length > 0 ? (
                postCard.promptSections.map((sec) => (
                  <div key={sec.id} className="p-6 bg-white/5 border border-cyan-500/20 bg-cyan-500/[0.02] rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-white text-base">{sec.sectionTitle}</h3>
                    </div>
                    <div className="space-y-2 mb-4">
                      {sec.items.slice(0, 4).map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => openPromptsModal(sec.sectionTitle, [item])}
                          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs text-white"
                        >
                          <span className="font-medium truncate">{item.label}</span>
                          <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => openPromptsModal(sec.sectionTitle, sec.items)}
                      className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      View All Prompts ({sec.items.length})
                    </button>
                  </div>
                ))
              ) : postCard.toolLinks && postCard.toolLinks.length > 0 ? (
                <div className="p-6 bg-white/5 border border-cyan-500/20 bg-cyan-500/[0.02] rounded-2xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-white text-base">AI Prompts & Resources</h3>
                  </div>
                  <button
                    onClick={() => openPromptsModal("AI Prompts", postCard.toolLinks)}
                    className="w-full py-2.5 bg-primary text-black hover:bg-primary-fixed font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Open Prompts Pack ({postCard.toolLinks.length})
                  </button>
                </div>
              ) : (
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
                  <h3 className="font-bold text-white mb-2">Automate Your Workflow</h3>
                  <p className="text-xs text-on-surface-variant mb-4">
                    Discover pre-built AI automation packs designed by Chowdhury Duo.
                  </p>
                  <Link
                    href="/automations"
                    className="inline-flex w-full justify-center py-2.5 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold text-xs rounded-xl transition-colors"
                  >
                    Browse Automations
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* FAQ Section — visible for AEO / FAQPage schema */}
          {faqs.length > 0 && (
            <FaqAccordion faqs={faqs} />
          )}

          {/* Recommended / Recent Content */}
          {recentPosts.length > 0 && (
            <div className="border-t border-white/10 pt-12">
              <h2 className="text-2xl font-bold text-white mb-8">More Content from Chowdhury Duo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recentPosts.map((rec) => (
                  <div key={rec.id} className="h-full">
                    <VideoCardComponent video={rec} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Lazy Prompt Modal */}
        <PromptModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={post.title}
          sectionTitle={modalSectionTitle}
          links={modalLinks}
        />

        <Footer />
      </div>
    </ThemeProvider>
  );
}
