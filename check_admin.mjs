import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const admin = await prisma.admin.findFirst();
    if (admin) {
      console.log("ADMIN_EMAIL:" + admin.email);
      const validAdmin123 = await bcrypt.compare("Admin123!", admin.passwordHash);
      console.log("PASSWORD_Admin123!:" + validAdmin123);
      const validLower = await bcrypt.compare("admin123", admin.passwordHash);
      console.log("PASSWORD_admin123:" + validLower);
      const validPassword = await bcrypt.compare("password", admin.passwordHash);
      console.log("PASSWORD_password:" + validPassword);
    } else {
      console.log("NO_ADMIN_FOUND");
    }

    // Count all tables
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
