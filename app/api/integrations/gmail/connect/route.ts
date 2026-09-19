/**
 * app/api/integrations/gmail/connect/route.ts
 *
 * Connects a customer's Gmail account using an email address and Gmail App Password.
 * Validates the credentials via live IMAP authentication test before saving.
 *
 * SECURITY INVARIANTS:
 * - App Password is encrypted using AES-256-GCM vault before persisting.
 * - App Password is NEVER logged, stored in plain text, or returned in the response.
 * - Requires authenticated Clerk session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { vaultEncrypt } from "@/lib/crypto/vault";
import { testImapConnection } from "@/lib/integrations/providers/imap";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json(
      { success: false, errorCode: "UNAUTHORIZED", errorMessage: "Authentication required." },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "INVALID_JSON", errorMessage: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawPassword = typeof body?.appPassword === "string" ? body.appPassword.trim() : "";
  const userAutomationId = typeof body?.userAutomationId === "string" ? body.userAutomationId.trim() : undefined;

  if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
    return NextResponse.json(
      { success: false, errorCode: "INVALID_EMAIL", errorMessage: "A valid Gmail address is required." },
      { status: 400 }
    );
  }

  // Google App Passwords are 16 lowercase characters, often generated with spaces (e.g. "abcd efgh ijkl mnop")
  const cleanedPassword = rawPassword.replace(/\s+/g, "");
  if (!cleanedPassword || cleanedPassword.length < 8) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "INVALID_APP_PASSWORD",
        errorMessage: "A valid Gmail App Password is required (typically 16 characters).",
      },
      { status: 400 }
    );
  }

  // Test IMAP connection with provided credentials before storing
  console.info("[Gmail Connect] Testing IMAP connection for user", { clerkUserId, email: rawEmail });
  const testRes = await testImapConnection({
    email: rawEmail,
    appPassword: cleanedPassword,
  });

  if (!testRes.success) {
    console.warn("[Gmail Connect] IMAP verification failed", { clerkUserId, email: rawEmail });
    return NextResponse.json(
      {
        success: false,
        errorCode: "IMAP_AUTH_FAILED",
        errorMessage:
          testRes.error ||
          "Could not authenticate with Gmail. Please verify your Gmail address and 16-character App Password (and ensure 2-Step Verification is enabled).",
      },
      { status: 400 }
    );
  }

  // Encrypt the App Password using our AES-256-GCM vault
  const encPassword = vaultEncrypt(cleanedPassword);
  const farFutureDate = new Date("2099-12-31T23:59:59Z");

  try {
    // Upsert IntegrationConnection for this user
    const connection = await prisma.integrationConnection.upsert({
      where: {
        clerkUserId_provider_providerAccountId: {
          clerkUserId,
          provider: "GOOGLE",
          providerAccountId: rawEmail,
        },
      },
      create: {
        clerkUserId,
        provider: "GOOGLE",
        providerAccountId: rawEmail,
        accountEmail: rawEmail,
        accessTokenEncrypted: encPassword.encryptedValue,
        accessTokenIv: encPassword.iv,
        accessTokenAuthTag: encPassword.authTag,
        refreshTokenEncrypted: "",
        refreshTokenIv: "",
        refreshTokenAuthTag: "",
        vaultVersion: 1,
        tokenExpiresAt: farFutureDate,
        scopes: ["IMAP", "SMTP"],
        status: "CONNECTED",
        lastRefreshedAt: new Date(),
        errorMessage: null,
      },
      update: {
        accountEmail: rawEmail,
        accessTokenEncrypted: encPassword.encryptedValue,
        accessTokenIv: encPassword.iv,
        accessTokenAuthTag: encPassword.authTag,
        refreshTokenEncrypted: "",
        refreshTokenIv: "",
        refreshTokenAuthTag: "",
        vaultVersion: 1,
        tokenExpiresAt: farFutureDate,
        scopes: ["IMAP", "SMTP"],
        status: "CONNECTED",
        lastRefreshedAt: new Date(),
        errorMessage: null,
        refreshLockUntil: null,
        refreshLockToken: null,
      },
    });

    // If an automation ID was provided, bind this connection to it
    if (userAutomationId) {
      const userAuto = await prisma.userAutomation.findUnique({
        where: { id: userAutomationId },
        select: { clerkUserId: true, status: true },
      });

      if (userAuto && userAuto.clerkUserId === clerkUserId) {
        await prisma.userAutomationIntegration.upsert({
          where: {
            userAutomationId_role: {
              userAutomationId,
              role: "gmail",
            },
          },
          create: {
            userAutomationId,
            integrationConnectionId: connection.id,
            role: "gmail",
          },
          update: {
            integrationConnectionId: connection.id,
          },
        });

        if (userAuto.status === "NOT_CONFIGURED") {
          await prisma.userAutomation.update({
            where: { id: userAutomationId },
            data: { status: "ACTIVE" },
          });
        }
      }
    }

    // Sync to Supabase gmail_accounts table if Supabase is configured
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        // Ensure a business record exists for this tenant
        const { data: biz } = await supabase
          .from("businesses")
          .upsert(
            {
              slug: clerkUserId,
              name: `Tenant ${clerkUserId.slice(-6)}`,
              contact_email: rawEmail,
            },
            { onConflict: "slug" }
          )
          .select("id")
          .single();

        if (biz?.id) {
          await supabase.from("business_rules").upsert(
            {
              business_id: biz.id,
              company_description: "Customer Support Service",
              support_policies: "We provide prompt and helpful customer support for all inquiries. Our business hours are Monday to Friday from 9:00 AM to 6:00 PM IST.",
              refund_return_rules: "Full refund within 14 days of purchase upon request.",
              tone: "friendly, professional, and clear",
              working_hours: "Monday - Friday, 9:00 AM - 6:00 PM IST",
              custom_instructions: "Answer customer questions clearly and directly. Always be courteous.",
              auto_reply_enabled: true,
              confidence_threshold: 0.65,
            },
            { onConflict: "business_id" }
          );

          await supabase.from("gmail_accounts").upsert(
            {
              business_id: biz.id,
              email: rawEmail,
              app_password_enc: encPassword.encryptedValue,
              app_password_iv: encPassword.iv,
              app_password_tag: encPassword.authTag,
              vault_version: 1,
              status: "CONNECTED",
              error_message: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "business_id,email" }
          );
        }
      }
    } catch (sbErr: any) {
      console.warn("[Gmail Connect] Supabase sync skipped or failed (non-fatal):", sbErr?.message);
    }

    console.info("[Gmail Connect] Gmail integration connected successfully", {
      clerkUserId,
      connectionId: connection.id,
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      accountEmail: rawEmail,
    });
  } catch (dbErr: any) {
    console.error("[Gmail Connect] Database error saving integration", {
      clerkUserId,
      error: dbErr?.message,
    });
    return NextResponse.json(
      { success: false, errorCode: "DATABASE_ERROR", errorMessage: "Failed to save integration connection." },
      { status: 500 }
    );
  }
}
