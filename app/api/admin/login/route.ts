import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes, createHmac } from "crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS, cleanupAuthData } from "@/lib/session";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export async function POST(req: NextRequest) {
  // Fire and forget cleanup of old sessions/rate limits
  cleanupAuthData();

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "Unknown";

  try {
    // Basic CSRF Protection: Verify Origin/Referer against Host
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // 1. Check Rate Limit
    const rateLimit = await prisma.rateLimit.findUnique({ where: { ip: ipAddress } });

    if (rateLimit && rateLimit.lockoutUntil && rateLimit.lockoutUntil > new Date()) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Fetch Admin (constant time mitigation setup)
    const admin = await prisma.admin.findUnique({ where: { email } });
    
    // A dummy hash to compare against if admin doesn't exist to prevent timing attacks
    // This is the hash for "dummy"
    const dummyHash = "$2a$12$R9h/cIPz0gi.URNNX3rub2.N.XG6nFjBtzK.K5tN5z.gqf.F2tVzG";
    const hashToCompare = admin ? admin.passwordHash : dummyHash;

    // 3. Verify Password
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!admin || !isValid) {
      // Increment rate limit
      const attempts = (rateLimit?.attempts || 0) + 1;
      let lockoutUntil = null;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      }

      await prisma.rateLimit.upsert({
        where: { ip: ipAddress },
        create: { ip: ipAddress, attempts: 1 },
        update: { attempts, lockoutUntil },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: "LOGIN_FAILED",
          ipAddress,
          userAgent,
          details: `Attempted email: ${email}`,
        },
      });

      // Generic error response
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 4. Success - Reset Rate Limit
    if (rateLimit) {
      await prisma.rateLimit.delete({ where: { ip: ipAddress } }).catch(() => {});
    }

    // 5. Create Session
    const token = randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await prisma.adminSession.create({
      data: {
        token,
        adminId: admin.id,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // 6. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "LOGIN_SUCCESS",
        ipAddress,
        userAgent,
        details: `Admin ID: ${admin.id}`,
      },
    });

    // 7. Set Cookie & Respond
    const signature = createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
    const signedToken = `${token}.${signature}`;

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
