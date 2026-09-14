/**
 * Server-only utility for secure retrieval and streaming of protected automation deliverables.
 *
 * ARCHITECTURE:
 * - The browser NEVER receives raw Cloudinary URLs for protected deliverables.
 * - This module verifies storage metadata and generates time-limited server-side signatures
 *   for Cloudinary assets with type: "authenticated".
 * - Legacy automation deliverables may still use historical public Cloudinary delivery.
 *   They are intentionally not destructively migrated by this remediation, but are proxied
 *   through this server-only layer so raw storage URLs are never exposed to the client.
 *
 * SECURITY:
 * - Server-only: Cloudinary API secrets and keys never leak to client bundles.
 * - Responses are tagged with "private, no-store" cache control.
 */

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export interface StorageDeliverableFile {
  id: string;
  title?: string | null;
  fileName: string;
  fileUrl: string;
  publicId: string;
  fileType?: string | null;
  fileSize?: number | null;
}

/**
 * Parses the Cloudinary resource_type and delivery_type from a Cloudinary secure_url.
 * Typical format: https://res.cloudinary.com/<cloud>/<resource_type>/<delivery_type>/v<version>/<public_id>.<ext>
 */
export function parseCloudinaryUrl(fileUrl: string): {
  resourceType: "raw" | "image" | "video";
  deliveryType: "authenticated" | "upload" | "private";
} {
  try {
    const parsed = new URL(fileUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    // Format: [<cloudName>, <resourceType>, <deliveryType>, ...]
    if (parts.length >= 3) {
      const resourceTypeCandidate = parts[1].toLowerCase();
      const deliveryTypeCandidate = parts[2].toLowerCase();

      const resourceType: "raw" | "image" | "video" =
        resourceTypeCandidate === "image" || resourceTypeCandidate === "video"
          ? resourceTypeCandidate
          : "raw";

      const deliveryType: "authenticated" | "upload" | "private" =
        deliveryTypeCandidate === "authenticated" || deliveryTypeCandidate === "private"
          ? deliveryTypeCandidate
          : "upload";

      return { resourceType, deliveryType };
    }
  } catch {
    // Fall back to safe defaults if URL cannot be parsed
  }

  return { resourceType: "raw", deliveryType: "authenticated" };
}

/**
 * Generates an authenticated signed URL for downloading a protected Cloudinary deliverable.
 */
export function generateSignedDownloadUrl(
  publicId: string,
  resourceType: "raw" | "image" | "video",
  deliveryType: "authenticated" | "upload" | "private",
  format?: string
): string {
  // Legacy public assets can be fetched directly or via signed URL
  if (deliveryType === "upload") {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "upload",
      secure: true,
    });
  }

  // Generate a signed URL valid for 300 seconds (5 minutes) for the server-side fetch
  const expiresAt = Math.floor(Date.now() / 1000) + 300;

  // Use private_download_url from Cloudinary utils for authenticated delivery
  const signedUrl = cloudinary.utils.private_download_url(
    publicId,
    format || "",
    {
      resource_type: resourceType,
      type: deliveryType,
      expires_at: expiresAt,
    }
  );

  return signedUrl;
}

/**
 * Retrieves a protected deliverable file server-side and streams it to the client
 * with strict privacy and attachment headers.
 */
export async function streamProtectedDeliverable(
  file: StorageDeliverableFile
): Promise<NextResponse> {
  const { resourceType, deliveryType } = parseCloudinaryUrl(file.fileUrl);

  // Determine file extension for signing if available
  const ext = file.fileName?.includes(".")
    ? file.fileName.split(".").pop()?.toLowerCase()
    : undefined;

  let downloadUrl: string;

  if (deliveryType === "authenticated" || deliveryType === "private") {
    // Generate server-side signed URL
    downloadUrl = generateSignedDownloadUrl(file.publicId, resourceType, deliveryType, ext);
  } else {
    // Legacy public assets: fetch from stored URL server-side without exposing to browser
    downloadUrl = file.fileUrl;
  }

  let storageRes: Response;
  try {
    storageRes = await fetch(downloadUrl);

    // If private_download_url returned non-200, try signed CDN URL as fallback
    if (!storageRes.ok && (deliveryType === "authenticated" || deliveryType === "private")) {
      const fallbackUrl = cloudinary.url(file.publicId, {
        resource_type: resourceType,
        type: deliveryType,
        sign_url: true,
        secure: true,
      });
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok && fallbackRes.body) {
        storageRes = fallbackRes;
      }
    }
  } catch (fetchErr) {
    console.error("[ProtectedDownload] Storage network error:", fetchErr instanceof Error ? fetchErr.message : fetchErr);
    return NextResponse.json(
      { error: "Failed to connect to storage provider." },
      { status: 502 }
    );
  }

  if (!storageRes.ok || !storageRes.body) {
    console.error(`[ProtectedDownload] Storage fetch failed HTTP ${storageRes.status} for fileId: ${file.id}`);
    return NextResponse.json(
      { error: "Failed to download resource from storage." },
      { status: 502 }
    );
  }

  // Sanitize filename for Content-Disposition header
  const rawFileName = file.fileName || "resource";
  const sanitizedFileName = rawFileName.replace(/["\r\n\\]/g, "_");
  const encodedFileName = encodeURIComponent(sanitizedFileName);

  const contentType =
    file.fileType ||
    storageRes.headers.get("content-type") ||
    "application/octet-stream";

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${sanitizedFileName}"; filename*=UTF-8''${encodedFileName}`,
    "Cache-Control": "private, no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
  };

  const contentLength = storageRes.headers.get("content-length");
  if (contentLength && !isNaN(Number(contentLength))) {
    headers["Content-Length"] = contentLength;
  }

  return new NextResponse(storageRes.body as any, {
    status: 200,
    headers,
  });
}
