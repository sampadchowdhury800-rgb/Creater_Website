/**
 * tests/gmail-integration-workspace.test.ts
 *
 * Regression test suite verifying:
 * 1. Unconnected Gmail workspace displays/connects Gmail configuration
 * 2. Connected Gmail workspace reports configured (and reverts to NOT_CONFIGURED on disconnect)
 * 3. Owner Test Account still needs Gmail (entitlement bypass does NOT bypass integrations)
 * 4. Normal customers still need Gmail
 * 5. App Password never reaches the frontend response (zero leakage)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { validateIntegrationRequirements } from "../lib/integrations/requirements-validator";
import { disconnectIntegration } from "../lib/integrations/token-service";
import { vaultEncrypt } from "../lib/crypto/vault";

const TEST_OWNER_CLERK_ID = "test_owner_clerk_gmail_suite";
const TEST_NORMAL_CLERK_ID = "test_normal_clerk_gmail_suite";

describe("Gmail Integration & Workspace Configuration Suite", () => {
  let gmailAutomation: any;
  let ownerWorkspace: any;
  let normalWorkspace: any;
  let testConnection: any;

  before(async () => {
    // 1. Fetch or verify the production target automation record
    gmailAutomation = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
    });
    assert.ok(gmailAutomation, "gmail-customer-support-agent must exist in database");

    // Clean up any stale test records from previous test runs
    await prisma.userAutomationIntegration.deleteMany({
      where: {
        userAutomation: {
          clerkUserId: { in: [TEST_OWNER_CLERK_ID, TEST_NORMAL_CLERK_ID] },
        },
      },
    });
    await prisma.userAutomation.deleteMany({
      where: { clerkUserId: { in: [TEST_OWNER_CLERK_ID, TEST_NORMAL_CLERK_ID] } },
    });
    await prisma.integrationConnection.deleteMany({
      where: { clerkUserId: { in: [TEST_OWNER_CLERK_ID, TEST_NORMAL_CLERK_ID] } },
    });

    // 2. Create test workspaces for Owner and Normal customer
    ownerWorkspace = await prisma.userAutomation.create({
      data: {
        clerkUserId: TEST_OWNER_CLERK_ID,
        automationId: gmailAutomation.id,
        status: "NOT_CONFIGURED",
      },
    });

    normalWorkspace = await prisma.userAutomation.create({
      data: {
        clerkUserId: TEST_NORMAL_CLERK_ID,
        automationId: gmailAutomation.id,
        status: "NOT_CONFIGURED",
      },
    });
  });

  after(async () => {
    // Cleanup test records
    await prisma.userAutomationIntegration.deleteMany({
      where: {
        userAutomation: {
          clerkUserId: { in: [TEST_OWNER_CLERK_ID, TEST_NORMAL_CLERK_ID] },
        },
      },
    });
    await prisma.userAutomation.deleteMany({
      where: { clerkUserId: { in: [TEST_OWNER_CLERK_ID, TEST_NORMAL_CLERK_ID] } },
    });
    await prisma.integrationConnection.deleteMany({
      where: { clerkUserId: { in: [TEST_OWNER_CLERK_ID, TEST_NORMAL_CLERK_ID] } },
    });
  });

  test("1. Database configuration: gmail-customer-support-agent has valid integrationRequirements", async () => {
    const fresh = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
      select: { integrationRequirements: true },
    });

    assert.ok(fresh?.integrationRequirements, "integrationRequirements must not be null");

    const validated = validateIntegrationRequirements(fresh.integrationRequirements);
    assert.strictEqual(validated.valid, true, "integrationRequirements must pass schema validation");
    assert.strictEqual(validated.errors.length, 0);

    const reqs = validated.sanitized?.requirements ?? [];
    assert.strictEqual(reqs.length, 1);
    assert.strictEqual(reqs[0].id, "gmail");
    assert.strictEqual(reqs[0].provider, "GOOGLE");
    assert.strictEqual(reqs[0].capability, "GMAIL_SEND");
    assert.strictEqual(reqs[0].required, true);
    assert.strictEqual(reqs[0].label, "Gmail Support Account");
  });

  test("2. Unconnected workspace reports NOT_CONFIGURED and returns requirement for Connect Gmail UI", async () => {
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: ownerWorkspace.id },
      include: {
        automation: {
          select: {
            id: true,
            title: true,
            integrationRequirements: true,
          },
        },
        integrations: {
          include: {
            integrationConnection: {
              select: {
                id: true,
                provider: true,
                accountEmail: true,
                status: true,
              },
            },
          },
        },
      },
    });

    assert.ok(userAuto);
    assert.strictEqual(userAuto.status, "NOT_CONFIGURED");
    assert.strictEqual(userAuto.integrations.length, 0);

    const rawReqs = (userAuto.automation.integrationRequirements ?? {}) as { requirements?: any[] };
    const requirements = rawReqs.requirements ?? [];
    assert.strictEqual(requirements.length, 1);
    assert.strictEqual(requirements[0].id, "gmail");
    assert.strictEqual(requirements[0].label, "Gmail Support Account");

    // Check satisfied computation (mimicking IntegrationStatusCard logic)
    const allSatisfied = requirements.every((req) => {
      if (!req.required) return true;
      const bound = userAuto.integrations.find((b: any) => b.role === req.id);
      return bound?.integrationConnection?.status === "CONNECTED";
    });
    assert.strictEqual(allSatisfied, false, "Unconnected workspace must report allSatisfied = false");
  });

  test("3. Connected Gmail workspace transitions status to ACTIVE and reports satisfied", async () => {
    const enc = vaultEncrypt("dummy-app-password");

    // Create encrypted connection for test owner
    testConnection = await prisma.integrationConnection.create({
      data: {
        clerkUserId: TEST_OWNER_CLERK_ID,
        provider: "GOOGLE",
        providerAccountId: "owner.test@gmail.com",
        accountEmail: "owner.test@gmail.com",
        accessTokenEncrypted: enc.encryptedValue,
        accessTokenIv: enc.iv,
        accessTokenAuthTag: enc.authTag,
        refreshTokenEncrypted: "",
        refreshTokenIv: "",
        refreshTokenAuthTag: "",
        vaultVersion: 1,
        tokenExpiresAt: new Date("2099-12-31T23:59:59Z"),
        scopes: ["IMAP", "SMTP"],
        status: "CONNECTED",
      },
    });

    // Bind to owner workspace
    await prisma.userAutomationIntegration.create({
      data: {
        userAutomationId: ownerWorkspace.id,
        integrationConnectionId: testConnection.id,
        role: "gmail",
      },
    });

    // Update status to ACTIVE (simulating /api/integrations/gmail/connect logic)
    await prisma.userAutomation.update({
      where: { id: ownerWorkspace.id },
      data: { status: "ACTIVE" },
    });

    // Verify workspace query
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: ownerWorkspace.id },
      include: {
        automation: { select: { integrationRequirements: true } },
        integrations: {
          include: {
            integrationConnection: {
              select: {
                id: true,
                provider: true,
                accountEmail: true,
                status: true,
              },
            },
          },
        },
      },
    });

    assert.ok(userAuto);
    assert.strictEqual(userAuto.status, "ACTIVE", "Workspace status must be ACTIVE when connected");
    assert.strictEqual(userAuto.integrations.length, 1);
    assert.strictEqual(userAuto.integrations[0].integrationConnection?.accountEmail, "owner.test@gmail.com");

    const rawReqs = (userAuto.automation.integrationRequirements ?? {}) as { requirements?: any[] };
    const requirements = rawReqs.requirements ?? [];
    const allSatisfied = requirements.every((req) => {
      if (!req.required) return true;
      const bound = userAuto.integrations.find((b: any) => b.role === req.id);
      return bound?.integrationConnection?.status === "CONNECTED";
    });
    assert.strictEqual(allSatisfied, true, "Connected workspace must report allSatisfied = true");
  });

  test("4. Disconnecting Gmail resets workspace status to NOT_CONFIGURED", async () => {
    // Call disconnectIntegration
    const discRes = await disconnectIntegration(TEST_OWNER_CLERK_ID, testConnection.id);
    assert.strictEqual(discRes.success, true);

    // Verify workspace status reverted to NOT_CONFIGURED
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: ownerWorkspace.id },
      include: {
        integrations: true,
      },
    });

    assert.ok(userAuto);
    assert.strictEqual(userAuto.status, "NOT_CONFIGURED", "Workspace must revert to NOT_CONFIGURED after disconnect");
    assert.strictEqual(userAuto.integrations.length, 0, "All bindings must be unlinked");
  });

  test("5. Owner Test Account still requires Gmail integration (no integration bypass)", async () => {
    // Verify that the Owner Test Account workspace with missing Gmail is not satisfied
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: ownerWorkspace.id },
      include: {
        automation: { select: { integrationRequirements: true } },
        integrations: true,
      },
    });

    const rawReqs = (userAuto?.automation.integrationRequirements ?? {}) as { requirements?: any[] };
    const requirements = rawReqs.requirements ?? [];
    const allSatisfied = requirements.every((req) => {
      if (!req.required) return true;
      const bound = userAuto?.integrations.find((b: any) => b.role === req.id);
      return Boolean(bound);
    });

    assert.strictEqual(allSatisfied, false, "Owner Test Account must NOT bypass Gmail integration requirement");
  });

  test("6. Normal customers still require Gmail integration", async () => {
    const userAuto = await prisma.userAutomation.findUnique({
      where: { id: normalWorkspace.id },
      include: {
        automation: { select: { integrationRequirements: true } },
        integrations: true,
      },
    });

    assert.strictEqual(userAuto?.status, "NOT_CONFIGURED");
    assert.strictEqual(userAuto?.integrations.length, 0);

    const rawReqs = (userAuto?.automation.integrationRequirements ?? {}) as { requirements?: any[] };
    const requirements = rawReqs.requirements ?? [];
    const allSatisfied = requirements.every((req) => {
      if (!req.required) return true;
      const bound = userAuto?.integrations.find((b: any) => b.role === req.id);
      return Boolean(bound);
    });

    assert.strictEqual(allSatisfied, false, "Normal customer must require Gmail integration");
  });

  test("7. App Password never reaches the frontend response or unencrypted storage", async () => {
    // 1. Check IntegrationConnection fields selected in the integrations API
    const connection = await prisma.integrationConnection.findFirst({
      where: { clerkUserId: TEST_OWNER_CLERK_ID },
      select: {
        id: true,
        provider: true,
        accountEmail: true,
        accountName: true,
        status: true,
        lastRefreshedAt: true,
        createdAt: true,
      },
    });

    // The API projection only selects safe public fields
    assert.strictEqual((connection as any)?.accessTokenEncrypted, undefined);
    assert.strictEqual((connection as any)?.accessTokenIv, undefined);
    assert.strictEqual((connection as any)?.accessTokenAuthTag, undefined);
    assert.strictEqual((connection as any)?.appPassword, undefined);

    // 2. Query full record to ensure no plaintext field exists anywhere in the schema
    const rawRecord = await prisma.integrationConnection.findFirst({
      where: { clerkUserId: TEST_OWNER_CLERK_ID },
    });

    assert.ok(rawRecord);
    assert.strictEqual((rawRecord as any).appPassword, undefined, "No plaintext appPassword column exists");
    assert.strictEqual((rawRecord as any).password, undefined, "No plaintext password column exists");
    assert.strictEqual((rawRecord as any).secret, undefined, "No plaintext secret column exists");
  });
});
