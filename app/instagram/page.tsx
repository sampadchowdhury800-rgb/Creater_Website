import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { Camera } from "lucide-react";
import Leaderboard728 from "@/components/ads/Leaderboard728";
import ShareButton from "@/components/ShareButton";

export const revalidate = 0;

type Post = {
  id: string;
  slug: string;
  title: string;
  shortDesc: string | null;
  featuredImage: string | null;
  instagramUrl: string | null;
};

export default async function InstagramPage() {
  let posts: Post[] = [];
  try {
    posts = await prisma.post.findMany({
      where: { platform: "INSTAGRAM", status: "PUBLISHED" },
      orderBy: { publishDate: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDesc: true,
        featuredImage: true,
        instagramUrl: true,
      },
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
          <Camera className="text-pink-500" size={24} />
          Instagram Posts & Videos
        </h1>
        <ShareButton title="Chowdhury Duo Instagram Posts" url="/instagram" iconOnly />
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <Leaderboard728 />
        {posts.length === 0 ? (
          <div className="text-center py-24 text-[#6B7280]">
            <Camera size={48} className="mx-auto mb-4 text-[#374151]" />
            <p className="text-lg">No Instagram posts published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const canonicalUrl = `/posts/${post.slug}`;

              return (
                <article
                  key={post.id}
                  className="bg-[#111827] border border-white/8 rounded-2xl overflow-hidden hover:border-pink-500/30 transition-colors group flex flex-col justify-between relative"
                >
                  <div className="absolute top-3 right-3 z-20">
                    <ShareButton
                      title={post.title}
                      url={canonicalUrl}
                      iconOnly
                      className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white rounded-full transition-transform active:scale-90"
                    />
                  </div>

                  <Link href={canonicalUrl} className="block">
                    {post.featuredImage && (
                      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
                        <Image
                          src={post.featuredImage}
                          alt={post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <h2 className="text-base font-semibold text-white mb-1 line-clamp-2 group-hover:text-pink-400 transition-colors">
                        {post.title}
                      </h2>
                      {post.shortDesc && (
                        <p className="text-sm text-[#6B7280] line-clamp-2 mb-3">
                          {post.shortDesc}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="p-5 pt-0 flex items-center justify-between border-t border-white/5 mt-auto">
                    <Link
                      href={canonicalUrl}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      View Details
                    </Link>
                    {post.instagramUrl && (
                      <a
                        href={post.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 font-medium transition-colors"
                      >
                        <Camera size={12} />
                        View on Instagram
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
