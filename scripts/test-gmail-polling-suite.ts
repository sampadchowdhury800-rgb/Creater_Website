/**
 * scripts/test-gmail-polling-suite.ts
 *
 * Comprehensive Test Suite for Gmail Secure Polling Gateway:
 * app/api/internal/gateway/gmail/poll/route.ts
 *
 * VERIFIES:
 * 1. Missing gateway authentication (401 MISSING_SERVICE_AUTH)
 * 2. Invalid gateway authentication (401 INVALID_SERVICE_AUTH)
 * 3. Valid gateway authentication (200 OK)
 * 4. No connected Gmail accounts (graceful 0-count response)
 * 5. One connected Gmail account (message detection, execution creation, grant minting)
 * 6. Tenant isolation (Tenant A and Tenant B connections strictly separated)
 * 7. Multiple tenants processed in a single run
 * 8. Unread message detection & parsing
 * 9. Already-processed message deduplication (fast-path skip)
 * 10. Concurrent duplicate polling (atomic transaction race; exactly one succeeds)
 * 11. Execution creation & correct status/input
 * 12. Execution grant creation (transient, allowedCapability: SUPPORT_AI)
 * 13. Correct n8n event payload matching gmail_Customer_Support_Agent Node 2 contract
 * 14. N8N_SUPPORT_WEBHOOK_URL failure resiliency (graceful degradation)
 * 15. Gmail access-token refresh on expiry
 * 16. Revoked / invalid Gmail credentials (marks connection EXPIRED, skips safely)
 * 17. Gmail API failure / timeout resiliency
 * 18. Zero OAuth token or secret leakage in responses
 * 19. Zero cross-tenant data leakage
 */

import { NextRequest } from "next/server";
import { POST, GET } from "../app/api/internal/gateway/gmail/poll/route";
import { prisma } from "../lib/prisma";
import { vaultEncrypt } from "../lib/crypto/vault";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failedCount++;
  }
}

const GATEWAY_SECRET = process.env.CHOWDHURY_DUO_GATEWAY_SECRET || "cd_gateway_test_secret_32chars_long!!";
const TEST_TIMESTAMP = Date.now();
const TENANT_A = `test_tenant_a_${TEST_TIMESTAMP}`;
const TENANT_B = `test_tenant_b_${TEST_TIMESTAMP}`;
const TENANT_C = `test_tenant_c_${TEST_TIMESTAMP}`;
const TENANT_D = `test_tenant_d_${TEST_TIMESTAMP}`;

const createdRecordIds = {
  automations: [] as string[],
  userAutomations: [] as string[],
  entitlements: [] as string[],
  connections: [] as string[],
  executions: [] as string[],
  operations: [] as string[],
  grants: [] as string[],
};

// Mock fetch intercepts for Google APIs and n8n webhook
const originalFetch = globalThis.fetch;
const dispatchedN8nEvents: any[] = [];
const capturedGmailQueries: string[] = [];
let mockGoogleListMessagesResponse: any = null;
let mockGoogleGetMessageResponse: any = null;
let mockGoogleTokenRefreshResponse: any = null;
let mockN8nWebhookResponse: { ok: boolean; status: number } = { ok: true, status: 200 };
let simulateN8nNetworkError = false;

