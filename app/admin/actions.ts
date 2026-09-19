"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────────────────────────────────

type PostInput = {
  title: string;
  slug?: string;
  shortDesc?: string;
  content?: string;
  featuredImage?: string;
  galleryUrls?: string[];
  videoUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  platform: "INSTAGRAM" | "YOUTUBE";
  publishDate?: string;
  status?: "DRAFT" | "PUBLISHED";
  
  // SEO & AEO
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  keywords?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  noindex?: boolean;
  nofollow?: boolean;
  readingTime?: number;
  directAnswer?: string;
  searchIntent?: string;
  primaryTopic?: string;
  faqs?: any;

  // Relations
  tagIds?: string[];
  categoryIds?: string[];
};

export async function createPost(data: PostInput) {
  await requireAdminSession();

  const slug = data.slug || generateSlug(data.title);

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      shortDesc: data.shortDesc,
      content: data.content,
      featuredImage: data.featuredImage,
      galleryUrls: data.galleryUrls || [],
      videoUrl: data.videoUrl,
      instagramUrl: data.instagramUrl,
      youtubeUrl: data.youtubeUrl,
      platform: data.platform,
      publishDate: data.publishDate ? new Date(data.publishDate) : undefined,
      status: data.status,
      
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      canonicalUrl: data.canonicalUrl,
      keywords: data.keywords,
      ogImage: data.ogImage,
      ogTitle: data.ogTitle,
      ogDescription: data.ogDescription,
      twitterImage: data.twitterImage,
      twitterTitle: data.twitterTitle,
      twitterDescription: data.twitterDescription,
      noindex: data.noindex,
      nofollow: data.nofollow,
      readingTime: data.readingTime,
      directAnswer: data.directAnswer,
      searchIntent: data.searchIntent,
      primaryTopic: data.primaryTopic,
      faqs: data.faqs,
      
      tags: data.tagIds ? { connect: data.tagIds.map(id => ({ id })) } : undefined,
      categories: data.categoryIds ? { connect: data.categoryIds.map(id => ({ id })) } : undefined,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");

  return { success: true, post };
}

export async function updatePost(id: string, data: Partial<PostInput>) {
  await requireAdminSession();

  const post = await prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      slug: data.slug,
      shortDesc: data.shortDesc,
      content: data.content,
      featuredImage: data.featuredImage,
      galleryUrls: data.galleryUrls || [],
      videoUrl: data.videoUrl,
      instagramUrl: data.instagramUrl,
      youtubeUrl: data.youtubeUrl,
      platform: data.platform,
      publishDate: data.publishDate ? new Date(data.publishDate) : undefined,
      status: data.status,
      
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      canonicalUrl: data.canonicalUrl,
      keywords: data.keywords,
      ogImage: data.ogImage,
      ogTitle: data.ogTitle,
      ogDescription: data.ogDescription,
      twitterImage: data.twitterImage,
      twitterTitle: data.twitterTitle,
      twitterDescription: data.twitterDescription,
      noindex: data.noindex,
      nofollow: data.nofollow,
      readingTime: data.readingTime,
      directAnswer: data.directAnswer,
      searchIntent: data.searchIntent,
      primaryTopic: data.primaryTopic,
      faqs: data.faqs,
      
      tags: data.tagIds !== undefined ? { set: data.tagIds.map(id => ({ id })) } : undefined,
      categories: data.categoryIds !== undefined ? { set: data.categoryIds.map(id => ({ id })) } : undefined,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");

  return { success: true, post };
}

export async function deletePost(id: string) {
  await requireAdminSession();
  await prisma.post.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");
  return { success: true };
}

export async function togglePostStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  await requireAdminSession();
  await prisma.post.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/instagram");
  revalidatePath("/youtube");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────────────────

type ServiceInput = {
  name: string;
  slug?: string;
  shortDesc?: string;
  fullDesc?: string;
  category?: string;
  features?: string[];
  technologies?: string[];
  useCases?: string[];
  icon?: string;
  coverImage?: string;
  sortOrder?: number;
  status?: "DRAFT" | "PUBLISHED";
  directAnswer?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  faqs?: any;
};

