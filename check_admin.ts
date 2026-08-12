import { prisma } from "./lib/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  try {
    const admin = await prisma.admin.findFirst();
    if (admin) {
      console.log("ADMIN_EMAIL:" + admin.email);
      const validAdmin123 = await bcrypt.compare("Admin123!", admin.passwordHash);
      console.log("PASSWORD_Admin123!:" + validAdmin123);
      const validLower = await bcrypt.compare("admin123", admin.passwordHash);
      console.log("PASSWORD_admin123:" + validLower);
    } else {
      console.log("NO_ADMIN_FOUND");
    }

    const postCount = await prisma.post.count();
    const catCount = await prisma.category.count();
    const tagCount = await prisma.tag.count();
    const mediaCount = await prisma.media.count();
    const commentCount = await prisma.comment.count();
    const visitCount = await prisma.pageVisit.count();
    const sessionCount = await prisma.adminSession.count();
    console.log("POSTS:" + postCount);
    console.log("CATEGORIES:" + catCount);
    console.log("TAGS:" + tagCount);
    console.log("MEDIA:" + mediaCount);
    console.log("COMMENTS:" + commentCount);
    console.log("PAGE_VISITS:" + visitCount);
    console.log("SESSIONS:" + sessionCount);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
