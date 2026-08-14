"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import ShareButton from "@/components/ShareButton";
import { Newspaper, Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";

interface NewsClientProps {
  posts: any[];
}

export default function NewsClient({ posts }: NewsClientProps) {
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
                <Newspaper className="w-4 h-4" />
                <span>Latest Updates</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                News & Announcements
              </h1>
            </div>

            <ShareButton
              title="Chowdhury Duo News & Updates"
              url="/news"
              label="Share News"
            />
          </div>

          {/* Posts Grid */}
          {posts.length === 0 ? (
            <div className="text-center py-24 bg-white/5 border border-white/10 rounded-2xl">
              <Newspaper className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
              <p className="text-lg text-white font-bold mb-2">No news published yet</p>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto mb-6">
                Stay tuned for upcoming channel updates, announcements, and AI releases.
              </p>
              <Link
                href="/automations"
                className="inline-flex px-6 py-2.5 bg-primary text-black font-bold text-sm rounded-xl hover:bg-primary-fixed transition-colors"
              >
                Browse Automations
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => {
                const canonicalUrl = `/posts/${post.slug}`;

                return (
                  <article
                    key={post.id}
                    className="bg-white/5 border border-white/10 hover:border-primary/40 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col group"
                  >
                    {/* Image / Thumbnail */}
                    <div className="relative aspect-video w-full bg-black/40 overflow-hidden">
                      {post.featuredImage ? (
                        <Image
                          src={post.featuredImage}
                          alt={post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20">
                          <Sparkles className="w-8 h-8" />
                        </div>
                      )}

                      <div className="absolute top-3 right-3 z-10">
                        <ShareButton
                          title={post.title}
                          url={canonicalUrl}
                          iconOnly
                          className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white rounded-full transition-transform active:scale-90"
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            {new Date(post.publishDate || post.createdAt).toLocaleDateString()}
                          </span>
                          {post.readingTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              {post.readingTime}m read
                            </span>
                          )}
                        </div>

                        <Link href={canonicalUrl} className="block group-hover:text-primary transition-colors">
                          <h2 className="text-xl font-bold text-white mb-2 line-clamp-2">
                            {post.title}
                          </h2>
                        </Link>

                        {post.shortDesc && (
                          <p className="text-sm text-on-surface-variant line-clamp-2 mb-4">
                            {post.shortDesc}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                        <Link
                          href={canonicalUrl}
                          className="inline-flex items-center gap-1.5 text-primary hover:text-primary-fixed text-xs font-bold transition-colors"
                        >
                          <span>Read Full Story</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
