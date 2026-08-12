import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { v2 as cloudinary } from "cloudinary";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "cms_uploads", resource_type: "auto" },
        async (error, result: any) => {
          if (error) {
            reject(error);
          } else {
            // Save to DB
            try {
              const media = await prisma.media.create({
                data: {
                  url: result.secure_url,
                  publicId: result.public_id,
                  format: result.format || result.resource_type,
                  width: result.width,
                  height: result.height,
                  bytes: result.bytes,
                  folder: result.folder,
                }
              });
              resolve({ ...result, id: media.id });
            } catch (dbError) {
              reject(dbError);
            }
          }
        }
      );
      uploadStream.end(buffer);
    });

    const uploadResult = result as any;
    return NextResponse.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      id: uploadResult.id,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    
    const media = await prisma.media.findMany({
      where: search ? {
        publicId: { contains: search, mode: "insensitive" }
      } : undefined,
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json({ media });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id, publicId } = await req.json();
    
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
    
    if (id) {
      await prisma.media.delete({ where: { id } });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }
}