export async function createService(data: ServiceInput) {
  await requireAdminSession();

  const slug = data.slug || generateSlug(data.name);

  const service = await prisma.service.create({
    data: {
      name: data.name,
      slug,
      shortDesc: data.shortDesc,
      fullDesc: data.fullDesc,
      category: data.category,
      features: data.features || [],
      technologies: data.technologies || [],
      useCases: data.useCases || [],
      icon: data.icon,
      coverImage: data.coverImage,
      sortOrder: data.sortOrder || 0,
      status: data.status || "PUBLISHED",
      directAnswer: data.directAnswer,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImage: data.ogImage,
      faqs: data.faqs,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/services");
  revalidatePath(`/services/${slug}`);
  revalidatePath("/admin/services");

  return { success: true, service };
}

export async function updateService(id: string, data: Partial<ServiceInput>) {
  await requireAdminSession();

  const service = await prisma.service.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      shortDesc: data.shortDesc,
      fullDesc: data.fullDesc,
      category: data.category,
      features: data.features,
      technologies: data.technologies,
      useCases: data.useCases,
      icon: data.icon,
      coverImage: data.coverImage,
      sortOrder: data.sortOrder,
      status: data.status,
      directAnswer: data.directAnswer,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImage: data.ogImage,
      faqs: data.faqs,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/services");
  revalidatePath(`/services/${service.slug}`);
  revalidatePath("/admin/services");

  return { success: true, service };
}

export async function deleteService(id: string) {
  await requireAdminSession();
  await prisma.service.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/services");
  revalidatePath("/admin/services");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

type ProjectInput = {
  title: string;
  slug?: string;
  shortDesc?: string;
  fullDesc?: string;
  client?: string;
  role?: string;
  technologies?: string[];
  problem?: string;
  solution?: string;
  result?: string;
  images?: string[];
  videoUrl?: string;
  demoUrl?: string;
  githubUrl?: string;
  sortOrder?: number;
  status?: "DRAFT" | "PUBLISHED";
  directAnswer?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  faqs?: any;
};

export async function createProject(data: ProjectInput) {
  await requireAdminSession();

  const slug = data.slug || generateSlug(data.title);

  const project = await prisma.project.create({
    data: {
      title: data.title,
      slug,
      shortDesc: data.shortDesc,
      fullDesc: data.fullDesc,
      client: data.client,
      role: data.role,
      technologies: data.technologies || [],
      problem: data.problem,
      solution: data.solution,
      result: data.result,
      images: data.images || [],
      videoUrl: data.videoUrl,
      demoUrl: data.demoUrl,
      githubUrl: data.githubUrl,
      sortOrder: data.sortOrder || 0,
      status: data.status || "PUBLISHED",
      directAnswer: data.directAnswer,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImage: data.ogImage,
      faqs: data.faqs,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/admin/projects");

  return { success: true, project };
}

export async function updateProject(id: string, data: Partial<ProjectInput>) {
  await requireAdminSession();

  const project = await prisma.project.update({
    where: { id },
    data: {
      title: data.title,
      slug: data.slug,
      shortDesc: data.shortDesc,
      fullDesc: data.fullDesc,
      client: data.client,
      role: data.role,
      technologies: data.technologies,
      problem: data.problem,
      solution: data.solution,
      result: data.result,
      images: data.images,
      videoUrl: data.videoUrl,
      demoUrl: data.demoUrl,
      githubUrl: data.githubUrl,
      sortOrder: data.sortOrder,
      status: data.status,
      directAnswer: data.directAnswer,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImage: data.ogImage,
      faqs: data.faqs,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath("/admin/projects");

  return { success: true, project };
}

export async function deleteProject(id: string) {
  await requireAdminSession();
  await prisma.project.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath("/admin/projects");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE / FOUNDERS
// ─────────────────────────────────────────────────────────────────────────────

type PersonInput = {
  name: string;
  slug?: string;
  title: string;
  shortBio?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  youtube?: string;
  instagram?: string;
  website?: string;
  education?: any;
  experience?: any;
  skills?: string[];
  achievements?: string[];
  isFounder?: boolean;
  sortOrder?: number;
};

export async function createPerson(data: PersonInput) {
  await requireAdminSession();

  const slug = data.slug || generateSlug(data.name);

  const person = await prisma.person.create({
    data: {
      name: data.name,
      slug,
      title: data.title,
      shortBio: data.shortBio,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
      email: data.email,
      location: data.location,
      linkedin: data.linkedin,
      github: data.github,
      youtube: data.youtube,
      instagram: data.instagram,
      website: data.website,
      education: data.education,
      experience: data.experience,
      skills: data.skills || [],
      achievements: data.achievements || [],
      isFounder: data.isFounder ?? true,
      sortOrder: data.sortOrder || 0,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/about");
  revalidatePath("/resume");
  revalidatePath("/admin/people");

  return { success: true, person };
}

export async function updatePerson(id: string, data: Partial<PersonInput>) {
  await requireAdminSession();

  const person = await prisma.person.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      title: data.title,
      shortBio: data.shortBio,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
      email: data.email,
      location: data.location,
      linkedin: data.linkedin,
      github: data.github,
      youtube: data.youtube,
      instagram: data.instagram,
      website: data.website,
      education: data.education,
      experience: data.experience,
      skills: data.skills,
      achievements: data.achievements,
      isFounder: data.isFounder,
      sortOrder: data.sortOrder,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/about");
  revalidatePath("/resume");
  revalidatePath("/admin/people");

  return { success: true, person };
}

export async function deletePerson(id: string) {
  await requireAdminSession();
  await prisma.person.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/about");
  revalidatePath("/resume");
  revalidatePath("/admin/people");
  return { success: true };
}
