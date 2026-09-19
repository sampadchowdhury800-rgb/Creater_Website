/**
 * Seed script — migrates all hardcoded posts from lib/videos.ts into the Neon database.
 * SAFE TO RUN MULTIPLE TIMES — uses slug-based upsert to avoid duplicates.
 *
 * Usage: node scripts/seed-posts.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Load .env ────────────────────────────────────────────────────────────────
const envContent = readFileSync(resolve(root, ".env"), "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  process.env[key] = val;
}

// ── Posts to migrate (from lib/videos.ts) ────────────────────────────────────
//
// toolLinks are stored as JSON in the `content` field so they can be read back
// and displayed on the live website — no data is lost.

const posts = [
  // ── YouTube ─────────────────────────────────────────────────────────────
  {
    title: "FREE Claude OPOS 4.7 API Setup 🤯 Build AI Trading Bots FREE",
    slug: "free-claude-opos-47-api-setup-build-ai-trading-bots-free",
    shortDesc:
      "Master AI trading bot development with this comprehensive API setup guide.",
    featuredImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAkh9W3nCr93XNBc6wDMC1-VVsryL5UokFl-m_T_sh3SpxV-gYLiP9Wt1ONfxn7XM5IIHd7czMptd_kQdxQlcIpshE8qjZweEmiRWgujGMO4jBdxKi7muYGK4YhWHvHlziTltEEC9Pm_bXs7ojV66txbVSTivE_A2QmtkvlT2EcK4jXq688GwT5KEpHNQzT3I8H2c7rfH44E3GMe3fBz_kCrZR9ZyOe6nAXrWDiIH8-_h9xSgdf1aCh8lKlBh6ZU8Mjl_3a51nzrQ",
    youtubeUrl: "https://youtu.be/-SfHYo_j2gI?si=dSU00FEA9YuCq7h8",
    platform: "YOUTUBE",
    status: "PUBLISHED",
    badge: "WATCH NOW",
    toolLinks: [
      { label: "Website 1", url: "https://claude.ai" },
      { label: "Website 2", url: "https://openai.com" },
      { label: "Website 3", url: "https://example.com" },
      { label: "Website 4", url: "https://example.com" },
      { label: "Website 5", url: "https://example.com" },
    ],
  },
  {
    title: "UNLIMITED & FREE CODEX with GPT 5.5 — Easy Tutorial Under 5 Minutes",
    slug: "unlimited-free-codex-gpt-55-easy-tutorial-under-5-minutes",
    shortDesc:
      "Watch the full walkthrough for unlimited access to the latest Codex AI models and fast setup tips.",
    featuredImage: "https://img.youtube.com/vi/axnUSQWSxNY/maxresdefault.jpg",
    youtubeUrl: "https://youtu.be/axnUSQWSxNY?si=JDHQHPV5DrotkkIj",
    platform: "YOUTUBE",
    status: "PUBLISHED",
    badge: "WATCH NOW",
    toolLinks: [
      { label: "Website 1", url: "https://example.com" },
      { label: "Website 2", url: "https://example.com" },
    ],
  },
  {
    title: "Lifestyle: The Creative Grind",
    slug: "lifestyle-the-creative-grind",
    shortDesc:
      "A raw look behind the scenes of our biggest project yet. Balancing art and life.",
    featuredImage: null,
    youtubeUrl: "https://www.youtube.com/@ChowdhuryDuo",
    platform: "YOUTUBE",
    status: "DRAFT",
    badge: "COMING SOON",
    toolLinks: [{ label: "Website 1", url: "https://example.com" }],
  },

  // ── Instagram ────────────────────────────────────────────────────────────
  {
    title: "How to Make 3d Website",
    slug: "how-to-make-3d-website",
    shortDesc: "Post Number 1",
    featuredImage: "/images/zyno_thumbnail.jpeg",
    instagramUrl:
      "https://www.instagram.com/reel/Da_JuLSBqoJ/?igsh=MXB1M2d5dHI1Zmdrag==",
    platform: "INSTAGRAM",
    status: "PUBLISHED",
    badge: "WATCH NOW",
    toolLinks: [
      {
        label: "Start frame (your product):",
        url: `High-end studio product photograph of [YOUR PRODUCT], fully assembled and intact, floating dead center against a seamless matte light-grey studio background. Straight-on view, perfectly level camera, soft even studio lighting, one subtle soft shadow directly beneath the product, photorealistic, ultra sharp, high detail. Keep the product small enough in frame that there is generous empty space on every side. No text, no watermark, no hands, no props, no brand logos. Landscape 16:9.`,
      },
      {
        label: "End frame (your product, taken apart):",
        url: `High-end studio product photograph of the same [YOUR PRODUCT] as a clean exploded view: the outer shell or casing lifted apart and every major part and layer separated and floating in an organized, evenly spaced arrangement along one axis, like a technical teardown render. Same straight-on view, same perfectly level camera, same soft even studio lighting, same seamless matte light-grey studio background, one subtle soft shadow beneath. The core body of the product stays in the exact center at the same size, with the parts spreading outward around it. Photorealistic, ultra sharp, high detail. No text, no watermark, no hands, no props, no brand logos. Landscape 16:9.`,
      },
      {
        label: "Final Prompt to make the website",
        url: `Master Prompt – Universal Scroll-Driven Image Sequence Animation\n\nCreate a production-ready, scroll-driven image sequence animation using the image frames from the provided folder.\n\nCore Requirements\n\n- Automatically detect and preload every image frame before the animation begins.\n- Display the frames on an HTML "<canvas>" element.\n- Map the user's scroll position directly to the corresponding frame index so the animation plays smoothly frame-by-frame while scrolling, similar to Apple's premium scroll experiences (such as the AirPods and iPhone product pages).\n- Use GSAP with ScrollTrigger for all scroll interactions.\n- Pin the canvas while the animation is active and release it naturally when the sequence finishes.\n- Synchronize the animation with the user's scroll using smooth scrubbing so there are no jumps, flickering, or stuttering.`,
      },
    ],
  },
  {
    title: "How to make Professional Website.",
    slug: "how-to-make-professional-website",
    shortDesc: "Post Number 2",
    featuredImage: "/images/10k website.jpeg",
    instagramUrl: "https://www.instagram.com/",
    platform: "INSTAGRAM",
    status: "PUBLISHED",
    badge: "WATCH NOW",
    toolLinks: [
      {
        label: "Prompt",
        url: `You are an expert Senior Frontend Engineer, UX Designer, and Full Stack Developer.\n\nI will provide you with a visual effect/component/code snippet. Treat that visual element as the design language and foundation of the website.\n\nYour task is NOT to only recreate the visual effect. Instead, build a complete, production-ready, fully functional website around it while preserving the exact animation quality, interactions, and aesthetics.\n\n## Primary Rules\n\n- Keep the provided visual effect exactly as intended.\n- Do not simplify, replace, or redesign the effect unless absolutely necessary for performance.\n- Build the entire website around this design language.\n- Every section should feel like it belongs to the same design system.\n- The final website should feel premium, modern, smooth, and agency-level.`,
      },
      { label: "Website", url: "https://app.emergent.sh/home" },
    ],
  },
];

// ── Migrate via direct SQL using @neondatabase/serverless ─────────────────────
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

function generateCuid() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `c${timestamp}${random}`;
}

console.log("\n🔄  Starting post migration...\n");

let inserted = 0;
let skipped = 0;

for (const post of posts) {
  // Check if post with this slug already exists
  const existing = await sql`SELECT id FROM "Post" WHERE slug = ${post.slug} LIMIT 1`;

  if (existing.length > 0) {
    console.log(`  ⏭  SKIP  [${post.platform}] "${post.title}" (slug already exists)`);
    skipped++;
    continue;
  }

  const id = generateCuid();
  const contentJson = JSON.stringify({
    toolLinks: post.toolLinks || [],
    badge: post.badge || null,
    comingSoon: post.status === "DRAFT",
  });

  await sql`
    INSERT INTO "Post" (
      id, title, slug, "shortDesc", content,
      "featuredImage", "youtubeUrl", "instagramUrl",
      platform, status, "publishDate", "createdAt", "updatedAt",
      "galleryUrls", "noindex", "nofollow"
    ) VALUES (
      ${id},
      ${post.title},
      ${post.slug},
      ${post.shortDesc || null},
      ${contentJson},
      ${post.featuredImage || null},
      ${post.youtubeUrl || null},
      ${post.instagramUrl || null},
      ${post.platform}::"Platform",
      ${post.status}::"Status",
      NOW(),
      NOW(),
      NOW(),
      '{}',
      false,
      false
    )
  `;

  console.log(`  ✅  INSERT [${post.platform}] "${post.title}"`);
  inserted++;
}

console.log(`\n✅  Migration complete! Inserted: ${inserted}, Skipped: ${skipped}\n`);

// ── Verification query ────────────────────────────────────────────────────────
console.log("📊  Database verification:\n");
const counts = await sql`SELECT platform, status, COUNT(*) as count FROM "Post" GROUP BY platform, status ORDER BY platform, status`;
for (const row of counts) {
  console.log(`  ${row.platform} / ${row.status}: ${row.count} posts`);
}

const total = await sql`SELECT COUNT(*) as count FROM "Post"`;
console.log(`\n  TOTAL: ${total[0].count} posts in database\n`);
