"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import type { PostCard } from "@/lib/postTypes";
import { getPostHref } from "@/lib/postTypes";
import VideoCardComponent from "./VideoCard";

interface VideoShowcaseProps {
  videos: PostCard[];
}

export default function VideoShowcase({ videos }: VideoShowcaseProps) {
  const [activePlatform, setActivePlatform] = useState<"YOUTUBE" | "INSTAGRAM">(
    "YOUTUBE"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const youtubeVideos = useMemo(
    () => videos.filter((v) => v.platform === "YOUTUBE"),
    [videos]
  );
  const instagramVideos = useMemo(
    () => videos.filter((v) => v.platform === "INSTAGRAM"),
    [videos]
  );

  const activeVideos = activePlatform === "YOUTUBE" ? youtubeVideos : instagramVideos;

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return activeVideos;
    const q = searchQuery.toLowerCase();
    return activeVideos.filter((v) => v.title.toLowerCase().includes(q));
  }, [activeVideos, searchQuery]);

  // Recommendations — videos NOT in current search results
  const recommendations = useMemo(() => {
    const notShown = videos.filter(
      (v) => !filteredVideos.find((fv) => fv.id === v.id)
    );
    return [...notShown]
      .sort((a, b) => {
        const ha = a.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hb = b.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return ha - hb;
      })
      .slice(0, 4);
  }, [videos, filteredVideos]);

  const clearSearch = useCallback(() => setSearchQuery(""), []);

  const gridClass = activePlatform === "YOUTUBE" ? "youtube-grid" : "instagram-grid";

  return (
    <section
      id="videos"
      className="py-16 md:py-24 px-4 md:px-6 max-w-[1440px] mx-auto"
    >
      {/* Section heading */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="font-label-caps text-label-caps text-primary-fixed-dim dark:text-primary-fixed tracking-widest block mb-2 uppercase">
            Latest Creations
          </span>
          <h2 className="font-headline-md text-headline-md text-on-tertiary-fixed dark:text-on-surface">
            Video Showcase
          </h2>
        </div>
      </div>

      {/* Search Controls */}
      <div className="mb-8">
        <div className="w-full bg-white/5 dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/10 backdrop-blur-md">
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <label className="block text-label-caps text-label-caps text-on-tertiary-fixed-variant mb-2">
                Search by Video Title
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-on-tertiary-fixed-variant dark:text-on-surface-variant text-[20px]">
                  search
                </span>
                <input
                  id="video-search"
                  placeholder="Search by video title"
                  className="w-full text-body-md py-4 pl-12 pr-12 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-tertiary-fixed dark:text-on-surface"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="absolute right-4 text-on-tertiary-fixed-variant hover:text-on-tertiary-fixed dark:text-on-surface-variant dark:hover:text-on-surface transition-colors"
                    onClick={clearSearch}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      close
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
          {searchQuery && (
            <div className="mt-4 text-sm text-on-tertiary-fixed-variant">
              {filteredVideos.length} result
              {filteredVideos.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Recommendations */}
        {searchQuery && recommendations.length > 0 && (
          <div className="mt-6">
            <h4 className="font-label-caps text-label-caps text-primary-fixed-dim uppercase mb-3">
              Recommendations
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recommendations.map((v) => (
                <a
                  key={v.id}
                  className="group block flex-shrink-0 w-44 bg-white/60 dark:bg-surface-container-low/40 rounded-xl overflow-hidden p-3 border border-black/5 dark:border-white/5 hover:scale-105 transition-transform"
                  href={getPostHref(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {v.featuredImage && (
                    <Image
                      src={v.featuredImage}
                      className="w-full h-24 object-cover rounded mb-2"
                      alt={v.title}
                      width={320}
                      height={180}
                      unoptimized
                    />
                  )}
                  <div className="text-xs font-semibold line-clamp-2 text-on-tertiary-fixed dark:text-on-surface">
                    {v.title}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Platform Tabs */}
      <div className="flex gap-3 sm:gap-4 mb-8 flex-wrap">
        <button
          id="tab-youtube"
          className={`platform-tab${activePlatform === "YOUTUBE" ? " active" : ""}`}
          aria-pressed={activePlatform === "YOUTUBE"}
          aria-label="Show YouTube videos"
          onClick={() => { setActivePlatform("YOUTUBE"); setSearchQuery(""); }}
        >
          <span
            className="material-symbols-outlined tab-icon text-[22px]"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            play_circle
          </span>
          YouTube
        </button>
        <button
          id="tab-instagram"
          className={`platform-tab${activePlatform === "INSTAGRAM" ? " active" : ""}`}
          aria-pressed={activePlatform === "INSTAGRAM"}
          aria-label="Show Instagram reels"
          onClick={() => { setActivePlatform("INSTAGRAM"); setSearchQuery(""); }}
        >
          <span className="material-symbols-outlined tab-icon text-[22px]">
            photo_camera
          </span>
          Instagram
        </button>
      </div>

      {/* Video grid */}
      <div className={gridClass}>
        {filteredVideos.map((v) => (
          <VideoCardComponent key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}
