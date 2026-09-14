import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function runTest() {
  console.log("1. Testing Cloudinary Upload...");
  try {
    // We already have a 'test-image.png' in the root from previous testing
    const testImagePath = path.join(process.cwd(), 'test-image.png');
    if (!fs.existsSync(testImagePath)) {
      // Create a simple dummy image (1x1 pixel transparent PNG) if it doesn't exist
      const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      fs.writeFileSync(testImagePath, dummyPng);
    }

    const uploadResult = await cloudinary.uploader.upload(testImagePath, {
      folder: 'cms_test'
    });
    console.log("Upload Success! URL:", uploadResult.secure_url);

    console.log("\n2. Testing Cloudinary Delete...");
    const deleteResult = await cloudinary.uploader.destroy(uploadResult.public_id);
    console.log("Delete Result:", deleteResult);

    console.log("\n3. Testing Database Operations (Neon)...");
    
    // Create
    const testPost = await prisma.post.create({
      data: {
        title: "Deployment Verification Test",
        slug: "deployment-verification-test",
        platform: "INSTAGRAM",
        status: "DRAFT",
        featuredImage: uploadResult.secure_url
      }
    });
    console.log("DB Create Success. Post ID:", testPost.id);

    // Read
    const readPost = await prisma.post.findUnique({ where: { id: testPost.id } });
    console.log("DB Read Success. Title:", readPost?.title);

    // Update
    const updatedPost = await prisma.post.update({
      where: { id: testPost.id },
      data: { title: "Deployment Verification Test - Updated" }
    });
    console.log("DB Update Success. New Title:", updatedPost.title);

    // Relation / Cascade test
    const category = await prisma.category.create({
      data: { name: "Test Category", slug: "test-category" }
    });
    await prisma.post.update({
      where: { id: testPost.id },
      data: { categories: { connect: { id: category.id } } }
    });
    console.log("DB Relation Success.");

    // Delete
    await prisma.post.delete({ where: { id: testPost.id } });
    await prisma.category.delete({ where: { id: category.id } });
    console.log("DB Delete Success (Cleanup).");

    console.log("\nALL TESTS PASSED.");
  } catch (err) {
    console.error("TEST FAILED:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
