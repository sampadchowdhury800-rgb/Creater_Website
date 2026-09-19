/**
 * app/api/integrations/google/connect/route.ts
 *
 * Initiates the Google OAuth 2.0 flow with PKCE and state protection.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { vaultEncrypt } from "@/lib/crypto/vault";
import { generateCodeVerifier, generateCodeChallenge, generateStateNonce, hashStateNonce } from "@/lib/integrations/pkce";
import { deriveGoogleOAuthScopes, isSupportedGoogleCapability } from "@/lib/integrations/registry";
import type { SupportedGoogleCapability } from "@/lib/integrations/types";

// Legacy Google OAuth credential resolution (direct process.env — not routed through env module)
const LEGACY_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? null;
const LEGACY_GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ??
  process.env.GOOGLE_REDIRECT_URI ??
  "http://localhost:3000/api/integrations/google/callback";

/**
 * Validates that returnUrl is a safe internal relative path (prevents open redirects).
 */
function sanitizeReturnUrl(url: string | null): string {
  if (!url || typeof url !== "string") return "/my-automations";
  const trimmed = url.trim();
  // Must start with a single "/" and not "//" (protocol-relative redirect)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("://")) {
    return trimmed;
  }
  return "/my-automations";
}

export async function GET(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const clientId = LEGACY_GOOGLE_CLIENT_ID;
  const redirectUri = LEGACY_GOOGLE_REDIRECT_URI;

  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth client is not configured on server." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl = sanitizeReturnUrl(rawReturnUrl);
  const userAutomationId = searchParams.get("userAutomationId");
  const isReconnect = searchParams.get("reconnect") === "true";

  // Derive scopes based on userAutomation integration requirements if provided
  let capabilitiesToRequest: SupportedGoogleCapability[] = ["GMAIL_SEND"];

  if (userAutomationId) {
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: userAutomationId },
      include: {
        automation: {
          select: { integrationRequirements: true },
        },
      },
    });

    if (userAuto && userAuto.clerkUserId === clerkUserId && userAuto.automation.integrationRequirements) {
      const intReqs = userAuto.automation.integrationRequirements as {
        requirements?: Array<{ provider: string; capability: string }>;
      };
      if (Array.isArray(intReqs.requirements)) {
        const caps = intReqs.requirements
          .filter((r) => r.provider === "GOOGLE" && isSupportedGoogleCapability(r.capability))
          .map((r) => r.capability as SupportedGoogleCapability);
        if (caps.length > 0) {
          capabilitiesToRequest = caps;
        }
      }
    }
  }

  // Derive exact minimal Google OAuth scopes from the immutable server registry
  const scopes = deriveGoogleOAuthScopes(capabilitiesToRequest);

  // Generate PKCE code verifier and S256 challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Encrypt codeVerifier before storing in DB
  const codeVerifierEnc = vaultEncrypt(codeVerifier);

  // Generate random state nonce and its hash
  const stateNonce = generateStateNonce();
  const stateNonceHash = hashStateNonce(stateNonce);

  // Clean up any stale sessions for this user older than 10 minutes
  await prisma.oAuthAuthorizationSession.deleteMany({
    where: {
      clerkUserId,
      expiresAt: { lt: new Date() },
    },
  }).catch(() => {});

  // Persist OAuth authorization session (TTL: 10 minutes)
  await prisma.oAuthAuthorizationSession.create({
    data: {
      stateNonceHash,
      clerkUserId,
      codeVerifierEnc: codeVerifierEnc.encryptedValue,
      codeVerifierIv: codeVerifierEnc.iv,
      codeVerifierTag: codeVerifierEnc.authTag,
      userAutomationId: userAutomationId || null,
      returnUrl,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  // Build Google OAuth authorization URL
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", scopes.join(" "));
  googleAuthUrl.searchParams.set("access_type", "offline"); // Crucial: requests refresh token
  googleAuthUrl.searchParams.set("prompt", isReconnect ? "consent" : "select_account consent");
  googleAuthUrl.searchParams.set("include_granted_scopes", "true");
  googleAuthUrl.searchParams.set("state", stateNonce);
  googleAuthUrl.searchParams.set("code_challenge", codeChallenge);
  googleAuthUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(googleAuthUrl.toString(), 302);

  // Set secure state cookie
  response.cookies.set("cd_oauth_state", stateNonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