function installFetchMock() {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input.toString();

    // 1. Mock n8n support webhook
    if (url.includes("n8n") || url.includes("webhook") || url.includes("railway.app")) {
      if (simulateN8nNetworkError) {
        throw new Error("Simulated network timeout connecting to n8n");
      }
      try {
        if (init?.body) {
          dispatchedN8nEvents.push(JSON.parse(init.body as string));
        }
      } catch {}
      return new Response(JSON.stringify({ success: mockN8nWebhookResponse.ok }), {
        status: mockN8nWebhookResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Mock Google Token Refresh Endpoint
    if (url.includes("oauth2.googleapis.com/token")) {
      if (mockGoogleTokenRefreshResponse) {
        return new Response(JSON.stringify(mockGoogleTokenRefreshResponse.body), {
          status: mockGoogleTokenRefreshResponse.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          access_token: "refreshed_access_token_mock",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Mock Gmail Get Message Endpoint (/gmail/v1/users/me/messages/<id>?...)
    const getMessageMatch = url.match(/\/gmail\/v1\/users\/me\/messages\/([^?]+)/);
    if (getMessageMatch) {
      const msgId = getMessageMatch[1];
      if (typeof mockGoogleGetMessageResponse === "function") {
        return (mockGoogleGetMessageResponse as any)(msgId, init);
      }
      if (mockGoogleGetMessageResponse) {
        return new Response(JSON.stringify(mockGoogleGetMessageResponse.body), {
          status: mockGoogleGetMessageResponse.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Default: Return recent message (dated in future to be safely post-baseline)
      return new Response(
        JSON.stringify({
          id: msgId,
          threadId: `th_${msgId}`,
          internalDate: String(Date.now() + 60000),
          snippet: "Mock message snippet",
          payload: { headers: [{ name: "Date", value: new Date(Date.now() + 60000).toUTCString() }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Mock Gmail List Messages Endpoint
    if (url.includes("gmail.googleapis.com/gmail/v1/users/me/messages")) {
      const queryMatch = url.match(/[?&]q=([^&]+)/);
      if (queryMatch) {
        capturedGmailQueries.push(decodeURIComponent(queryMatch[1].replace(/\+/g, " ")));
      }
      if (typeof mockGoogleListMessagesResponse === "function") {
        return (mockGoogleListMessagesResponse as any)(init);
      }
      if (mockGoogleListMessagesResponse) {
        return new Response(JSON.stringify(mockGoogleListMessagesResponse.body), {
          status: mockGoogleListMessagesResponse.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      const authHeader = (init?.headers as any)?.Authorization || "";
      const isB = authHeader.includes("mock_access_token_b");
      const isD = authHeader.includes("mock_access_token_d");
      const id = isD ? `msg_tenant_d_${TEST_TIMESTAMP}` : isB ? `msg_tenant_b_${TEST_TIMESTAMP}` : `msg_tenant_a_${TEST_TIMESTAMP}`;
      return new Response(
        JSON.stringify({
          messages: [{ id, threadId: `th_${id}` }],
          resultSizeEstimate: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return originalFetch(input, init);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

async function runTestSuite() {
  console.log("\n======================================================================");
  console.log("  GMAIL SECURE POLLING GATEWAY TEST SUITE");
  console.log("  Target Endpoint: /api/internal/gateway/gmail/poll");
  console.log("======================================================================\n");

  installFetchMock();
  process.env.GOOGLE_CLIENT_ID = "mock-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
  process.env.CHOWDHURY_DUO_GATEWAY_SECRET = GATEWAY_SECRET;
  process.env.N8N_SUPPORT_WEBHOOK_URL = "https://mock-n8n.railway.app/webhook/support";

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: AUTHENTICATION TESTS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("📍 STEP 1: Internal Gateway Authentication Verification\n");

    // 1. Missing authentication
    {
      const req = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
        method: "POST",
      });
      const res = await POST(req);
      const data = await res.json();
      assert(res.status === 401, "Missing gateway secret returns 401 status");
      assert(data.errorCode === "MISSING_SERVICE_AUTH", "Missing gateway secret returns MISSING_SERVICE_AUTH");
    }

    // 2. Invalid authentication
    {
      const req = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
        method: "POST",
        headers: { "x-internal-service-key": "completely-invalid-secret-key" },
      });
      const res = await POST(req);
      const data = await res.json();
      assert(res.status === 401, "Invalid gateway secret returns 401 status");
      assert(data.errorCode === "INVALID_SERVICE_AUTH", "Invalid gateway secret returns INVALID_SERVICE_AUTH");
    }

    // 3. Valid authentication via x-internal-service-key
    {
      const req = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll?tenantId=non_existent_tenant", {
        method: "GET",
        headers: { "x-internal-service-key": GATEWAY_SECRET },
      });
      const res = await GET(req);
      const data = await res.json();
      assert(res.status === 200, "Valid gateway secret via GET returns 200 status");
      assert(data.success === true, "Valid gateway secret returns success: true");
      assert(data.summary.connectionsChecked === 0, "No accounts found for non-existent tenant");
    }

    // 4. Valid authentication via x-n8n-gateway-secret
    {
      const req = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-n8n-gateway-secret": GATEWAY_SECRET,
        },
        body: JSON.stringify({ tenantId: "non_existent_tenant" }),
      });
      const res = await POST(req);
      const data = await res.json();
      assert(res.status === 200, "Valid gateway secret via x-n8n-gateway-secret returns 200");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: SETUP SYNTHETIC DATABASE FIXTURES
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n📍 STEP 2: Setting Up Synthetic Fixtures (Tenant A & Tenant B)\n");

    const sharedAuto = await prisma.automation.create({
      data: {
        slug: `auto-poll-test-${TEST_TIMESTAMP}`,
        title: "Test Support Automation",
        shortDesc: "Automated test instance for polling",
        description: "Test description",
        price: 0,
        currency: "INR",
        status: "PUBLISHED",
        isExecutable: true,
      },
    });
    createdRecordIds.automations.push(sharedAuto.id);

    // Tenant A Setup
    const userAutoA = await prisma.userAutomation.create({
      data: {
        clerkUserId: TENANT_A,
        automationId: sharedAuto.id,
        status: "ACTIVE",
        config: { autoReplyEnabled: true },
      },
    });
    createdRecordIds.userAutomations.push(userAutoA.id);

    const entitlementA = await prisma.automationEntitlement.create({
      data: {
        clerkUserId: TENANT_A,
        automationId: sharedAuto.id,
        userAutomationId: userAutoA.id,
        status: "ACTIVE",
        isLifetime: true,
        startsAt: new Date(),
        maintenanceStatus: "ACTIVE",
      },
    });
    createdRecordIds.entitlements.push(entitlementA.id);

    const encA = vaultEncrypt("mock_access_token_a");
    const encRefA = vaultEncrypt("mock_refresh_token_a");

    const connA = await prisma.integrationConnection.create({
      data: {
        clerkUserId: TENANT_A,
        provider: "GOOGLE",
        providerAccountId: `google_account_a_${TEST_TIMESTAMP}`,
        accountEmail: "tenant-a-support@domain.test",
        accountName: "Tenant A Support",
        status: "CONNECTED",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        accessTokenEncrypted: encA.encryptedValue,
        accessTokenIv: encA.iv,
        accessTokenAuthTag: encA.authTag,
        refreshTokenEncrypted: encRefA.encryptedValue,
        refreshTokenIv: encRefA.iv,
        refreshTokenAuthTag: encRefA.authTag,
        tokenExpiresAt: new Date(Date.now() + 3600000), // Valid for 1h
      },
    });
    createdRecordIds.connections.push(connA.id);

    await prisma.userAutomationIntegration.create({
      data: {
        userAutomationId: userAutoA.id,
        integrationConnectionId: connA.id,
        role: "gmail",
      },
    });

    // Tenant B Setup
    const userAutoB = await prisma.userAutomation.create({
      data: {
        clerkUserId: TENANT_B,
        automationId: sharedAuto.id,
        status: "ACTIVE",
        config: { autoReplyEnabled: true },
      },
    });
    createdRecordIds.userAutomations.push(userAutoB.id);

    const entitlementB = await prisma.automationEntitlement.create({
      data: {
        clerkUserId: TENANT_B,
        automationId: sharedAuto.id,
        userAutomationId: userAutoB.id,
        status: "ACTIVE",
        isLifetime: true,
        startsAt: new Date(),
        maintenanceStatus: "ACTIVE",
      },
    });
    createdRecordIds.entitlements.push(entitlementB.id);

    const encB = vaultEncrypt("mock_access_token_b");
    const encRefB = vaultEncrypt("mock_refresh_token_b");

    const connB = await prisma.integrationConnection.create({
      data: {
        clerkUserId: TENANT_B,
        provider: "GOOGLE",
        providerAccountId: `google_account_b_${TEST_TIMESTAMP}`,
        accountEmail: "tenant-b-support@domain.test",
        accountName: "Tenant B Support",
        status: "CONNECTED",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        accessTokenEncrypted: encB.encryptedValue,
        accessTokenIv: encB.iv,
        accessTokenAuthTag: encB.authTag,
        refreshTokenEncrypted: encRefB.encryptedValue,
        refreshTokenIv: encRefB.iv,
        refreshTokenAuthTag: encRefB.authTag,
        tokenExpiresAt: new Date(Date.now() + 3600000), // Valid for 1h
      },
    });
    createdRecordIds.connections.push(connB.id);

    await prisma.userAutomationIntegration.create({
      data: {
        userAutomationId: userAutoB.id,
        integrationConnectionId: connB.id,
        role: "gmail",
      },
    });

    console.log("  ✅ Fixtures created for Tenant A & Tenant B");

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: SINGLE ACCOUNT POLLING & N8N EVENT CONTRACT VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n📍 STEP 3: Single Account Polling & n8n Event Contract Verification\n");

    const msgId1 = `msg_test_1_${TEST_TIMESTAMP}`;
    const threadId1 = `th_test_1_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: msgId1, threadId: threadId1 }] },
    };
    dispatchedN8nEvents.length = 0;

    const pollReq1 = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_A }),
    });

    const pollRes1 = await POST(pollReq1);
    const pollData1 = await pollRes1.json();

    assert(pollRes1.status === 200, "Single account poll returns 200 status");
    assert(pollData1.success === true, "Single account poll reports success: true");
    assert(pollData1.summary.connectionsChecked === 1, "Exactly 1 connection checked for Tenant A");
    assert(pollData1.summary.messagesFound === 1, "Unread message detected (messagesFound = 1)");
    assert(pollData1.summary.executionsCreated === 1, "AutomationExecution successfully created");
    assert(pollData1.summary.messagesProcessed === 1, "Message successfully processed");
    assert(pollData1.summary.n8nDispatched === 1, "n8n support webhook successfully notified");

    // Verify created DB records
    const createdExec = await prisma.automationExecution.findFirst({
      where: { clerkUserId: TENANT_A, userAutomationId: userAutoA.id },
      orderBy: { createdAt: "desc" },
      include: { executionGrants: true, gatewayOperations: true },
    });

    assert(!!createdExec, "AutomationExecution persisted in database");
    assert(createdExec?.status === "QUEUED", "AutomationExecution created in QUEUED status");
    assert((createdExec?.input as any)?.messageId === msgId1, "Execution input contains messageId");
    assert((createdExec?.input as any)?.trigger === "GMAIL_POLL", "Execution trigger is GMAIL_POLL");

    // Verify Execution Grant
    assert(createdExec?.executionGrants.length === 1, "Single transient execution grant created");
    const grant = createdExec?.executionGrants[0];
    assert(grant?.allowedCapability === "SUPPORT_AI", "Execution grant has allowedCapability: SUPPORT_AI");
    assert(grant?.status === "ISSUED", "Execution grant status is ISSUED");
    assert(grant?.expiresAt.getTime()! > Date.now(), "Execution grant has valid future expiration");

    // Verify Gateway Operation (idempotency lock)
    const op = createdExec?.gatewayOperations.find((o) => o.idempotencyKey === `poll_claim_${msgId1}`);
    assert(!!op, "Atomic claim operation recorded with key poll_claim_<msgId>");
    assert(op?.status === "PENDING", "Claim operation status is PENDING");

    // Verify n8n Event Payload Contract
    assert(dispatchedN8nEvents.length === 1, "n8n webhook received exactly 1 event");
    const n8nPayload = dispatchedN8nEvents[0];
    assert(typeof n8nPayload.eventId === "string" && n8nPayload.eventId.length > 0, "Payload has non-empty eventId");
    assert(n8nPayload.eventType === "GMAIL_INBOUND_NOTIFICATION", "Payload has eventType: GMAIL_INBOUND_NOTIFICATION");
    assert(n8nPayload.tenantId === TENANT_A, "Payload tenantId strictly equals Tenant A ID");
    assert(n8nPayload.emailId === msgId1, "Payload emailId matches unread message ID");
    assert(n8nPayload.threadId === threadId1, "Payload threadId matches message thread ID");
    assert(typeof n8nPayload.executionGrantId === "string" && n8nPayload.executionGrantId.length === 64, "Payload executionGrantId is 64-char hex token");
    assert(!isNaN(Date.parse(n8nPayload.timestamp)), "Payload timestamp is valid ISO date string");

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 4: DEDUPLICATION & IDEMPOTENCY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n📍 STEP 4: Deduplication & Atomic Idempotency Verification\n");

    // Re-polling the same message should result in zero new executions
    dispatchedN8nEvents.length = 0;
    const rePollReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_A }),
    });

    const rePollRes = await POST(rePollReq);
    const rePollData = await rePollRes.json();

    assert(rePollRes.status === 200, "Re-poll returns 200 status");
    assert(rePollData.summary.messagesFound === 1, "Message still reported as unread by Gmail");
    assert(rePollData.summary.executionsCreated === 0, "Duplicate message detected: ZERO new executions created");
    assert(rePollData.summary.messagesProcessed === 0, "Duplicate message detected: ZERO messages processed");
    assert(dispatchedN8nEvents.length === 0, "Duplicate message detected: ZERO n8n webhooks sent");

    // Verify simulated concurrent race condition: 2 parallel polls on new message
    const concurrentMsgId = `msg_concurrent_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: concurrentMsgId, threadId: `th_${concurrentMsgId}` }] },
    };

    const makePollRequest = () =>
      POST(
        new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-service-key": GATEWAY_SECRET,
          },
          body: JSON.stringify({ tenantId: TENANT_A }),
        })
      );

    const [raceRes1, raceRes2] = await Promise.all([makePollRequest(), makePollRequest()]);
    const raceData1 = await raceRes1.json();
    const raceData2 = await raceRes2.json();

    const totalCreatedInRace = raceData1.summary.executionsCreated + raceData2.summary.executionsCreated;
    assert(totalCreatedInRace === 1, `Concurrent race condition: exactly 1 execution created across parallel requests (got ${totalCreatedInRace})`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 5: MULTI-TENANT ISOLATION & NO CROSS-TENANT CONTAMINATION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n📍 STEP 5: Multi-Tenant Isolation & Zero Leakage Verification\n");

    mockGoogleListMessagesResponse = null;
    dispatchedN8nEvents.length = 0;

    // Poll with no tenant filter (processes all active connections)
    const multiPollReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
    });

    const multiPollRes = await POST(multiPollReq);
    const multiPollData = await multiPollRes.json();

    assert(multiPollRes.status === 200, "Multi-tenant poll returns 200 status");
    assert(multiPollData.summary.connectionsChecked >= 2, "Multiple connections checked in single run");

    // Check that events sent to n8n have exact tenant mapping
    const bEvents = dispatchedN8nEvents.filter((e) => e.tenantId === TENANT_B);
    assert(bEvents.length > 0, "Tenant B generated an n8n event");
    for (const ev of bEvents) {
      assert(ev.tenantId === TENANT_B, "Event for Tenant B has tenantId === TENANT_B");
      assert(ev.emailAddress === "tenant-b-support@domain.test", "Tenant B email address preserved strictly");
      assert(!ev.emailAddress.includes(TENANT_A), "Zero Tenant A data in Tenant B event");
    }

    // Check that response contains zero tokens or secrets
    const responseString = JSON.stringify(multiPollData);
    assert(!responseString.includes("mock_access_token"), "Zero access tokens in poll API response");
    assert(!responseString.includes("mock_refresh_token"), "Zero refresh tokens in poll API response");
    assert(!responseString.includes(GATEWAY_SECRET), "Zero gateway secrets in poll API response");

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 6: TOKEN REFRESH, REVOCATION, AND RESILIENCY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n📍 STEP 6: Resiliency, Error Handling & Token Refresh Verification\n");

    // 1. Expired access token gets refreshed automatically
    await prisma.integrationConnection.update({
      where: { id: connA.id },
      data: { tokenExpiresAt: new Date(Date.now() - 1000) }, // Expired token
    });

    const refreshedMsgId = `msg_refreshed_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: refreshedMsgId, threadId: `th_${refreshedMsgId}` }] },
    };

    const refreshPollReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_A }),
    });

    const refreshPollRes = await POST(refreshPollReq);
    const refreshPollData = await refreshPollRes.json();
    assert(refreshPollRes.status === 200, "Poll on expired access token completes with 200");
    assert(refreshPollData.summary.messagesProcessed === 1, "Expired token automatically refreshed and message processed");

    // 2. Google API Error / Timeout resiliency
    mockGoogleListMessagesResponse = {
      status: 500,
      body: { error: { message: "Internal Google Error", code: 500 } },
    };

    const errPollReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_A }),
    });

    const errPollRes = await POST(errPollReq);
    const errPollData = await errPollRes.json();
    assert(errPollRes.status === 200, "Google API failure does not crash poll route (returns 200 with skipped)");
    assert(errPollData.summary.connectionsSkipped >= 1, "Connection recorded as skipped on Google API failure");

    // 3. n8n Support Webhook Failure Resiliency (restore token for this test)
    await prisma.integrationConnection.update({
      where: { id: connA.id },
      data: { tokenExpiresAt: new Date(Date.now() + 3600000), status: "CONNECTED" },
    });

    const n8nFailMsgId = `msg_n8n_fail_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: n8nFailMsgId, threadId: `th_${n8nFailMsgId}` }] },
    };
    simulateN8nNetworkError = true;

    const n8nFailReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_A }),
    });

    const n8nFailRes = await POST(n8nFailReq);
    const n8nFailData = await n8nFailRes.json();
    assert(n8nFailRes.status === 200, "n8n webhook network failure does not crash poll route");
    assert(n8nFailData.summary.executionsCreated === 1, "Execution created even if downstream n8n webhook timed out");
    simulateN8nNetworkError = false;

    // 4. Revoked Google Refresh Token
    mockGoogleTokenRefreshResponse = {
      status: 400,
      body: { error: "invalid_grant", error_description: "Token has been expired or revoked." },
    };
    await prisma.integrationConnection.update({
      where: { id: connA.id },
      data: { tokenExpiresAt: new Date(Date.now() - 1000), status: "CONNECTED" },
    });

    const revokedPollReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_A }),
    });

    const revokedPollRes = await POST(revokedPollReq);
    const revokedPollData = await revokedPollRes.json();
    assert(revokedPollRes.status === 200, "Revoked refresh token handled gracefully (returns 200)");
    assert(revokedPollData.summary.connectionsSkipped >= 1, "Connection skipped on revoked credentials");

    const updatedConnA = await prisma.integrationConnection.findUnique({
      where: { id: connA.id },
    });
    assert(updatedConnA?.status === "EXPIRED", "Connection status transitioned to EXPIRED on invalid_grant");
    mockGoogleTokenRefreshResponse = null;

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 7: BASELINE SYNCHRONIZATION AND HISTORICAL UNREAD SUPPRESSION (TESTS A-K)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n📍 STEP 7: Baseline Synchronization & Historical Unread Suppression (Tests A-K)\n");

    // Setup Tenant C Fixture (Dedicated baseline verification tenant)
    const userAutoC = await prisma.userAutomation.create({
      data: {
        clerkUserId: TENANT_C,
        automationId: sharedAuto.id,
        status: "ACTIVE",
        config: { autoReplyEnabled: true },
      },
    });
    createdRecordIds.userAutomations.push(userAutoC.id);

    const entitlementC = await prisma.automationEntitlement.create({
      data: {
        clerkUserId: TENANT_C,
        automationId: sharedAuto.id,
        userAutomationId: userAutoC.id,
        status: "ACTIVE",
        isLifetime: true,
        startsAt: new Date(),
        maintenanceStatus: "ACTIVE",
      },
    });
    createdRecordIds.entitlements.push(entitlementC.id);

    const encC = vaultEncrypt("mock_access_token_c");
    const encRefC = vaultEncrypt("mock_refresh_token_c");

    const connC = await prisma.integrationConnection.create({
      data: {
        clerkUserId: TENANT_C,
        provider: "GOOGLE",
        providerAccountId: `google_account_c_${TEST_TIMESTAMP}`,
        accountEmail: "tenant-c-support@domain.test",
        accountName: "Tenant C Support",
        status: "CONNECTED",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        accessTokenEncrypted: encC.encryptedValue,
        accessTokenIv: encC.iv,
        accessTokenAuthTag: encC.authTag,
        refreshTokenEncrypted: encRefC.encryptedValue,
        refreshTokenIv: encRefC.iv,
        refreshTokenAuthTag: encRefC.authTag,
        tokenExpiresAt: new Date(Date.now() + 3600000),
      },
    });
    createdRecordIds.connections.push(connC.id);

    const bindingC = await prisma.userAutomationIntegration.create({
      data: {
        userAutomationId: userAutoC.id,
        integrationConnectionId: connC.id,
        role: "gmail",
      },
    });

    const tenantCBaseline = bindingC.createdAt;
    const baselineSecs = Math.floor(tenantCBaseline.getTime() / 1000);

    // ── Test 1: Upstream Query Filter contains after:<baselineSeconds>
    capturedGmailQueries.length = 0;
    mockGoogleListMessagesResponse = { status: 200, body: { messages: [] } };
    const queryCheckReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_C }),
    });
    await POST(queryCheckReq);
    assert(capturedGmailQueries.length > 0, "Upstream Gmail API query was dispatched");
    assert(
      capturedGmailQueries.some((q) => q.includes(`after:${baselineSecs}`) && q.includes("is:unread label:INBOX")),
      `Upstream Gmail query contains 'after:${baselineSecs}' and 'is:unread label:INBOX' (got: ${capturedGmailQueries[0]})`
    );

    // ── Test A, C, D, E: Existing unread messages before baseline are ignored
    const oldMsgId = `msg_pre_baseline_${TEST_TIMESTAMP}`;
    const oldThreadId = `th_old_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: oldMsgId, threadId: oldThreadId }] },
    };
    mockGoogleGetMessageResponse = {
      status: 200,
      body: {
        id: oldMsgId,
        threadId: oldThreadId,
        // Received 2 hours before baseline was established
        internalDate: String(tenantCBaseline.getTime() - 7200000),
        snippet: "Old unread email before baseline",
        payload: { headers: [{ name: "Date", value: new Date(tenantCBaseline.getTime() - 7200000).toUTCString() }] },
      },
    };
    dispatchedN8nEvents.length = 0;

    const oldMsgReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_C }),
    });
    const oldMsgRes = await POST(oldMsgReq);
    const oldMsgData = await oldMsgRes.json();

    assert(oldMsgRes.status === 200, "Test A: Polling completed with status 200 for pre-baseline message");
    assert(oldMsgData.summary.messagesSkippedBaseline === 1, "Test A: Existing unread message before baseline is safely ignored (messagesSkippedBaseline = 1)");
    assert(oldMsgData.summary.executionsCreated === 0, "Test C: Old unread message cannot create an AutomationExecution (executionsCreated = 0)");
    assert(oldMsgData.summary.n8nDispatched === 0, "Test E: Old unread message is not dispatched to n8n (n8nDispatched = 0)");

    // Verify DB: No execution or grant was created for old message
    const oldExecCheck = await prisma.automationExecution.findFirst({
      where: { clerkUserId: TENANT_C },
    });
    assert(oldExecCheck === null, "Test C (DB): Zero AutomationExecution records in database for pre-baseline message");

    const oldGrantCheck = await prisma.automationExecutionGrant.findFirst({
      where: { clerkUserId: TENANT_C },
    });
    assert(oldGrantCheck === null, "Test D (DB): Zero ExecutionGrant records minted for pre-baseline message");
    assert(dispatchedN8nEvents.length === 0, "Test E (Events): Zero events reached n8n webhook for old unread email");

    // ── Test K: Re-running polling after baseline does NOT accidentally convert historical messages
    const rePollOldReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_C }),
    });
    const rePollOldRes = await POST(rePollOldReq);
    const rePollOldData = await rePollOldRes.json();

    assert(rePollOldData.summary.messagesSkippedBaseline === 1, "Test K: Re-running poll keeps historical unread email safely skipped");
    assert(rePollOldData.summary.executionsCreated === 0, "Test K: Re-running poll creates ZERO executions for historical unread email");
    assert(rePollOldData.summary.n8nDispatched === 0, "Test K: Re-running poll sends ZERO n8n dispatches for historical unread email");

    // ── Test B & F: Newly received unread message AFTER baseline follows normal flow
    const newMsgId = `msg_post_baseline_${TEST_TIMESTAMP}`;
    const newThreadId = `th_new_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: newMsgId, threadId: newThreadId }] },
    };
    mockGoogleGetMessageResponse = {
      status: 200,
      body: {
        id: newMsgId,
        threadId: newThreadId,
        // Received 5 minutes after baseline was established
        internalDate: String(tenantCBaseline.getTime() + 300000),
        snippet: "Fresh customer question after connection",
        payload: { headers: [{ name: "Date", value: new Date(tenantCBaseline.getTime() + 300000).toUTCString() }] },
      },
    };
    dispatchedN8nEvents.length = 0;

    const newMsgReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_C }),
    });
    const newMsgRes = await POST(newMsgReq);
    const newMsgData = await newMsgRes.json();

    assert(newMsgRes.status === 200, "Test B: Poll response 200 for post-baseline message");
    assert(newMsgData.summary.messagesSkippedBaseline === 0, "Test B: Post-baseline message is eligible and NOT skipped");
    assert(newMsgData.summary.executionsCreated === 1, "Test B: Exactly 1 AutomationExecution created for post-baseline message");
    assert(newMsgData.summary.n8nDispatched === 1, "Test F: Post-baseline message successfully dispatched to n8n");

    // Verify DB & Grant for post-baseline message
    const newExecCheck = await prisma.automationExecution.findFirst({
      where: { clerkUserId: TENANT_C, status: "QUEUED" },
      include: { executionGrants: true },
    });
    assert(!!newExecCheck, "Test F (DB): AutomationExecution created in QUEUED status for eligible message");
    assert(newExecCheck?.executionGrants.length === 1, "Test F (DB): Exactly 1 ExecutionGrant minted");
    assert(
      newExecCheck?.executionGrants[0].allowedCapability === "SUPPORT_AI",
      "Test F (DB): ExecutionGrant possesses SUPPORT_AI allowedCapability"
    );
    assert(dispatchedN8nEvents.length === 1, "Test F (Events): Exactly 1 event received by n8n");
    assert(dispatchedN8nEvents[0].emailId === newMsgId, "Test F (Events): Event emailId strictly matches new message ID");
    assert(dispatchedN8nEvents[0].tenantId === TENANT_C, "Test F (Events): Event tenantId strictly matches Tenant C");

    // ── Test G: Re-polling post-baseline message does not create duplicates
    dispatchedN8nEvents.length = 0;
    const rePollNewReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_C }),
    });
    const rePollNewRes = await POST(rePollNewReq);
    const rePollNewData = await rePollNewRes.json();

    assert(rePollNewData.summary.executionsCreated === 0, "Test G: Re-polling does not create duplicate execution");
    assert(rePollNewData.summary.n8nDispatched === 0, "Test G: Re-polling does not send duplicate n8n event");
    assert(dispatchedN8nEvents.length === 0, "Test G (Events): Zero events dispatched on duplicate poll");

    // ── Test H: Concurrent polling on post-baseline message creates exactly one execution
    const concurrentMsgIdC = `msg_concurrent_c_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: concurrentMsgIdC, threadId: `th_${concurrentMsgIdC}` }] },
    };
    mockGoogleGetMessageResponse = {
      status: 200,
      body: {
        id: concurrentMsgIdC,
        threadId: `th_${concurrentMsgIdC}`,
        internalDate: String(tenantCBaseline.getTime() + 600000),
      },
    };

    const makeConcurrentPoll = () =>
      POST(
        new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-service-key": GATEWAY_SECRET,
          },
          body: JSON.stringify({ tenantId: TENANT_C }),
        })
      );

    const [cRes1, cRes2] = await Promise.all([makeConcurrentPoll(), makeConcurrentPoll()]);
    const cData1 = await cRes1.json();
    const cData2 = await cRes2.json();
    const totalConcurrentExecs = cData1.summary.executionsCreated + cData2.summary.executionsCreated;
    assert(
      totalConcurrentExecs === 1,
      `Test H: Concurrent polling creates exactly 1 execution under race conditions (got ${totalConcurrentExecs})`
    );

    // ── Test J: OAuth token refresh does NOT reset the polling baseline
    const beforeConnC = await prisma.integrationConnection.findUnique({
      where: { id: connC.id },
    });
    const originalCreatedAt = beforeConnC?.createdAt.getTime();

    // Force token expiration on Tenant C
    await prisma.integrationConnection.update({
      where: { id: connC.id },
      data: { tokenExpiresAt: new Date(Date.now() - 1000) },
    });

    // Provide a pre-baseline message; poll should automatically refresh token, but still skip old message!
    const oldMsgPostRefresh = `msg_old_after_refresh_${TEST_TIMESTAMP}`;
    mockGoogleListMessagesResponse = {
      status: 200,
      body: { messages: [{ id: oldMsgPostRefresh, threadId: `th_${oldMsgPostRefresh}` }] },
    };
    mockGoogleGetMessageResponse = {
      status: 200,
      body: {
        id: oldMsgPostRefresh,
        threadId: `th_${oldMsgPostRefresh}`,
        internalDate: String(tenantCBaseline.getTime() - 1800000), // 30 mins before baseline
      },
    };

    const tokenRefreshPollReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
      body: JSON.stringify({ tenantId: TENANT_C }),
    });
    const tokenRefreshPollRes = await POST(tokenRefreshPollReq);
    const tokenRefreshPollData = await tokenRefreshPollRes.json();

    assert(tokenRefreshPollRes.status === 200, "Test J: Poll completes successfully after automatic token refresh");
    assert(
      tokenRefreshPollData.summary.messagesSkippedBaseline === 1,
      "Test J: Pre-baseline email is STILL safely skipped after OAuth token refresh"
    );
    assert(
      tokenRefreshPollData.summary.executionsCreated === 0,
      "Test J: Zero executions created after token refresh for pre-baseline email"
    );

    const afterConnC = await prisma.integrationConnection.findUnique({
      where: { id: connC.id },
    });
    assert(
      afterConnC?.createdAt.getTime() === originalCreatedAt,
      "Test J: IntegrationConnection createdAt remains strictly immutable across token refreshes"
    );

    // ── Test I: Multiple tenants remain isolated under baseline logic
    const userAutoD = await prisma.userAutomation.create({
      data: {
        clerkUserId: TENANT_D,
        automationId: sharedAuto.id,
        status: "ACTIVE",
        config: { autoReplyEnabled: true },
      },
    });
    createdRecordIds.userAutomations.push(userAutoD.id);

    const entitlementD = await prisma.automationEntitlement.create({
      data: {
        clerkUserId: TENANT_D,
        automationId: sharedAuto.id,
        userAutomationId: userAutoD.id,
        status: "ACTIVE",
        isLifetime: true,
        startsAt: new Date(),
        maintenanceStatus: "ACTIVE",
      },
    });
    createdRecordIds.entitlements.push(entitlementD.id);

    const encD = vaultEncrypt("mock_access_token_d");
    const encRefD = vaultEncrypt("mock_refresh_token_d");

    const connD = await prisma.integrationConnection.create({
      data: {
        clerkUserId: TENANT_D,
        provider: "GOOGLE",
        providerAccountId: `google_account_d_${TEST_TIMESTAMP}`,
        accountEmail: "tenant-d-support@domain.test",
        accountName: "Tenant D Support",
        status: "CONNECTED",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        accessTokenEncrypted: encD.encryptedValue,
        accessTokenIv: encD.iv,
        accessTokenAuthTag: encD.authTag,
        refreshTokenEncrypted: encRefD.encryptedValue,
        refreshTokenIv: encRefD.iv,
        refreshTokenAuthTag: encRefD.authTag,
        tokenExpiresAt: new Date(Date.now() + 3600000),
      },
    });
    createdRecordIds.connections.push(connD.id);

    await prisma.userAutomationIntegration.create({
      data: {
        userAutomationId: userAutoD.id,
        integrationConnectionId: connD.id,
        role: "gmail",
      },
    });

    // Reset mocks for multi-tenant run
    mockGoogleListMessagesResponse = null;
    mockGoogleGetMessageResponse = null;
    dispatchedN8nEvents.length = 0;

    const multiTenantReq = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": GATEWAY_SECRET,
      },
    });
    const multiTenantRes = await POST(multiTenantReq);
    const multiTenantData = await multiTenantRes.json();

    assert(multiTenantRes.status === 200, "Test I: Multi-tenant poll returns 200 status");
    const dEvents = dispatchedN8nEvents.filter((e) => e.tenantId === TENANT_D);
    assert(dEvents.length > 0, "Test I: Tenant D received dispatched n8n event");
    for (const dEv of dEvents) {
      assert(dEv.emailAddress === "tenant-d-support@domain.test", "Test I: Tenant D event contains Tenant D email address");
      assert(!dEv.emailAddress.includes(TENANT_C), "Test I: Zero Tenant C data leaked into Tenant D event");
    }

  } finally {
    // ─────────────────────────────────────────────────────────────────────────────
    // CLEANUP SYNTHETIC FIXTURES
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n🧹 Cleaning up synthetic test fixtures...");
    restoreFetch();

    try {
      await prisma.automationGatewayOperation.deleteMany({
        where: { clerkUserId: { in: [TENANT_A, TENANT_B, TENANT_C, TENANT_D] } },
      });
      await prisma.automationExecutionGrant.deleteMany({
        where: { clerkUserId: { in: [TENANT_A, TENANT_B, TENANT_C, TENANT_D] } },
      });
      await prisma.automationExecution.deleteMany({
        where: { clerkUserId: { in: [TENANT_A, TENANT_B, TENANT_C, TENANT_D] } },
      });
      await prisma.userAutomationIntegration.deleteMany({
        where: { integrationConnectionId: { in: createdRecordIds.connections } },
      });
      await prisma.integrationConnection.deleteMany({
        where: { id: { in: createdRecordIds.connections } },
      });
      await prisma.automationEntitlement.deleteMany({
        where: { clerkUserId: { in: [TENANT_A, TENANT_B, TENANT_C, TENANT_D] } },
      });
      await prisma.userAutomation.deleteMany({
        where: { id: { in: createdRecordIds.userAutomations } },
      });
      await prisma.automation.deleteMany({
        where: { id: { in: createdRecordIds.automations } },
      });
      console.log("  ✅ Synthetic test fixtures cleaned up successfully.\n");
    } catch (cleanupErr: any) {
      console.error("  ⚠️ Error during fixture cleanup:", cleanupErr?.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("======================================================================");
  console.log(`  TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
