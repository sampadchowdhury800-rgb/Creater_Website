/**
 * lib/postTypes.ts
 *
 * Shared types for DB-driven post rendering.
 */

export interface ToolLink {
  label: string;
  url: string;           // stores the prompt text
  websiteLabel?: string; // optional CTA button label
  websiteUrl?: string;   // optional CTA button destination
}

export type PromptItem = ToolLink;

export interface PromptSection {
  id: string;
  sectionTitle: string;
  items: PromptItem[];
}

/** Content JSON stored in Post.content field */
export interface PostContent {
  toolLinks?: ToolLink[]; // Legacy format
  promptSections?: PromptSection[]; // New nested format
  badge?: string | null;
  comingSoon?: boolean;
  [key: string]: unknown;
}

/**
 * Normalised shape used by VideoCard / VideoShowcase / Navbar / MobileMenu.
 * Derived from a DB Post row.
 */
export interface PostCard {
  id: string;
  title: string;
  shortDesc: string | null;
  slug: string;
  featuredImage: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  videoUrl: string | null;
  platform: "YOUTUBE" | "INSTAGRAM";
  status: "DRAFT" | "PUBLISHED";
  badge: string | null;
  comingSoon: boolean;
  toolLinks: ToolLink[]; // Legacy
  promptSections: PromptSection[]; // New format (includes legacy data fallback)
}

/** Parse the JSON content field stored on each Post */
export function parsePostContent(content: string | null): PostContent {
  if (!content) return {};
  try {
    return JSON.parse(content) as PostContent;
  } catch {
    return {};
  }
}

/** Convert a raw DB Post row (or Prisma Post) into a PostCard */
export function toPostCard(post: {
  id: string;
  title: string;
  shortDesc: string | null;
  slug: string;
  featuredImage: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  videoUrl: string | null;
  platform: string;
  status: string;
  content: string | null;
}): PostCard {
  const parsed = parsePostContent(post.content);
  
  // Backward compatibility: If no promptSections, wrap legacy toolLinks in a default section
  let promptSections = parsed.promptSections ?? [];
  if (promptSections.length === 0 && parsed.toolLinks && parsed.toolLinks.length > 0) {
    promptSections = [
      {
        id: "legacy",
        sectionTitle: "AI Prompts",
        items: parsed.toolLinks,
      }
    ];
  }

  return {
    id: post.id,
    title: post.title,
    shortDesc: post.shortDesc,
    slug: post.slug,
    featuredImage: post.featuredImage,
    youtubeUrl: post.youtubeUrl,
    instagramUrl: post.instagramUrl,
    videoUrl: post.videoUrl,
    platform: post.platform as "YOUTUBE" | "INSTAGRAM",
    status: post.status as "DRAFT" | "PUBLISHED",
    badge: parsed.badge ?? null,
    comingSoon: parsed.comingSoon ?? false,
    toolLinks: parsed.toolLinks ?? [],
    promptSections,
  };
}

/** Return the primary href for a PostCard (YouTube or Instagram URL) */
export function getPostHref(post: PostCard): string | undefined {
  return (
    post.videoUrl ||
    post.youtubeUrl ||
    post.instagramUrl ||
    undefined
  );
}
