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
  const price = parseInt(formData.get("price") as string) * 100; // convert to paise
  const originalPriceStr = formData.get("originalPrice") as string;
  const originalPrice = originalPriceStr ? parseInt(originalPriceStr) * 100 : null;
  const status = formData.get("status") as any;
  const categoryId = formData.get("categoryId") as string;
  
  // Extract arrays
  const features = (formData.get("features") as string)?.split("\n").filter(Boolean) || [];
  const requirements = (formData.get("requirements") as string)?.split("\n").filter(Boolean) || [];
  const mediaJson = formData.get("mediaItems") as string;
  const mediaItems = mediaJson ? JSON.parse(mediaJson) : [];

  const automation = await prisma.automation.create({
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
      thumbnailUrl: mediaItems.find((m: any) => m.isPrimary)?.url || mediaItems[0]?.url || null,
      media: {
        create: mediaItems.map((m: any, idx: number) => ({
          url: m.url,
          publicId: m.publicId,
          type: m.type || "IMAGE",
          sortOrder: idx,
          isPrimary: m.isPrimary || false
        }))
      }
    }
  });

  revalidatePath("/admin/automations");
  redirect("/admin/automations");
}

export async function updateAutomation(id: string, formData: FormData) {
  await requireAdminSession();

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const shortDesc = formData.get("shortDesc") as string;
  const description = formData.get("description") as string;
  const price = parseInt(formData.get("price") as string) * 100;
  const originalPriceStr = formData.get("originalPrice") as string;
  const originalPrice = originalPriceStr ? parseInt(originalPriceStr) * 100 : null;
  const status = formData.get("status") as any;
  const categoryId = formData.get("categoryId") as string;
  
  const features = (formData.get("features") as string)?.split("\n").filter(Boolean) || [];
  const requirements = (formData.get("requirements") as string)?.split("\n").filter(Boolean) || [];
  const mediaJson = formData.get("mediaItems") as string;
  const mediaItems = mediaJson ? JSON.parse(mediaJson) : [];

  // Transaction: Delete existing media and recreate (simple sync)
  await prisma.$transaction([
    prisma.automationMedia.deleteMany({ where: { automationId: id } }),
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
        thumbnailUrl: mediaItems.find((m: any) => m.isPrimary)?.url || mediaItems[0]?.url || null,
        media: {
          create: mediaItems.map((m: any, idx: number) => ({
            url: m.url,
            publicId: m.publicId,
            type: m.type || "IMAGE",
            sortOrder: idx,
            isPrimary: m.isPrimary || false
          }))
        }
      }
    })
  ]);

  revalidatePath("/admin/automations");
  revalidatePath(`/automations/${slug}`);
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
