/**
 * Centralized Site Configuration
 * Ensures canonical domain, brand identity, and social links are managed in one place.
 * Never hardcode domain URLs across pages.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://chowdhuryduo.vercel.app"
).replace(/\/+$/, "");

export const siteConfig = {
  name: "Chowdhury Duo",
  tagline: "AI, Automation, Full-Stack Development & Digital Engineering",
  shortDescription:
    "Official portfolio and solutions hub of Chowdhury Duo — Full-stack web engineering, intelligent business automations, SaaS architectures, and digital media.",
  longDescription:
    "Chowdhury Duo specializes in end-to-end full-stack web development, AI customer support and automated workflow pipelines, scalable backend infrastructures, and algorithmic business solutions founded by Sampad Chowdhury.",
  url: SITE_URL,
  founder: "Sampad Chowdhury",
  coFounder: "Bharti Shaw",
  founderTitle: "Entrepreneur | Full Stack Developer | Automation Specialist",
  email: "sampadchowdhury777@gmail.com",
  location: "India",
  primaryLinkedIn: "https://www.linkedin.com/in/sampad-chowdhury-321812317",
  primaryYouTube: "https://youtube.com/@chowdhuryduo",
  primaryInstagram: "https://www.instagram.com/chowdhury_duo",
  defaultOgImage: `${SITE_URL}/favicon.ico`,
};

/**
 * Builds a strict canonical URL for any route or path.
 */
export function getCanonicalUrl(path: string = ""): string {
  if (!path) return SITE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

/**
 * Ensures an image URL is absolute (required for OpenGraph & Twitter cards).
 */
export function getAbsoluteImageUrl(imagePath?: string | null): string {
  if (!imagePath) return `${SITE_URL}/favicon.ico`;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${SITE_URL}${cleanPath}`;
}
