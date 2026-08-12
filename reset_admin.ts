import { prisma } from "./lib/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  try {
    // Reset the admin password to a known value for verification
    const newPassword = "Verify@2025!";
    const hash = await bcrypt.hash(newPassword, 12);
    
    const admin = await prisma.admin.updateMany({
      data: { passwordHash: hash }
    });

    console.log("ADMIN_UPDATED:" + admin.count);
    console.log("NEW_PASSWORD:" + newPassword);
    
    // Verify it works
    const updatedAdmin = await prisma.admin.findFirst();
    if (updatedAdmin) {
      const valid = await bcrypt.compare(newPassword, updatedAdmin.passwordHash);
      console.log("VERIFY_VALID:" + valid);
      console.log("ADMIN_EMAIL:" + updatedAdmin.email);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
