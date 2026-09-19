/**
 * app/api/integrations/google/callback/route.ts
 *
 * Handles the Google OAuth 2.0 redirect callback.
 * Exchanges authorization code using PKCE, encrypts credentials via Vault,
 * upserts IntegrationConnection, and binds workspace integration.
 * SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { vaultEncrypt, vaultDecrypt } from "@/lib/crypto/vault";
import { hashStateNonce } from "@/lib/integrations/pkce";

// Legacy Google OAuth credential resolution (direct process.env — not routed through env module)
const LEGACY_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? null;
const LEGACY_GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? null;
const LEGACY_GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ??
  process.env.GOOGLE_REDIRECT_URI ??
  "http://localhost:3000/api/integrations/google/callback";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export async function GET(req: NextRequest) {
  const clerkUserId = await getCurrentUserId();
  if (!clerkUserId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const stateCookie = req.cookies.get("cd_oauth_state")?.value;

  // Clean response helper to clear state cookie
  const makeRedirect = (url: string) => {
    const res = NextResponse.redirect(new URL(url, req.url));
    res.cookies.set("cd_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (error) {
    console.warn("[OAuth Callback] Google returned error:", error);
    return makeRedirect(`/my-automations?error=oauth_${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return makeRedirect("/my-automations?error=invalid_oauth_response");
  }

  // Verify cookie presence and match
  if (!stateCookie || stateCookie !== state) {
    console.warn("[OAuth Callback] State cookie mismatch or missing.");
    return makeRedirect("/my-automations?error=state_mismatch");
  }

  const stateNonceHash = hashStateNonce(state);

  // Atomically find and delete session to prevent replay attacks
  const session = await prisma.oAuthAuthorizationSession.findUnique({
    where: { stateNonceHash },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return makeRedirect("/my-automations?error=session_expired");
  }

  // Atomic consumption: delete session immediately
  await prisma.oAuthAuthorizationSession.delete({
    where: { id: session.id },
  }).catch(() => {});

  // Enforce session ownership
  if (session.clerkUserId !== clerkUserId) {
    return makeRedirect("/my-automations?error=unauthorized_session");
  }

  // Decrypt PKCE code_verifier
  let codeVerifier: string;
  try {
    codeVerifier = vaultDecrypt({
      version: 1,
      iv: session.codeVerifierIv,
      authTag: session.codeVerifierTag,
      encryptedValue: session.codeVerifierEnc,
    });
  } catch {
    return makeRedirect("/my-automations?error=verifier_decryption_failed");
  }

  const clientId = LEGACY_GOOGLE_CLIENT_ID;
  const clientSecret = LEGACY_GOOGLE_CLIENT_SECRET;
  const redirectUri = LEGACY_GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return makeRedirect("/my-automations?error=server_misconfigured");
  }

  // Exchange authorization code for tokens with PKCE code_verifier
  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
      console.error(`[OAuth Callback] Token exchange failed with HTTP ${tokenRes.status}`);
      return makeRedirect("/my-automations?error=token_exchange_failed");
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error("[OAuth Callback] Network error during token exchange:", err);
    return makeRedirect("/my-automations?error=network_error");
  }

  // Fetch account identity from Google userinfo
  let userInfo: { sub: string; email?: string; name?: string; picture?: string };
  try {
    const userRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!userRes.ok) {
      return makeRedirect("/my-automations?error=userinfo_failed");
    }

    userInfo = await userRes.json();
  } catch (err) {
    return makeRedirect("/my-automations?error=userinfo_network_error");
  }

  const providerAccountId = userInfo.sub;
  if (!providerAccountId) {
    return makeRedirect("/my-automations?error=invalid_user_identity");
  }

  // Check refresh token availability
  let refreshTokenToStore: string | null = tokenData.refresh_token || null;

  // If Google omitted refresh_token (can happen on re-auth without prompt=consent), check for existing stored token
  if (!refreshTokenToStore) {
    const existing = await prisma.integrationConnection.findUnique({
      where: {
        clerkUserId_provider_providerAccountId: {
          clerkUserId,
          provider: "GOOGLE",
          providerAccountId,
        },
      },
      select: {
        refreshTokenEncrypted: true,
        refreshTokenIv: true,
        refreshTokenAuthTag: true,
        vaultVersion: true,
      },
    });

    if (existing && existing.refreshTokenEncrypted) {
      // Re-use existing valid refresh token
      try {
        refreshTokenToStore = vaultDecrypt({
          version: existing.vaultVersion,
          iv: existing.refreshTokenIv,
          authTag: existing.refreshTokenAuthTag,
          encryptedValue: existing.refreshTokenEncrypted,
        });
      } catch {
        refreshTokenToStore = null;
      }
    }
  }

  // If still no refresh token on initial connect, fail safe rather than creating broken connection
  if (!refreshTokenToStore) {
    return makeRedirect(
      `/api/integrations/google/connect?reconnect=true&returnUrl=${encodeURIComponent(
        session.returnUrl
      )}`
    );
  }

  // Encrypt tokens via AES-256-GCM Vault
  const encAccessToken = vaultEncrypt(tokenData.access_token);
  const encRefreshToken = vaultEncrypt(refreshTokenToStore);
  const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);
  const scopes = tokenData.scope ? tokenData.scope.split(" ").filter(Boolean) : [];

  // Upsert IntegrationConnection for this customer
  const connection = await prisma.integrationConnection.upsert({
    where: {
      clerkUserId_provider_providerAccountId: {
        clerkUserId,
        provider: "GOOGLE",
        providerAccountId,
      },
    },
    create: {
      clerkUserId,
      provider: "GOOGLE",
      providerAccountId,
      accountEmail: userInfo.email ?? null,
      accountName: userInfo.name ?? null,
      accountAvatarUrl: userInfo.picture ?? null,
      accessTokenEncrypted: encAccessToken.encryptedValue,
      accessTokenIv: encAccessToken.iv,
      accessTokenAuthTag: encAccessToken.authTag,
      refreshTokenEncrypted: encRefreshToken.encryptedValue,
      refreshTokenIv: encRefreshToken.iv,
      refreshTokenAuthTag: encRefreshToken.authTag,
      tokenExpiresAt,
      scopes,
      status: "CONNECTED",
      lastRefreshedAt: new Date(),
    },
    update: {
      accountEmail: userInfo.email ?? null,
      accountName: userInfo.name ?? null,
      accountAvatarUrl: userInfo.picture ?? null,
      accessTokenEncrypted: encAccessToken.encryptedValue,
      accessTokenIv: encAccessToken.iv,
      accessTokenAuthTag: encAccessToken.authTag,
      refreshTokenEncrypted: encRefreshToken.encryptedValue,
      refreshTokenIv: encRefreshToken.iv,
      refreshTokenAuthTag: encRefreshToken.authTag,
      tokenExpiresAt,
      scopes,
      status: "CONNECTED",
      lastRefreshedAt: new Date(),
      errorMessage: null,
      refreshLockUntil: null,
      refreshLockToken: null,
      tokenVersion: { increment: 1 },
    },
  });

  // If initiated from a specific UserAutomation workspace, bind it
  if (session.userAutomationId) {
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: session.userAutomationId },
      select: { clerkUserId: true },
    });

    if (userAuto && userAuto.clerkUserId === clerkUserId) {
      await prisma.userAutomationIntegration.upsert({
        where: {
          userAutomationId_role: {
            userAutomationId: session.userAutomationId,
            role: "gmail",
          },
        },
        create: {
          userAutomationId: session.userAutomationId,
          integrationConnectionId: connection.id,
          role: "gmail",
        },
        update: {
          integrationConnectionId: connection.id,
        },
      });
    }
  }

  const successUrl = new URL(session.returnUrl, req.url);
  successUrl.searchParams.set("connected", "google_success");
  return makeRedirect(successUrl.toString());
}
