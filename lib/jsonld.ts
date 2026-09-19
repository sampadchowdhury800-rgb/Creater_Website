import { siteConfig, getCanonicalUrl, getAbsoluteImageUrl } from "./siteConfig";

export interface FaqItem {
  question: string;
  answer: string;
  sortOrder?: number;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Organization Schema (Chowdhury Duo)
 */
export function getOrganizationSchema(sameAsUrls: string[] = []) {
  const verifiedSameAs = Array.from(
    new Set([
      siteConfig.primaryLinkedIn,
      siteConfig.primaryYouTube,
      siteConfig.primaryInstagram,
      ...sameAsUrls,
    ].filter(Boolean))
  );

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: getAbsoluteImageUrl("/favicon.ico"),
    description: siteConfig.longDescription,
    email: siteConfig.email,
    founder: [
      {
        "@type": "Person",
        "@id": `${siteConfig.url}/#sampad-chowdhury`,
        name: "Sampad Chowdhury",
        jobTitle: siteConfig.founderTitle,
        url: `${siteConfig.url}/resume`,
        sameAs: [siteConfig.primaryLinkedIn],
      },
      {
        "@type": "Person",
        "@id": `${siteConfig.url}/#bharti-shaw`,
        name: "Bharti Shaw",
        jobTitle: "Co-Creator & Creative Artist",
        url: `${siteConfig.url}/bharti-shaw`,
      },
    ],
    sameAs: verifiedSameAs,
  };
}

/**
 * WebSite Schema for Search Action / Site representation
 */
export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.shortDescription,
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
    },
  };
}

/**
 * Person Schema (Sampad Chowdhury / Founders)
 */
export function getPersonSchema(person: {
  name: string;
  title: string;
  bio?: string | null;
  slug: string;
  image?: string | null;
  linkedin?: string | null;
  github?: string | null;
  youtube?: string | null;
  skills?: string[];
}) {
  const sameAs = [
    person.linkedin,
    person.github,
    person.youtube,
  ].filter((s): s is string => Boolean(s));

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteConfig.url}/#${person.slug}`,
    name: person.name,
    jobTitle: person.title,
    description: person.bio || siteConfig.shortDescription,
    url: getCanonicalUrl(person.slug === "sampad-chowdhury" ? "/resume" : `/people/${person.slug}`),
    image: getAbsoluteImageUrl(person.image),
    worksFor: {
      "@id": `${siteConfig.url}/#organization`,
    },
    sameAs,
    knowsAbout: person.skills || [
      "Full-Stack Web Development",
      "Business Workflow Automation",
      "AI Chatbot Engineering",
      "SaaS Product Engineering",
      "Backend Architecture",
      "DevOps",
    ],
  };
}

/**
 * Service Schema
 */
export function getServiceSchema(service: {
  name: string;
  slug: string;
  shortDesc?: string | null;
  fullDesc?: string | null;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${siteConfig.url}/services/${service.slug}#service`,
    name: service.name,
    description: service.shortDesc || service.fullDesc || service.name,
    url: getCanonicalUrl(`/services/${service.slug}`),
    provider: {
      "@id": `${siteConfig.url}/#organization`,
    },
    serviceType: service.name,
    image: getAbsoluteImageUrl(service.image),
  };
}

/**
 * CreativeWork / SoftwareApplication Schema for Projects
 */
export function getProjectSchema(project: {
  title: string;
  slug: string;
  shortDesc?: string | null;
  fullDesc?: string | null;
  technologies?: string[];
  demoUrl?: string | null;
  githubUrl?: string | null;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    "@id": `${siteConfig.url}/projects/${project.slug}#project`,
    name: project.title,
    description: project.shortDesc || project.fullDesc || project.title,
    url: getCanonicalUrl(`/projects/${project.slug}`),
    author: {
      "@id": `${siteConfig.url}/#sampad-chowdhury`,
    },
    programmingLanguage: project.technologies || [],
    codeRepository: project.githubUrl || undefined,
    image: getAbsoluteImageUrl(project.image),
  };
}

/**
 * Article Schema for Posts
 */
export function getArticleSchema(post: {
  title: string;
  slug: string;
  shortDesc?: string | null;
  content?: string | null;
  image?: string | null;
  publishDate?: Date | string | null;
  updatedAt?: Date | string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${siteConfig.url}/posts/${post.slug}#article`,
    headline: post.title,
    description: post.shortDesc || post.title,
    url: getCanonicalUrl(`/posts/${post.slug}`),
    image: getAbsoluteImageUrl(post.image),
    datePublished: post.publishDate ? new Date(post.publishDate).toISOString() : new Date().toISOString(),
    dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date().toISOString(),
    author: {
      "@id": `${siteConfig.url}/#sampad-chowdhury`,
    },
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": getCanonicalUrl(`/posts/${post.slug}`),
    },
  };
}

/**
 * Product Schema for Automations (Authentic only - no fake aggregateRating)
 */
export function getProductSchema(automation: {
  title: string;
  slug: string;
  shortDesc?: string | null;
  price: number; // in paise
  currency?: string;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteConfig.url}/automations/${automation.slug}#product`,
    name: automation.title,
    description: automation.shortDesc || automation.title,
    image: getAbsoluteImageUrl(automation.image),
    offers: {
      "@type": "Offer",
      url: getCanonicalUrl(`/automations/${automation.slug}`),
      priceCurrency: automation.currency || "INR",
      price: (automation.price / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      seller: {
        "@id": `${siteConfig.url}/#organization`,
      },
    },
  };
}

/**
 * FAQPage Schema (Only generates when visible FAQ content exists)
 */
export function getFaqPageSchema(faqs: FaqItem[]) {
  if (!faqs || faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

/**
 * BreadcrumbList Schema
 */
export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.url),
    })),
  };
}
