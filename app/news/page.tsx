import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import NewsClient from "./NewsClient";

export const metadata: Metadata = {
  title: "News & Announcements | Chowdhury Duo",
  description: "Latest news, updates, AI workflow releases, and announcements from Chowdhury Duo.",
  openGraph: {
    title: "News & Announcements | Chowdhury Duo",
    description: "Latest news, updates, AI workflow releases, and announcements from Chowdhury Duo.",
    url: "https://chowdhuryduo.com/news",
  },
};

export const revalidate = 0;

export default async function NewsPage() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishDate: "desc" },
    include: {
      tags: true,
      categories: true,
    },
  });

  return <NewsClient posts={posts} />;
}
