import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import Leaderboard728 from "@/components/ads/Leaderboard728";

// Opt out of ISR — rely solely on on-demand revalidation via revalidatePath()
export const revalidate = false;

type Post = {
  id: string;
  title: string;
  shortDesc: string | null;
  featuredImage: string | null;
  youtubeUrl: string | null;
};

export default async function YouTubePage() {
  let posts: Post[] = [];
  try {
    posts = await prisma.post.findMany({
      where: { platform: "YOUTUBE", status: "PUBLISHED" },
      orderBy: { publishDate: "desc" },
    });
  } catch (_error) {
    console.error("DB not connected:", _error);
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white hover:text-cyan-400 transition-colors">
          ← Back
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Play className="text-red-500" size={24} />
          YouTube Posts
        </h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <Leaderboard728 />
        {posts.length === 0 ? (
          <div className="text-center py-24 text-[#6B7280]">
            <Play size={48} className="mx-auto mb-4 text-[#374151]" />
            <p className="text-lg">No YouTube posts published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-[#111827] border border-white/8 rounded-2xl overflow-hidden hover:border-red-500/30 transition-colors group"
              >
                {post.featuredImage && (
                  <Image
                    src={post.featuredImage}
                    alt={post.title}
                    width={800}
                    height={450}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                )}
                <div className="p-5">
                  <h2 className="text-base font-semibold text-white mb-1 line-clamp-2">
                    {post.title}
                  </h2>
                  {post.shortDesc && (
                    <p className="text-sm text-[#6B7280] line-clamp-2 mb-3">
                      {post.shortDesc}
                    </p>
                  )}
                  {post.youtubeUrl && (
                    <a
                      href={post.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                    >
                      <Play size={14} />
                      Watch on YouTube
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
