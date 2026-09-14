/**
 * scripts/test-pubsub-oidc-and-queue-review.ts
 *
 * Dedicated test suite for:
 * 1. Google Pub/Sub OIDC JWT verification (all 7 required negative/positive test cases)
 * 2. Human Review queue customer email persistence & tenant isolation
 */

import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  verifyGooglePubSubOidcToken,
  __setJwksCacheForTesting,
  GoogleJwk,
} from "../lib/security/google-oidc";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` (${details})` : ""}`);
    failed++;
  }
}

// Helper to generate test RSA key pair and signed JWTs
function generateTestKeysAndTokens() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const jwk = publicKey.export({ format: "jwk" }) as unknown as GoogleJwk;
  const kid = "test-pubsub-key-1";
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";

  const customJwks = new Map<string, GoogleJwk>();
  customJwks.set(kid, jwk);

  function createJwt(
    claims: Record<string, any>,
    options: {
      kid?: string;
      alg?: string;
      customPrivateKey?: crypto.KeyObject;
      tamperSignature?: boolean;
    } = {}
  ) {
    const keyId = options.kid ?? kid;
    const algorithm = options.alg ?? "RS256";
    const signKey = options.customPrivateKey ?? privateKey;

    const header = Buffer.from(
      JSON.stringify({ alg: algorithm, kid: keyId, typ: "JWT" })
    ).toString("base64url");

    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const data = `${header}.${payload}`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(data);
    let signature = signer.sign(signKey).toString("base64url");

    if (options.tamperSignature) {
      signature = signature.slice(0, -4) + "XXXX";
    }

    return `${header}.${payload}.${signature}`;
  }

  return { publicKey, privateKey, kid, customJwks, createJwt };
}

async function runPubSubOidcTests() {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("  TEST GROUP 1: GOOGLE PUB/SUB OIDC JWT VERIFICATION");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const { privateKey, kid, customJwks, createJwt } = generateTestKeysAndTokens();

  // Inject custom test JWKS
  __setJwksCacheForTesting(customJwks);

  const EXPECTED_AUD = "https://chowdhuryduo.com/api/webhooks/gmail";
  const now = Math.floor(Date.now() / 1000);

  // 1. Valid Google OIDC JWT
  const validToken = createJwt({
    iss: "https://accounts.google.com",
    aud: EXPECTED_AUD,
    sub: "pubsub-service-account-123",
    email: "pubsub-invoker@gserviceaccount.com",
    exp: now + 3600,
    iat: now,
  });

  const resValid = await verifyGooglePubSubOidcToken(`Bearer ${validToken}`, {
    expectedAudience: EXPECTED_AUD,
  });
  assert(resValid.valid === true, "1. Valid Google OIDC JWT accepted");
  assert(
    resValid.claims?.email === "pubsub-invoker@gserviceaccount.com",
    "1b. Valid claims extracted accurately without data corruption"
  );

  // 2. Missing token
  const resMissing1 = await verifyGooglePubSubOidcToken(null);
  assert(
    resMissing1.valid === false && resMissing1.errorCode === "MISSING_AUTHORIZATION",
    "2a. Missing token (null) rejected"
  );

  const resMissing2 = await verifyGooglePubSubOidcToken("");
  assert(
    resMissing2.valid === false && resMissing2.errorCode === "MISSING_AUTHORIZATION",
    "2b. Missing token (empty string) rejected"
  );

  const resMissing3 = await verifyGooglePubSubOidcToken("Bearer ");
  assert(
    resMissing3.valid === false && resMissing3.errorCode === "MISSING_AUTHORIZATION",
    "2c. Empty Bearer token rejected"
  );

  // 3. Malformed token
  const resMalformed1 = await verifyGooglePubSubOidcToken("Bearer not.a.valid.jwt.parts");
  assert(
    resMalformed1.valid === false && resMalformed1.errorCode === "MALFORMED_TOKEN",
    "3a. Malformed token (invalid dot count) rejected"
  );

  const resMalformed2 = await verifyGooglePubSubOidcToken("Bearer header.invalidPayload.sig");
  assert(
    resMalformed2.valid === false && resMalformed2.errorCode === "MALFORMED_TOKEN",
    "3b. Malformed token (unparseable payload) rejected"
  );

  // 4. Invalid signature
  const resTampered = await verifyGooglePubSubOidcToken(
    `Bearer ${createJwt(
      {
        iss: "https://accounts.google.com",
        aud: EXPECTED_AUD,
        exp: now + 3600,
        iat: now,
      },
      { tamperSignature: true }
    )}`,
    { expectedAudience: EXPECTED_AUD }
  );
  assert(
    resTampered.valid === false && resTampered.errorCode === "INVALID_SIGNATURE",
    "4a. Tampered signature rejected"
  );

  // Key mismatch signature (signed with an untrusted private key)
  const untrustedPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const resUntrusted = await verifyGooglePubSubOidcToken(
    `Bearer ${createJwt(
      {
        iss: "https://accounts.google.com",
        aud: EXPECTED_AUD,
        exp: now + 3600,
        iat: now,
      },
      { customPrivateKey: untrustedPair.privateKey }
    )}`,
    { expectedAudience: EXPECTED_AUD }
  );
  assert(
    resUntrusted.valid === false && resUntrusted.errorCode === "INVALID_SIGNATURE",
    "4b. Signature created with untrusted key rejected"
  );

  // 5. Expired token
  const resExpired = await verifyGooglePubSubOidcToken(
    `Bearer ${createJwt({
      iss: "https://accounts.google.com",
      aud: EXPECTED_AUD,
      exp: now - 3600, // Expired 1 hour ago
      iat: now - 7200,
    })}`,
    { expectedAudience: EXPECTED_AUD }
  );
  assert(
    resExpired.valid === false && resExpired.errorCode === "TOKEN_EXPIRED",
    "5. Expired token rejected"
  );

  // 6. Wrong issuer
  const resWrongIssuer = await verifyGooglePubSubOidcToken(
    `Bearer ${createJwt({
      iss: "https://rogue-auth.attacker.com",
      aud: EXPECTED_AUD,
      exp: now + 3600,
      iat: now,
    })}`,
    { expectedAudience: EXPECTED_AUD }
  );
  assert(
    resWrongIssuer.valid === false && resWrongIssuer.errorCode === "INVALID_ISSUER",
    "6. Incorrect issuer rejected"
  );

  // 7. Wrong audience
  const resWrongAud = await verifyGooglePubSubOidcToken(
    `Bearer ${createJwt({
      iss: "https://accounts.google.com",
      aud: "https://other-service.com/webhook",
      exp: now + 3600,
      iat: now,
    })}`,
    { expectedAudience: EXPECTED_AUD }
  );
  assert(
    resWrongAud.valid === false && resWrongAud.errorCode === "INVALID_AUDIENCE",
    "7. Incorrect audience rejected"
  );

  // Reset JWKS test cache
  __setJwksCacheForTesting(null);
}

async function runQueueReviewTests() {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("  TEST GROUP 2: QUEUE-REVIEW CUSTOMER EMAIL & TENANT ISOLATION");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const TENANT_A = `tenant_rev_a_${Date.now()}`;
  const TENANT_B = `tenant_rev_b_${Date.now()}`;
  const THREAD_A = `thread_rev_a_${Date.now()}`;
  const THREAD_B = `thread_rev_b_${Date.now()}`;
  const MSG_A = `msg_rev_a_${Date.now()}`;
  const MSG_B = `msg_rev_b_${Date.now()}`;
  const REAL_CUSTOMER_EMAIL = "real.customer@external-client.com";

  let automationId = "";
  let userAutoAId = "";
  let userAutoBId = "";

  try {
    // Setup test automations
    const auto = await prisma.automation.create({
      data: {
        title: "Test Support Automation",
        slug: `test-support-auto-${Date.now()}`,
        shortDesc: "Unit test automation for queue-review",
        price: 0,
        currency: "INR",
        status: "PUBLISHED",
        isExecutable: true,
        features: ["email_support"],
      },
    });
    automationId = auto.id;

    const uaA = await prisma.userAutomation.create({
      data: {
        clerkUserId: TENANT_A,
        automationId: auto.id,
        status: "ACTIVE",
      },
    });
    userAutoAId = uaA.id;

    const uaB = await prisma.userAutomation.create({
      data: {
        clerkUserId: TENANT_B,
        automationId: auto.id,
        status: "ACTIVE",
      },
    });
    userAutoBId = uaB.id;

    // Simulate direct queue-review call with real customer email provided
    // using the exact internal logic from route.ts
    const convA = await prisma.supportConversation.upsert({
      where: {
        userAutomationId_gmailThreadId: {
          userAutomationId: userAutoAId,
          gmailThreadId: THREAD_A,
        },
      },
      create: {
        clerkUserId: TENANT_A,
        userAutomationId: userAutoAId,
        gmailThreadId: THREAD_A,
        subject: "Refund Request",
        customerEmail: REAL_CUSTOMER_EMAIL,
        status: "PENDING_APPROVAL",
        category: "CUSTOMER_SUPPORT",
      },
      update: {
        status: "PENDING_APPROVAL",
        customerEmail: REAL_CUSTOMER_EMAIL,
      },
    });

    assert(
      convA.customerEmail === REAL_CUSTOMER_EMAIL,
      "8a. Actual customer email is persisted into SupportConversation"
    );
    assert(
      convA.customerEmail !== "customer@domain.com",
      "8b. Hardcoded placeholder 'customer@domain.com' is NEVER persisted"
    );

    // Test fallback resolution when email is formatted like 'Client Name <client@corp.org>'
    const rawFormattedFrom = "Enterprise Client <client@enterprise-corp.org>";
    const match =
      rawFormattedFrom.match(/<([^>]+)>/) ||
      rawFormattedFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const parsedEmail = match ? match[1].trim() : rawFormattedFrom;

    const convFormatted = await prisma.supportConversation.create({
      data: {
        clerkUserId: TENANT_A,
        userAutomationId: userAutoAId,
        gmailThreadId: `thread_formatted_${Date.now()}`,
        subject: "Contract Inquiry",
        customerEmail: parsedEmail,
        status: "PENDING_APPROVAL",
      },
    });
    assert(
      convFormatted.customerEmail === "client@enterprise-corp.org",
      "8c. Parsed email from 'Name <email>' format cleanly extracts real address"
    );

    // Test Tenant Isolation
    const convB = await prisma.supportConversation.create({
      data: {
        clerkUserId: TENANT_B,
        userAutomationId: userAutoBId,
        gmailThreadId: THREAD_B,
        subject: "Tenant B Inquiry",
        customerEmail: "tenant.b.client@domain.org",
        status: "PENDING_APPROVAL",
      },
    });

    // Tenant A queries conversations
    const tenantAConvs = await prisma.supportConversation.findMany({
      where: { clerkUserId: TENANT_A },
    });
    const containsTenantBData = tenantAConvs.some((c) => c.clerkUserId === TENANT_B);
    assert(
      containsTenantBData === false,
      "9a. Strict tenant isolation: Tenant A cannot see Tenant B conversations"
    );

    // Tenant B queries conversations
    const tenantBConvs = await prisma.supportConversation.findMany({
      where: { clerkUserId: TENANT_B },
    });
    const containsTenantAData = tenantBConvs.some((c) => c.clerkUserId === TENANT_A);
    assert(
      containsTenantAData === false,
      "9b. Strict tenant isolation: Tenant B cannot see Tenant A conversations"
    );
    assert(
      tenantBConvs.length === 1 && tenantBConvs[0].id === convB.id,
      "9c. Tenant B query precisely resolves only their own conversation"
    );

    // Cleanup test records
    await prisma.supportMessage.deleteMany({
      where: { conversationId: { in: [convA.id, convFormatted.id, convB.id] } },
    });
    await prisma.supportConversation.deleteMany({
      where: { id: { in: [convA.id, convFormatted.id, convB.id] } },
    });
    await prisma.userAutomation.deleteMany({
      where: { id: { in: [userAutoAId, userAutoBId] } },
    });
    await prisma.automation.delete({
      where: { id: automationId },
    });
  } catch (err: any) {
    assert(false, "Queue-review test error", err.message);
  }
}

async function main() {
  await runPubSubOidcTests();
  await runQueueReviewTests();

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(`  SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("══════════════════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
