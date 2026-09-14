/**
 * Admin Seed Script (Prisma v7 + Neon)
 *
 * Usage:
 *   Set environment variables in .env or .env.local, then run:
 *   npx tsx scripts/seed-admin.ts
 *
 * Required env vars:
 *   DATABASE_URL    - Your Neon PostgreSQL connection string
 *   ADMIN_EMAIL     - Email for the admin account
 *   ADMIN_PASSWORD  - Password for the admin account
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Load .env manually since dotenv may not be available yet
const envPath = resolve(process.cwd(), ".env");

function loadEnvFile(path: string) {
  if (existsSync(path)) {
    const lines = readFileSync(path, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = val;
    }
    console.log(`✅ Loaded ${path}`);
  }
}

loadEnvFile(envPath);

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("❌ Missing required environment variables:");
    console.error("   ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set in .env");
    process.exit(1);
  }

  const poolConfig = { connectionString: process.env.DATABASE_URL };
  const adapter = new PrismaNeon(poolConfig);
  const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  console.log(`🔍 Checking for existing admin: ${email}`);

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    console.log("✅ Admin already exists. No changes made.");
    await prisma.$disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  await prisma.admin.create({
    data: { email, passwordHash },
  });

  await prisma.$disconnect();

  console.log("");
  console.log("✅ Admin account created successfully!");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: [use the ADMIN_PASSWORD you set]`);
  console.log("");
  console.log("👉 Run the database migration next if you haven't already:");
  console.log("   npx prisma migrate dev");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message || e);
  process.exit(1);
});
