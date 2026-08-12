import { prisma } from "@/lib/prisma";
import { toPostCard } from "@/lib/postTypes";
import HomeClient from "@/components/HomeClient";

// Opt out of ISR — rely solely on on-demand revalidation via revalidatePath()
export const revalidate = false;

export default async function HomePage() {
  let posts: ReturnType<typeof toPostCard>[] = [];

  try {
    const dbPosts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishDate: "desc" },
      select: {
        id: true,
        title: true,
        shortDesc: true,
        slug: true,
        featuredImage: true,
        youtubeUrl: true,
        instagramUrl: true,
        videoUrl: true,
        platform: true,
        status: true,
        content: true,
      },
    });
    posts = dbPosts.map(toPostCard);
  } catch (err) {
    console.error("Failed to fetch posts for homepage:", err);
  }

  return <HomeClient posts={posts} />;
}
