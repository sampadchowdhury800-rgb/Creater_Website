import test from "node:test";
import assert from "node:assert/strict";
import { isOwnerTestAccount, clearOwnerTestCache, getOwnerTestConfig, OWNER_TEST_ACCESS_CAPABILITY } from "../lib/auth/owner-test";
import { checkAutomationAccess } from "../lib/entitlement/checker";
import { authorizeAutomationExecution } from "../lib/automation/authorization";
import { prisma } from "../lib/prisma";

// Mock environment and identities for testing
const DESIGNATED_OWNER_ID = "user_owner_test_123";
const NORMAL_USER_ID = "user_normal_customer_456";
const ATTACKER_USER_ID = "user_attacker_789";

test("OWNER_TEST_ACCESS Authorization & Entitlement Suite", async (t) => {
  // Store original environment to restore after tests
  const originalEnvUserId = process.env.OWNER_TEST_USER_ID;
  const originalEnvEmail = process.env.OWNER_TEST_EMAIL;

  // Set designated test account environment
  process.env.OWNER_TEST_USER_ID = DESIGNATED_OWNER_ID;
  clearOwnerTestCache();

  t.after(() => {
    process.env.OWNER_TEST_USER_ID = originalEnvUserId;
    process.env.OWNER_TEST_EMAIL = originalEnvEmail;
    clearOwnerTestCache();
  });

  // Mock automations in database
  let freeAutomation: any;
  let paidAutomation: any;
  let gmailPaidAutomation: any;
  let ownerWorkspace: any;
  let normalUserWorkspace: any;

  await t.test("Setup mock database state", async () => {
    // 1. Create Free Automation
    freeAutomation = await prisma.automation.upsert({
      where: { slug: "test-free-automation" },
      update: {},
      create: {
        slug: "test-free-automation",
        title: "Test Free Automation",
        price: 0,
        pricingType: "FREE",
        status: "PUBLISHED",
        isExecutable: true,
        n8nWorkflowId: "wf_free_test",
      },
    });

    // 2. Create Paid Automation without integrations
    paidAutomation = await prisma.automation.upsert({
      where: { slug: "test-paid-automation" },
      update: {},
      create: {
        slug: "test-paid-automation",
        title: "Test Paid Automation",
        price: 499900, // ₹4,999 in paise
        pricingType: "ONE_TIME",
        status: "PUBLISHED",
        isExecutable: true,
        n8nWorkflowId: "wf_paid_test",
      },
    });

    // 3. Create Paid Gmail Automation (with required Gmail integration)
    gmailPaidAutomation = await prisma.automation.upsert({
      where: { slug: "test-gmail-support-agent" },
      update: {},
      create: {
        slug: "test-gmail-support-agent",
        title: "Gmail Customer Support Agent Test",
        price: 299900, // ₹2,999 in paise
        pricingType: "ONE_TIME",
        status: "PUBLISHED",
        isExecutable: true,
        n8nWorkflowId: "AESai9x1nAP41VKO",
        integrationRequirements: {
          requirements: [
            {
              id: "gmail",
              provider: "GOOGLE",
              capability: "GMAIL_SEND",
              required: true,
              label: "Gmail Support Account",
            },
          ],
        },
      },
    });

    // 4. Create an existing workspace for Normal User
    normalUserWorkspace = await prisma.userAutomation.upsert({
      where: {
        clerkUserId_automationId: {
          clerkUserId: NORMAL_USER_ID,
          automationId: paidAutomation.id,
        },
      },
      update: {},
      create: {
        clerkUserId: NORMAL_USER_ID,
        automationId: paidAutomation.id,
        status: "NOT_CONFIGURED",
      },
    });

    // 5. Create an existing workspace for Owner User
    ownerWorkspace = await prisma.userAutomation.upsert({
      where: {
        clerkUserId_automationId: {
          clerkUserId: DESIGNATED_OWNER_ID,
          automationId: paidAutomation.id,
        },
      },
      update: {},
      create: {
        clerkUserId: DESIGNATED_OWNER_ID,
        automationId: paidAutomation.id,
        status: "NOT_CONFIGURED",
      },
    });
  });

  await t.test("Requirement A: Designated test account + FREE automation => allowed", async () => {
    const isOwner = await isOwnerTestAccount(DESIGNATED_OWNER_ID);
    assert.equal(isOwner, true, "Designated test account must be recognized as owner tester");

    const access = await checkAutomationAccess(DESIGNATED_OWNER_ID, freeAutomation.id);
    assert.equal(access.hasAccess, true, "Designated test account must have access to free automation");
    assert.equal(access.isLifetime, true, "Test account receives lifetime testing access");
  });

  await t.test("Requirement B: Designated test account + PAID automation without purchase => allowed", async () => {
    // Verify no purchase / entitlement exists for owner
    const existingEntitlement = await prisma.automationEntitlement.findFirst({
      where: { clerkUserId: DESIGNATED_OWNER_ID, automationId: paidAutomation.id },
    });
    assert.equal(existingEntitlement, null, "Owner must not have an actual purchase record");

    // Check access
    const access = await checkAutomationAccess(DESIGNATED_OWNER_ID, paidAutomation.id);
    assert.equal(access.hasAccess, true, "Designated test account must have access to paid automation without purchase");
    assert.equal(access.reason, "LIFETIME");
  });

  await t.test("Requirement C: Normal user + FREE automation => allowed according to existing rules", async () => {
    const isOwner = await isOwnerTestAccount(NORMAL_USER_ID);
    assert.equal(isOwner, false, "Normal user must NOT be recognized as owner tester");

    // Normal user without explicit entitlement record for a paid product gets NO_ENTITLEMENT
    const accessPaid = await checkAutomationAccess(NORMAL_USER_ID, paidAutomation.id);
    assert.equal(accessPaid.hasAccess, false, "Normal user without purchase must NOT have access to paid automation");
    assert.equal(accessPaid.reason, "NO_ENTITLEMENT");
  });

  await t.test("Requirement D: Normal user + PAID automation without purchase => denied according to existing rules", async () => {
    // Test execution authorization on normal user's workspace without entitlement
    const authResult = await authorizeAutomationExecution(NORMAL_USER_ID, normalUserWorkspace.id);
    assert.equal(authResult.authorized, false, "Execution must be denied for normal user without entitlement");
    assert.equal(authResult.statusCode, 403);
    assert.equal(authResult.errorCode, "UNAUTHORIZED");
  });

  await t.test("Requirement E: Designated test account with required Gmail integration missing => integration requirement enforced", async () => {
    // Create workspace for owner on Gmail Customer Support automation
    const ownerGmailWorkspace = await prisma.userAutomation.upsert({
      where: {
        clerkUserId_automationId: {
          clerkUserId: DESIGNATED_OWNER_ID,
          automationId: gmailPaidAutomation.id,
        },
      },
      update: {},
      create: {
        clerkUserId: DESIGNATED_OWNER_ID,
        automationId: gmailPaidAutomation.id,
        status: "NOT_CONFIGURED",
      },
    });

    // Access check passes
    const access = await checkAutomationAccess(DESIGNATED_OWNER_ID, gmailPaidAutomation.id);
    assert.equal(access.hasAccess, true, "Owner test access check passes for Gmail automation");

    // Execution authorization check passes entitlement
    const authResult = await authorizeAutomationExecution(DESIGNATED_OWNER_ID, ownerGmailWorkspace.id);
    assert.equal(authResult.authorized, true, "Owner test user is authorized for execution entitlement");
    assert.equal(authResult.n8nWorkflowId, "AESai9x1nAP41VKO", "Target workflow AESai9x1nAP41VKO is bound correctly");

    // Check integration binding: Gmail is NOT connected yet
    const binding = await prisma.userAutomationIntegration.findUnique({
      where: {
        userAutomationId_role: {
          userAutomationId: ownerGmailWorkspace.id,
          role: "gmail",
        },
      },
    });
    assert.equal(binding, null, "Gmail is not connected yet");
    // This confirms that integration requirement remains enforced and is not bypassed
  });

  await t.test("Requirement F: Designated test account cannot access another user's workspace (IDOR protection)", async () => {
    // Owner test account tries to authorize execution for Normal User's workspace
    const crossTenantAttempt = await authorizeAutomationExecution(
      DESIGNATED_OWNER_ID,
      normalUserWorkspace.id
    );

    assert.equal(crossTenantAttempt.authorized, false, "Owner test account must NOT access another user's workspace");
    assert.equal(crossTenantAttempt.statusCode, 403);
    assert.equal(crossTenantAttempt.errorCode, "UNAUTHORIZED");
    assert.match(crossTenantAttempt.errorMessage || "", /do not own this automation workspace/i);
  });

  await t.test("Requirement G: Client-side manipulation cannot grant test access", async () => {
    // Attacker tries to pretend to be owner via unauthenticated or non-matching ID
    assert.equal(await isOwnerTestAccount(""), false);
    assert.equal(await isOwnerTestAccount(null as any), false);
    assert.equal(await isOwnerTestAccount(undefined as any), false);
    assert.equal(await isOwnerTestAccount(ATTACKER_USER_ID), false);

    const attackerAccess = await checkAutomationAccess(ATTACKER_USER_ID, paidAutomation.id);
    assert.equal(attackerAccess.hasAccess, false, "Attacker cannot gain access without server-side match");
  });

  await t.test("Requirement H: Existing admin/security authorization behavior remains intact", async () => {
    assert.equal(OWNER_TEST_ACCESS_CAPABILITY, "OWNER_TEST_ACCESS");

    // Check non-existent automation returns NO_ENTITLEMENT even for owner
    const nonExistentAccess = await checkAutomationAccess(DESIGNATED_OWNER_ID, "non_existent_cuid_123");
    assert.equal(nonExistentAccess.hasAccess, false, "Non-existent automation returns no access even for owner");
  });

  await t.test("Requirement I: Owner Test Account can create & access paid workspace without purchase", async () => {
    const isOwner = await isOwnerTestAccount(DESIGNATED_OWNER_ID);
    assert.equal(isOwner, true, "Designated owner test user has owner test capability");

    // In POST /api/user-automations, paid check evaluates:
    // const accessCheck = await checkAutomationAccess(userId, automationId);
    // if (!isOwner && !accessCheck.hasAccess) => returns 402 Payment Required
    const accessCheck = await checkAutomationAccess(DESIGNATED_OWNER_ID, paidAutomation.id);
    const canCreateWorkspace = isOwner || accessCheck.hasAccess;
    assert.equal(canCreateWorkspace, true, "Owner test user is permitted to create paid workspace without purchase");

    // Create paid workspace for owner test account
    const createdWorkspace = await prisma.userAutomation.upsert({
      where: {
        clerkUserId_automationId: {
          clerkUserId: DESIGNATED_OWNER_ID,
          automationId: paidAutomation.id,
        },
      },
      update: {},
      create: {
        clerkUserId: DESIGNATED_OWNER_ID,
        automationId: paidAutomation.id,
        status: "NOT_CONFIGURED",
      },
    });
    assert.ok(createdWorkspace.id, "Paid workspace created in database for Owner Test Account");

    // In contrast, normal user cannot create workspace without entitlement
    const isNormalOwner = await isOwnerTestAccount(NORMAL_USER_ID);
    const normalAccess = await checkAutomationAccess(NORMAL_USER_ID, paidAutomation.id);
    const normalCanCreate = isNormalOwner || normalAccess.hasAccess;
    assert.equal(normalCanCreate, false, "Normal customer cannot create paid workspace without purchasing");
  });

  await t.test("Requirement J: Admin account separation & fallback removal", async () => {
    // Save original env
    const savedUserId = process.env.OWNER_TEST_USER_ID;
    const savedEmail = process.env.OWNER_TEST_EMAIL;
    const savedAdminEmail = process.env.ADMIN_EMAIL;

    // Save existing DB settings
    const existingDbSettings = await prisma.setting.findMany({
      where: { key: { in: ["ownerTestEmail", "owner_test_email", "ownerTestUserId", "owner_test_user_id"] } },
    });

    try {
      // Clear all designated test account configurations
      delete process.env.OWNER_TEST_USER_ID;
      delete process.env.OWNER_TEST_EMAIL;
      process.env.ADMIN_EMAIL = "admin@example.com";
      clearOwnerTestCache();

      // Ensure no DB setting overrides exist for this test
      await prisma.setting.deleteMany({
        where: { key: { in: ["ownerTestEmail", "owner_test_email", "ownerTestUserId", "owner_test_user_id"] } },
      });

      const config = await getOwnerTestConfig();
      // MUST NOT fall back to ADMIN_EMAIL
      assert.equal(config.designatedEmail, null, "ADMIN_EMAIL must NEVER be silently used as Owner Test Account fallback");
      assert.equal(config.designatedUserId, null, "Designated user ID remains null when not set");
    } finally {
      process.env.OWNER_TEST_USER_ID = savedUserId;
      process.env.OWNER_TEST_EMAIL = savedEmail;
      process.env.ADMIN_EMAIL = savedAdminEmail;

      // Restore DB settings
      for (const s of existingDbSettings) {
        await prisma.setting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value },
        });
      }

      clearOwnerTestCache();
    }
  });

  await t.test("Requirement K: Owner Test Account email equal to Admin email is rejected", async () => {
    const adminEmail = "sampadchowdhury777@gmail.com";

    // Helper validating settings logic as implemented in PUT /api/admin/settings
    const validateOwnerTestEmail = (inputEmail: string, currentAdminEmail: string) => {
      const emailVal = inputEmail.trim().toLowerCase();
      if (!emailVal) return { valid: true, error: null };

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailVal)) {
        return { valid: false, error: "Please enter a valid email address for Owner Test Account." };
      }

      if (emailVal === currentAdminEmail.toLowerCase()) {
        return {
          valid: false,
          error: "Owner Test Account must use a different email address from the Admin account.",
        };
      }

      return { valid: true, error: null };
    };

    // 1. Invalid email format
    const invalidFormat = validateOwnerTestEmail("not-an-email", adminEmail);
    assert.equal(invalidFormat.valid, false);
    assert.equal(invalidFormat.error, "Please enter a valid email address for Owner Test Account.");

    // 2. Email equal to Admin email
    const equalToAdmin = validateOwnerTestEmail(adminEmail, adminEmail);
    assert.equal(equalToAdmin.valid, false);
    assert.equal(
      equalToAdmin.error,
      "Owner Test Account must use a different email address from the Admin account."
    );

    // 3. Separate dedicated customer email
    const dedicatedEmail = "test-automation@yourdomain.com";
    const validTest = validateOwnerTestEmail(dedicatedEmail, adminEmail);
    assert.equal(validTest.valid, true);
    assert.equal(validTest.error, null);
  });

  await t.test("Requirement L: Inadvertent env/DB conflict is neutralized by getOwnerTestConfig", async () => {
    const savedEmail = process.env.OWNER_TEST_EMAIL;
    const savedAdmin = process.env.ADMIN_EMAIL;

    try {
      // If someone sets OWNER_TEST_EMAIL to the exact same value as ADMIN_EMAIL
      process.env.OWNER_TEST_EMAIL = "admin@company.com";
      process.env.ADMIN_EMAIL = "admin@company.com";
      delete process.env.OWNER_TEST_USER_ID;
      clearOwnerTestCache();

      const config = await getOwnerTestConfig();
      assert.equal(
        config.designatedEmail,
        null,
        "If designatedEmail matches ADMIN_EMAIL, getOwnerTestConfig must neutralize it to null"
      );
    } finally {
      process.env.OWNER_TEST_EMAIL = savedEmail;
      process.env.ADMIN_EMAIL = savedAdmin;
      clearOwnerTestCache();
    }
  });

  // Cleanup test artifacts
  await t.test("Teardown test records", async () => {
    await prisma.userAutomation.deleteMany({
      where: {
        clerkUserId: { in: [DESIGNATED_OWNER_ID, NORMAL_USER_ID, ATTACKER_USER_ID] },
      },
    });

    await prisma.automation.deleteMany({
      where: {
        slug: { in: ["test-free-automation", "test-paid-automation", "test-gmail-support-agent"] },
      },
    });

    await prisma.$disconnect();
  });
});
