import { prisma } from "@/lib/prisma";
import { toPostCard } from "@/lib/postTypes";
import HomeClient from "@/components/HomeClient";

// Opt out of ISR — rely solely on on-demand revalidation via revalidatePath()
export const revalidate = false;

export default async function HomePage() {
  let posts: ReturnType<typeof toPostCard>[] = [];
  let services: Array<{
    id: string;
    name: string;
    slug: string;
    shortDesc: string | null;
    icon: string | null;
    category: string | null;
  }> = [];
  let projects: Array<{
    id: string;
    title: string;
    slug: string;
    shortDesc: string | null;
    role: string | null;
    technologies: string[];
  }> = [];

  try {
    const [dbPosts, dbServices, dbProjects] = await Promise.all([
      prisma.post.findMany({
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
      }),
      prisma.service.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        take: 3,
        select: {
          id: true,
          name: true,
          slug: true,
          shortDesc: true,
          icon: true,
          category: true,
        },
      }),
      prisma.project.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        take: 3,
        select: {
          id: true,
          title: true,
          slug: true,
          shortDesc: true,
          role: true,
          technologies: true,
        },
      }),
    ]);
    posts = dbPosts.map(toPostCard);
    services = dbServices;
    projects = dbProjects;
  } catch (err) {
    console.error("Failed to fetch data for homepage:", err);
  }

  return (
    <HomeClient
      posts={posts}
      services={services}
      projects={projects}
    />
  );
}
