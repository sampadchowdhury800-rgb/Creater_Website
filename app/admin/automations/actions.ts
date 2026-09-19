"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { validateConfigSchemaDefinition, type ConfigSchema } from "@/lib/automation/validation";
import { validateIntegrationRequirements } from "@/lib/integrations/requirements-validator";
import type { AutomationIntegrationRequirements } from "@/lib/integrations/types";

// ─── Slug sanitization ────────────────────────────────────────────────────────
// Converts a raw string to a valid URL slug.
// Removes leading/trailing hyphens, collapses repeated hyphens.
function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Validation Schema ────────────────────────────────────────────────────────

const AUTOMATION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const PRICING_TYPES = ["ONE_TIME", "SUBSCRIPTION", "FREE"] as const;

const AutomationSchema = z
  .object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200, "Title too long"),
    slug: z.string().min(2, "Slug must be at least 2 characters").max(120, "Slug too long"),
    shortDesc: z.string().max(500, "Short description too long").optional(),
    description: z.string().max(50000).optional(),
    price: z
      .number()
      .int("Price must be a whole number")
      .min(0, "Price cannot be negative"),
    originalPrice: z.number().int().min(0).nullable().optional(),
    pricingType: z.enum(PRICING_TYPES, { message: "Invalid pricing type" }),
    status: z.enum(AUTOMATION_STATUSES, { message: "Invalid status" }),
    categoryId: z.string().nullable().optional(),
    featured: z.boolean(),
    n8nWorkflowId: z.string().nullable().optional(),
    isExecutable: z.boolean(),
    // Arrays stored as newline-delimited strings from the form
    features: z.array(z.string()).default([]),
    requirements: z.array(z.string()).default([]),
    integrations: z.array(z.string()).default([]),
    // SEO fields
    seoTitle: z.string().max(200).nullable().optional(),
    seoDescription: z.string().max(500).nullable().optional(),
    ogImage: z.string().max(1000).nullable().optional(),
    directAnswer: z.string().max(5000).nullable().optional(),
    primaryTopic: z.string().max(200).nullable().optional(),
    searchIntent: z.string().max(200).nullable().optional(),
    // JSON fields — already parsed before validation
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
    mediaItems: z
      .array(
        z.object({
          url: z.string().url("Invalid media URL"),
          publicId: z.string().min(1),
          type: z.enum(["IMAGE", "VIDEO"]),
          isPrimary: z.boolean(),
        })
      )
      .default([]),
    downloadableFiles: z
      .array(
        z.object({
          title: z.string().min(1),
          fileName: z.string().min(1),
          fileUrl: z.string().url("Invalid file URL"),
          publicId: z.string().min(1),
          fileSize: z.number().nullable().optional(),
          fileType: z.string().nullable().optional(),
        })
      )
      .default([]),
    configSchema: z.custom<ConfigSchema>().nullable().optional(),
    integrationRequirements: z.custom<AutomationIntegrationRequirements>().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Publishing guardrail: PUBLISHED requires title, slug, and valid price
    if (data.status === "PUBLISHED") {
      if (!data.title || data.title.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Title is required before publishing.",
          path: ["title"],
        });
      }
      if (!data.slug || data.slug.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slug is required before publishing.",
          path: ["slug"],
        });
      }
      if (data.pricingType !== "FREE" && data.price <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A valid price is required before publishing (or set pricing type to FREE).",
          path: ["price"],
        });
      }
    }

    // Executable guardrail: isExecutable=true + PUBLISHED requires n8nWorkflowId
    if (data.isExecutable && data.status === "PUBLISHED" && !data.n8nWorkflowId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "An n8n Workflow ID is required to publish an executable automation. Either add the workflow ID or uncheck 'Allow users to execute this automation'.",
        path: ["n8nWorkflowId"],
      });
    }

    // ConfigSchema validation: validate structure, keys, types, options
    if (data.configSchema) {
      const schemaCheck = validateConfigSchemaDefinition(data.configSchema);
      if (!schemaCheck.valid) {
        for (const err of schemaCheck.errors) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Configuration Schema: ${err}`,
            path: ["configSchema"],
          });
        }
      }
    }

    // Integration Requirements validation: capabilities, allowed providers, no raw scopes
    if (data.integrationRequirements) {
      const intCheck = validateIntegrationRequirements(data.integrationRequirements);
      if (!intCheck.valid) {
        for (const err of intCheck.errors) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Integration Requirements: ${err}`,
            path: ["integrationRequirements"],
          });
        }
      }
    }
  });

// ─── Parse FormData into a structured object ──────────────────────────────────

