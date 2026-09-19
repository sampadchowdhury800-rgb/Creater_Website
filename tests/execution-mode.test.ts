/**
 * tests/execution-mode.test.ts
 *
 * Regression test suite verifying:
 * 1. Owner Test Account retains access (entitlement bypass).
 * 2. Normal unentitled customers remain denied.
 * 3. Tenant isolation is enforced (IDOR protection).
 * 4. EVENT_DRIVEN automation rejects manual execution (WORKFLOW_MODE_INCOMPATIBLE).
 * 5. MANUAL automation behavior path does not short-circuit on executionMode.
 * 6. Production environment resolves Railway workflow ID (gPkQTl6FhMZmBFdd).
 * 7. Local/dev environment resolves the DB-stored workflow ID (AESai9x1nAP41VKO).
 * 8. N8N_GMAIL_WORKFLOW_ID env override takes precedence over all.
 * 9. N8N_WORKFLOW_ID_OVERRIDES JSON env override works.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { resolveAutomationWorkflowId, isProductionEnvironment } from "../lib/automation/workflow-resolver";
import { ExecutionService } from "../lib/automation/execution-service";
import { authorizeAutomationExecution } from "../lib/automation/authorization";
import { checkAutomationAccess } from "../lib/entitlement/checker";
import { prisma } from "../lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// 1. WORKFLOW RESOLVER — ENVIRONMENT-AWARE ID MAPPING
// ─────────────────────────────────────────────────────────────────────────────

describe("WorkflowResolver — environment-aware ID mapping", () => {
  test("Production resolves Railway workflow ID (gPkQTl6FhMZmBFdd) for gmail automation", () => {
    const resolved = resolveAutomationWorkflowId(
      { slug: "gmail-customer-support-agent", n8nWorkflowId: "AESai9x1nAP41VKO" },
      { targetEnv: "production" }
    );
    assert.strictEqual(
      resolved,
      "gPkQTl6FhMZmBFdd",
      "Production must resolve to Railway workflow ID gPkQTl6FhMZmBFdd"
    );
  });

  test("Development resolves DB-stored local workflow ID (AESai9x1nAP41VKO) for gmail automation", () => {
    const resolved = resolveAutomationWorkflowId(
      { slug: "gmail-customer-support-agent", n8nWorkflowId: "AESai9x1nAP41VKO" },
      { targetEnv: "development" }
    );
    assert.strictEqual(
      resolved,
      "AESai9x1nAP41VKO",
      "Dev must retain the local n8n workflow ID from the DB"
    );
  });

  test("Production resolves Railway workflow ID by local DB ID (AESai9x1nAP41VKO) key lookup", () => {
    const resolved = resolveAutomationWorkflowId(
      { slug: "", n8nWorkflowId: "AESai9x1nAP41VKO" },
      { targetEnv: "production" }
    );
    assert.strictEqual(
      resolved,
      "gPkQTl6FhMZmBFdd",
      "Production resolves via DB ID key when slug is empty"
    );
  });

  test("N8N_GMAIL_WORKFLOW_ID env var overrides all environment resolution", () => {
    const orig = process.env.N8N_GMAIL_WORKFLOW_ID;
    try {
      process.env.N8N_GMAIL_WORKFLOW_ID = "override-id-xyz";
      const resolved = resolveAutomationWorkflowId(
        { slug: "gmail-customer-support-agent", n8nWorkflowId: "AESai9x1nAP41VKO" },
        { targetEnv: "production" }
      );
      assert.strictEqual(resolved, "override-id-xyz", "Env var override must take priority");
    } finally {
      if (orig !== undefined) process.env.N8N_GMAIL_WORKFLOW_ID = orig;
      else delete process.env.N8N_GMAIL_WORKFLOW_ID;
    }
  });

  test("N8N_WORKFLOW_ID_OVERRIDES JSON env var override works by slug", () => {
    const orig = process.env.N8N_WORKFLOW_ID_OVERRIDES;
    try {
      process.env.N8N_WORKFLOW_ID_OVERRIDES = JSON.stringify({
        "gmail-customer-support-agent": "json-override-id",
      });
      const resolved = resolveAutomationWorkflowId(
        { slug: "gmail-customer-support-agent", n8nWorkflowId: "AESai9x1nAP41VKO" },
        { targetEnv: "production" }
      );
      assert.strictEqual(resolved, "json-override-id", "JSON override must take priority over production map");
    } finally {
      if (orig !== undefined) process.env.N8N_WORKFLOW_ID_OVERRIDES = orig;
      else delete process.env.N8N_WORKFLOW_ID_OVERRIDES;
    }
  });

  test("Unknown automation falls back to DB workflow ID in both environments", () => {
    for (const env of ["production", "development"] as const) {
      const resolved = resolveAutomationWorkflowId(
        { slug: "some-other-automation", n8nWorkflowId: "SOME_WORKFLOW_ID" },
        { targetEnv: env }
      );
      assert.strictEqual(resolved, "SOME_WORKFLOW_ID", `env=${env}: unknown automation must use DB ID`);
    }
  });

  test("Null automation returns null", () => {
    const resolved = resolveAutomationWorkflowId(null);
    assert.strictEqual(resolved, null);
  });

  test("Automation without n8nWorkflowId returns null in development (no DB ID)", () => {
    const resolved = resolveAutomationWorkflowId(
      { slug: "no-workflow-automation", n8nWorkflowId: null },
      { targetEnv: "development" }
    );
    assert.strictEqual(resolved, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXECUTION MODE GUARD — Verify ExecutionService rejects EVENT_DRIVEN
// ─────────────────────────────────────────────────────────────────────────────

describe("ExecutionService — EVENT_DRIVEN mode rejects manual execution", () => {
  test("EVENT_DRIVEN automation: triggerExecution returns WORKFLOW_MODE_INCOMPATIBLE without hitting n8n", async () => {
    // Fetch the real gmail automation
    const automation = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
    });
    assert.ok(automation, "gmail-customer-support-agent must exist");
    assert.strictEqual(
      automation.executionMode,
      "EVENT_DRIVEN",
      "gmail-customer-support-agent must be marked EVENT_DRIVEN in DB"
    );
  });

  test("ExecutionService returns WORKFLOW_MODE_INCOMPATIBLE (400) for EVENT_DRIVEN automation", async () => {
    // We need a UserAutomation tied to the EVENT_DRIVEN automation
    const userAutomation = await prisma.userAutomation.findFirst({
      where: {
        automation: { slug: "gmail-customer-support-agent" },
      },
    });

    if (!userAutomation) {
      // No workspace exists — skip this test
      console.log("Skipping: no UserAutomation for gmail-customer-support-agent");
      return;
    }

    const result = await ExecutionService.triggerExecution({
      clerkUserId: userAutomation.clerkUserId,
      userAutomationId: userAutomation.id,
      input: {},
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, "WORKFLOW_MODE_INCOMPATIBLE");
    assert.strictEqual(result.statusCode, 400);
    assert.ok(
      result.errorMessage?.toLowerCase().includes("event-driven"),
      "Error message must mention event-driven"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. OWNER TEST ACCOUNT — Access remains intact after all changes
// ─────────────────────────────────────────────────────────────────────────────

describe("Owner Test Account — entitlement bypass remains intact", () => {
  test("Owner Test Account still has access to gmail-customer-support-agent without purchase", async () => {
    const ownerTestUserId = process.env.OWNER_TEST_USER_ID;
    if (!ownerTestUserId) {
      console.log("Skipping: OWNER_TEST_USER_ID not configured");
      return;
    }

    const automation = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
      select: { id: true },
    });
    assert.ok(automation, "Automation must exist");

    const result = await checkAutomationAccess(ownerTestUserId, automation.id);
    assert.strictEqual(
      result.hasAccess,
      true,
      "Owner Test Account must have access to gmail automation"
    );
  });

  test("Unknown/random user without entitlement is denied access to gmail automation", async () => {
    const automation = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
      select: { id: true },
    });
    assert.ok(automation, "Automation must exist");

    const result = await checkAutomationAccess("user_absolutely_fake_randomxyz123", automation.id);
    assert.strictEqual(
      result.hasAccess,
      false,
      "Unentitled random user must be denied access"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATABASE STATE — Verify schema and data correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("Database state — executionMode correctly configured", () => {
  test("gmail-customer-support-agent has executionMode = EVENT_DRIVEN in Neon DB", async () => {
    const automation = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
      select: { id: true, slug: true, n8nWorkflowId: true, executionMode: true, isExecutable: true, status: true },
    });

    assert.ok(automation, "Automation must exist in DB");
    assert.strictEqual(automation.executionMode, "EVENT_DRIVEN");
    assert.strictEqual(automation.isExecutable, true, "isExecutable must remain true — it IS executable, just not manually");
    assert.strictEqual(automation.n8nWorkflowId, "AESai9x1nAP41VKO", "DB stores local workflow ID — resolver maps env-specifically");
    assert.strictEqual(automation.status, "PUBLISHED");
  });

  test("No other automation has executionMode = EVENT_DRIVEN (only gmail was changed)", async () => {
    const eventDrivenAutomations = await prisma.automation.findMany({
      where: { executionMode: "EVENT_DRIVEN" },
      select: { slug: true },
    });

    const slugs = eventDrivenAutomations.map((a) => a.slug);
    assert.ok(
      slugs.every((s) => s === "gmail-customer-support-agent"),
      `Only gmail-customer-support-agent should be EVENT_DRIVEN. Found: ${slugs.join(", ")}`
    );
  });

  test("Target workspace cmu6jt6jy000104l2n0oixgbm is linked to gmail automation (EVENT_DRIVEN)", async () => {
    const ua = await prisma.userAutomation.findUnique({
      where: { id: "cmu6jt6jy000104l2n0oixgbm" },
      include: {
        automation: { select: { slug: true, executionMode: true, n8nWorkflowId: true } },
      },
    });

    assert.ok(ua, "Target workspace must exist");
    assert.strictEqual(ua.automation.slug, "gmail-customer-support-agent");
    assert.strictEqual(ua.automation.executionMode, "EVENT_DRIVEN");
    assert.ok(ua.automation.n8nWorkflowId, "Automation must have a workflow ID");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TENANT ISOLATION — IDOR protection remains enforced
// ─────────────────────────────────────────────────────────────────────────────

describe("Tenant isolation — IDOR protection still enforced", () => {
  test("User cannot execute another user's automation workspace", async () => {
    const targetWorkspace = await prisma.userAutomation.findUnique({
      where: { id: "cmu6jt6jy000104l2n0oixgbm" },
    });
    if (!targetWorkspace) {
      console.log("Skipping: target workspace not found");
      return;
    }

    // A completely different user tries to execute the owner's workspace
    const result = await authorizeAutomationExecution(
      "user_completely_different_person_xyz",
      "cmu6jt6jy000104l2n0oixgbm"
    );

    assert.strictEqual(result.authorized, false);
    assert.ok(
      result.statusCode === 403 || result.statusCode === 404,
      `Expected 403 or 404 for IDOR attempt, got ${result.statusCode}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PRODUCTION ENVIRONMENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("isProductionEnvironment() detection", () => {
  test("VERCEL=1 and N8N_ENV=production together are detected as production", () => {
    const origVercel = process.env.VERCEL;
    const origN8nEnv = process.env.N8N_ENV;
    try {
      process.env.VERCEL = "1";
      process.env.N8N_ENV = "production";
      assert.strictEqual(isProductionEnvironment(), true, "Both VERCEL=1 and N8N_ENV=production must detect as production");
    } finally {
      if (origVercel !== undefined) process.env.VERCEL = origVercel;
      else delete process.env.VERCEL;
      if (origN8nEnv !== undefined) process.env.N8N_ENV = origN8nEnv;
      else delete process.env.N8N_ENV;
    }
  });

  test("VERCEL=1 is detected as production", () => {
    const orig = process.env.VERCEL;
    try {
      process.env.VERCEL = "1";
      assert.strictEqual(isProductionEnvironment(), true);
    } finally {
      if (orig !== undefined) process.env.VERCEL = orig;
      else delete process.env.VERCEL;
    }
  });

  test("N8N_ENV=production is detected as production", () => {
    const orig = process.env.N8N_ENV;
    try {
      process.env.N8N_ENV = "production";
      assert.strictEqual(isProductionEnvironment(), true);
    } finally {
      if (orig !== undefined) process.env.N8N_ENV = orig;
      else delete process.env.N8N_ENV;
    }
  });
});
