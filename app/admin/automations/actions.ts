"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createAutomation(formData: FormData) {
  await requireAdminSession();

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const shortDesc = formData.get("shortDesc") as string;
  const description = formData.get("description") as string;
  const price = parseInt(formData.get("price") as string, 10) * 100; // convert to paise
  const originalPriceStr = formData.get("originalPrice") as string;
  const originalPrice = originalPriceStr ? parseInt(originalPriceStr, 10) * 100 : null;
  const status = formData.get("status") as any;
  const categoryId = formData.get("categoryId") as string;

  // Extract arrays
  const features = (formData.get("features") as string)?.split("\n").filter(Boolean) || [];
  const requirements = (formData.get("requirements") as string)?.split("\n").filter(Boolean) || [];
  const integrations = (formData.get("integrations") as string)?.split("\n").filter(Boolean) || [];
  const pricingType = (formData.get("pricingType") as any) || "ONE_TIME";
  const featured = formData.get("featured") === "true";
  const mediaJson = formData.get("mediaItems") as string;
  const mediaItems = mediaJson ? JSON.parse(mediaJson) : [];
  const filesJson = formData.get("downloadableFiles") as string;
  const downloadableFiles = filesJson ? JSON.parse(filesJson) : [];
  const faqsJson = formData.get("faqs") as string;
  const faqs = faqsJson ? JSON.parse(faqsJson) : [];

  const seoTitle = (formData.get("seoTitle") as string) || null;
  const seoDescription = (formData.get("seoDescription") as string) || null;
  const ogImage = (formData.get("ogImage") as string) || null;
  const directAnswer = (formData.get("directAnswer") as string) || null;
  const primaryTopic = (formData.get("primaryTopic") as string) || null;
  const searchIntent = (formData.get("searchIntent") as string) || null;

  await prisma.automation.create({
    data: {
      title,
      slug,
      shortDesc,
      description,
      price,
      originalPrice,
      status,
      categoryId: categoryId || null,
      features,
      requirements,
      integrations,
      pricingType,
      featured,
      seoTitle,
      seoDescription,
      ogImage,
      directAnswer,
      primaryTopic,
      searchIntent,
      faqs,
      thumbnailUrl: mediaItems.find((m: any) => m.isPrimary)?.url || mediaItems[0]?.url || null,
      media: {
        create: mediaItems.map((m: any, idx: number) => ({
          url: m.url,
          publicId: m.publicId,
          type: m.type || "IMAGE",
          sortOrder: idx,
          isPrimary: m.isPrimary || false,
        })),
      },
      files: {
        create: downloadableFiles.map((f: any, idx: number) => ({
          title: f.title || f.fileName,
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          publicId: f.publicId,
          fileSize: f.fileSize || null,
          fileType: f.fileType || null,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath("/admin/automations");
  revalidatePath("/automations");
  revalidatePath("/my-automations");
  redirect("/admin/automations");
}

export async function updateAutomation(id: string, formData: FormData) {
  await requireAdminSession();

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const shortDesc = formData.get("shortDesc") as string;
  const description = formData.get("description") as string;
  const price = parseInt(formData.get("price") as string, 10) * 100;
  const originalPriceStr = formData.get("originalPrice") as string;
  const originalPrice = originalPriceStr ? parseInt(originalPriceStr, 10) * 100 : null;
  const status = formData.get("status") as any;
  const categoryId = formData.get("categoryId") as string;

  const features = (formData.get("features") as string)?.split("\n").filter(Boolean) || [];
  const requirements = (formData.get("requirements") as string)?.split("\n").filter(Boolean) || [];
  const integrations = (formData.get("integrations") as string)?.split("\n").filter(Boolean) || [];
  const pricingType = (formData.get("pricingType") as any) || "ONE_TIME";
  const featured = formData.get("featured") === "true";
  const mediaJson = formData.get("mediaItems") as string;
  const mediaItems = mediaJson ? JSON.parse(mediaJson) : [];
  const filesJson = formData.get("downloadableFiles") as string;
  const downloadableFiles = filesJson ? JSON.parse(filesJson) : [];
  const faqsJson = formData.get("faqs") as string;
  const faqs = faqsJson ? JSON.parse(faqsJson) : [];

  const seoTitle = (formData.get("seoTitle") as string) || null;
  const seoDescription = (formData.get("seoDescription") as string) || null;
  const ogImage = (formData.get("ogImage") as string) || null;
  const directAnswer = (formData.get("directAnswer") as string) || null;
  const primaryTopic = (formData.get("primaryTopic") as string) || null;
  const searchIntent = (formData.get("searchIntent") as string) || null;

  // Transaction: Sync media and files
  await prisma.$transaction([
    prisma.automationMedia.deleteMany({ where: { automationId: id } }),
    prisma.automationFile.deleteMany({ where: { automationId: id } }),
    prisma.automation.update({
      where: { id },
      data: {
        title,
        slug,
        shortDesc,
        description,
        price,
        originalPrice,
        status,
        categoryId: categoryId || null,
        features,
        requirements,
        integrations,
        pricingType,
        featured,
        seoTitle,
        seoDescription,
        ogImage,
        directAnswer,
        primaryTopic,
        searchIntent,
        faqs,
        thumbnailUrl: mediaItems.find((m: any) => m.isPrimary)?.url || mediaItems[0]?.url || null,
        media: {
          create: mediaItems.map((m: any, idx: number) => ({
            url: m.url,
            publicId: m.publicId,
            type: m.type || "IMAGE",
            sortOrder: idx,
            isPrimary: m.isPrimary || false,
          })),
        },
        files: {
          create: downloadableFiles.map((f: any, idx: number) => ({
            title: f.title || f.fileName,
            fileName: f.fileName,
            fileUrl: f.fileUrl,
            publicId: f.publicId,
            fileSize: f.fileSize || null,
            fileType: f.fileType || null,
            sortOrder: idx,
          })),
        },
      },
    }),
  ]);


  revalidatePath("/admin/automations");
  revalidatePath(`/automations/${slug}`);
  revalidatePath("/automations");
  revalidatePath("/my-automations");
  redirect("/admin/automations");
}

export async function deleteAutomation(id: string) {
  await requireAdminSession();

  const automation = await prisma.automation.findUnique({ where: { id } });

  if (automation) {
    await prisma.automation.delete({ where: { id } });
    revalidatePath("/admin/automations");
    revalidatePath("/automations");
  }
}