function parseFormData(formData: FormData) {
  const rawPrice = formData.get("price") as string;
  const rawOriginalPrice = formData.get("originalPrice") as string;

  // Price is entered in INR in the form, stored in paise
  const priceINR = rawPrice ? parseFloat(rawPrice) : 0;
  const originalPriceINR = rawOriginalPrice ? parseFloat(rawOriginalPrice) : null;

  const rawSlug = formData.get("slug") as string;

  let faqs: unknown[] = [];
  try {
    const faqsJson = formData.get("faqs") as string;
    faqs = faqsJson ? JSON.parse(faqsJson) : [];
  } catch {
    // silently default to empty
  }

  let mediaItems: unknown[] = [];
  try {
    const mediaJson = formData.get("mediaItems") as string;
    mediaItems = mediaJson ? JSON.parse(mediaJson) : [];
  } catch {
    // silently default to empty
  }

  let downloadableFiles: unknown[] = [];
  try {
    const filesJson = formData.get("downloadableFiles") as string;
    downloadableFiles = filesJson ? JSON.parse(filesJson) : [];
  } catch {
    // silently default to empty
  }

  let configSchema: ConfigSchema | null = null;
  const configSchemaRaw = formData.get("configSchema") as string;
  if (configSchemaRaw && configSchemaRaw.trim()) {
    try {
      configSchema = JSON.parse(configSchemaRaw);
    } catch {
      configSchema = configSchemaRaw as any;
    }
  }

  let integrationRequirements: AutomationIntegrationRequirements | null = null;
  const intReqRaw = formData.get("integrationRequirements") as string;
  if (intReqRaw && intReqRaw.trim()) {
    try {
      integrationRequirements = JSON.parse(intReqRaw);
    } catch {
      integrationRequirements = intReqRaw as any;
    }
  }

  return {
    title: (formData.get("title") as string) || "",
    slug: sanitizeSlug(rawSlug || ""),
    shortDesc: (formData.get("shortDesc") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    price: Math.round(priceINR * 100), // convert INR → paise
    originalPrice: originalPriceINR !== null ? Math.round(originalPriceINR * 100) : null,
    pricingType: (formData.get("pricingType") as string) || "ONE_TIME",
    status: (formData.get("status") as string) || "DRAFT",
    categoryId: (formData.get("categoryId") as string) || null,
    featured: formData.get("featured") === "true",
    n8nWorkflowId: (formData.get("n8nWorkflowId") as string) || null,
    isExecutable: formData.has("isExecutable") ? formData.get("isExecutable") === "true" : false,
    configSchema,
    integrationRequirements,
    features: (formData.get("features") as string)?.split("\n").filter(Boolean) ?? [],
    requirements: (formData.get("requirements") as string)?.split("\n").filter(Boolean) ?? [],
    integrations: (formData.get("integrations") as string)?.split("\n").filter(Boolean) ?? [],
    seoTitle: (formData.get("seoTitle") as string) || null,
    seoDescription: (formData.get("seoDescription") as string) || null,
    ogImage: (formData.get("ogImage") as string) || null,
    directAnswer: (formData.get("directAnswer") as string) || null,
    primaryTopic: (formData.get("primaryTopic") as string) || null,
    searchIntent: (formData.get("searchIntent") as string) || null,
    faqs,
    mediaItems,
    downloadableFiles,
  };
}

// ─── Format validation errors into a readable string ─────────────────────────

function formatZodErrors(issues: z.ZodIssue[]): string {
  return issues.map((i) => i.message).join(". ");
}

// ─── CREATE AUTOMATION ────────────────────────────────────────────────────────

export async function createAutomation(formData: FormData) {
  await requireAdminSession();

  const parsed = parseFormData(formData);
  const result = AutomationSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(formatZodErrors(result.error.issues));
  }

  const data = result.data;

  // Validate slug uniqueness before writing
  const existing = await prisma.automation.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new Error(
      `A slug "${data.slug}" already exists. Please use a different slug.`
    );
  }

  const thumbnailUrl =
    data.mediaItems.find((m) => m.isPrimary)?.url ?? data.mediaItems[0]?.url ?? null;

  await prisma.automation.create({
    data: {
      title: data.title,
      slug: data.slug,
      shortDesc: data.shortDesc ?? null,
      description: data.description ?? null,
      price: data.price,
      originalPrice: data.originalPrice ?? null,
      status: data.status,
      categoryId: data.categoryId || null,
      features: data.features,
      requirements: data.requirements,
      integrations: data.integrations,
      pricingType: data.pricingType,
      featured: data.featured,
      n8nWorkflowId: data.n8nWorkflowId,
      isExecutable: data.isExecutable,
      configSchema: data.configSchema && data.configSchema.fields.length > 0 ? (data.configSchema as any) : null,
      integrationRequirements: data.integrationRequirements && data.integrationRequirements.requirements?.length > 0 ? (data.integrationRequirements as any) : null,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      ogImage: data.ogImage ?? null,
      directAnswer: data.directAnswer ?? null,
      primaryTopic: data.primaryTopic ?? null,
      searchIntent: data.searchIntent ?? null,
      faqs: data.faqs.length > 0 ? data.faqs : undefined,
      thumbnailUrl,
      media: {
        create: data.mediaItems.map((m, idx) => ({
          url: m.url,
          publicId: m.publicId,
          type: m.type,
          sortOrder: idx,
          isPrimary: m.isPrimary,
        })),
      },
      files: {
        create: data.downloadableFiles.map((f, idx) => ({
          title: f.title,
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          publicId: f.publicId,
          fileSize: f.fileSize ?? null,
          fileType: f.fileType ?? null,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath("/admin/automations");
  revalidatePath("/automations");
  redirect("/admin/automations");
}

// ─── UPDATE AUTOMATION ────────────────────────────────────────────────────────

export async function updateAutomation(id: string, formData: FormData) {
  await requireAdminSession();

  if (!id) throw new Error("Automation ID is required.");

  const parsed = parseFormData(formData);
  const result = AutomationSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(formatZodErrors(result.error.issues));
  }

  const data = result.data;

  // Validate slug uniqueness — allow same slug for this automation, block conflicts with others
  const existing = await prisma.automation.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== id) {
    throw new Error(
      `A slug "${data.slug}" is already in use by another automation. Please choose a different slug.`
    );
  }

  const thumbnailUrl =
    data.mediaItems.find((m) => m.isPrimary)?.url ?? data.mediaItems[0]?.url ?? null;

  // Transaction: delete old media/files, then update automation
  await prisma.$transaction([
    prisma.automationMedia.deleteMany({ where: { automationId: id } }),
    prisma.automationFile.deleteMany({ where: { automationId: id } }),
    prisma.automation.update({
      where: { id },
      data: {
        title: data.title,
        slug: data.slug,
        shortDesc: data.shortDesc ?? null,
        description: data.description ?? null,
        price: data.price,
        originalPrice: data.originalPrice ?? null,
        status: data.status,
        categoryId: data.categoryId || null,
        features: data.features,
        requirements: data.requirements,
        integrations: data.integrations,
        pricingType: data.pricingType,
        featured: data.featured,
        n8nWorkflowId: data.n8nWorkflowId,
        isExecutable: data.isExecutable,
        configSchema: data.configSchema && data.configSchema.fields.length > 0 ? (data.configSchema as any) : null,
        integrationRequirements: data.integrationRequirements && data.integrationRequirements.requirements?.length > 0 ? (data.integrationRequirements as any) : null,
        seoTitle: data.seoTitle ?? null,
        seoDescription: data.seoDescription ?? null,
        ogImage: data.ogImage ?? null,
        directAnswer: data.directAnswer ?? null,
        primaryTopic: data.primaryTopic ?? null,
        searchIntent: data.searchIntent ?? null,
        faqs: data.faqs.length > 0 ? data.faqs : undefined,
        thumbnailUrl,
        media: {
          create: data.mediaItems.map((m, idx) => ({
            url: m.url,
            publicId: m.publicId,
            type: m.type,
            sortOrder: idx,
            isPrimary: m.isPrimary,
          })),
        },
        files: {
          create: data.downloadableFiles.map((f, idx) => ({
            title: f.title,
            fileName: f.fileName,
            fileUrl: f.fileUrl,
            publicId: f.publicId,
            fileSize: f.fileSize ?? null,
            fileType: f.fileType ?? null,
            sortOrder: idx,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/admin/automations");
  revalidatePath(`/automations/${data.slug}`);
  revalidatePath("/automations");
  revalidatePath("/my-automations");
  redirect("/admin/automations");
}

// ─── DELETE AUTOMATION ────────────────────────────────────────────────────────

export async function deleteAutomation(id: string) {
  await requireAdminSession();

  if (!id) throw new Error("Automation ID is required.");

  const automation = await prisma.automation.findUnique({ where: { id } });

  if (automation) {
    await prisma.automation.delete({ where: { id } });
    revalidatePath("/admin/automations");
    revalidatePath("/automations");
  }
}
