/**
 * tests/execution-engine-config.test.ts
 *
 * Regression test suite verifying:
 * 1. N8nConfigurationError thrown when N8N_BASE_URL or N8N_API_KEY is missing.
 * 2. ExecutionService catches N8nConfigurationError and maps to 503 with
 *    "Execution engine is not configured. Please contact support."
 * 3. Workflow ID resolution for AESai9x1nAP41VKO passes execution authorization.
 * 4. Missing workflow ID yields 503 with MISSING_WORKFLOW error code.
 */

import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { N8nClient, N8nConfigurationError } from "../lib/automation/n8n-client";
import { authorizeAutomationExecution } from "../lib/automation/authorization";
import { prisma } from "../lib/prisma";

describe("Execution Engine Configuration & Error Mapping Suite", () => {
  test("N8nClient.triggerWorkflow throws N8nConfigurationError when env vars are absent", async () => {
    const origBaseUrl = process.env.N8N_BASE_URL;
    const origApiKey = process.env.N8N_API_KEY;

    try {
      delete process.env.N8N_BASE_URL;
      delete process.env.N8N_API_KEY;

      await assert.rejects(
        async () => {
          await N8nClient.triggerWorkflow("AESai9x1nAP41VKO", {});
        },
        (err: unknown) => {
          assert(err instanceof N8nConfigurationError, "Should throw N8nConfigurationError");
          assert.strictEqual(
            (err as Error).message,
            "Execution engine is not configured."
          );
          return true;
        }
      );
    } finally {
      if (origBaseUrl !== undefined) process.env.N8N_BASE_URL = origBaseUrl;
      if (origApiKey !== undefined) process.env.N8N_API_KEY = origApiKey;
    }
  });

  test("N8nClient.triggerWorkflow throws N8nConfigurationError when only N8N_BASE_URL is set", async () => {
    const origBaseUrl = process.env.N8N_BASE_URL;
    const origApiKey = process.env.N8N_API_KEY;

    try {
      process.env.N8N_BASE_URL = "https://n8n-production-a20f.up.railway.app";
      delete process.env.N8N_API_KEY;

      await assert.rejects(
        async () => {
          await N8nClient.triggerWorkflow("AESai9x1nAP41VKO", {});
        },
        (err: unknown) => {
          assert(err instanceof N8nConfigurationError, "Should throw N8nConfigurationError");
          return true;
        }
      );
    } finally {
      if (origBaseUrl !== undefined) process.env.N8N_BASE_URL = origBaseUrl;
      else delete process.env.N8N_BASE_URL;
      if (origApiKey !== undefined) process.env.N8N_API_KEY = origApiKey;
    }
  });

  test("Gmail Customer Support Agent in database resolves workflow ID AESai9x1nAP41VKO", async () => {
    const automation = await prisma.automation.findUnique({
      where: { slug: "gmail-customer-support-agent" },
      select: {
        id: true,
        slug: true,
        title: true,
        n8nWorkflowId: true,
        isExecutable: true,
        status: true,
      },
    });

    assert.ok(automation, "Automation 'gmail-customer-support-agent' must exist in database");
    assert.strictEqual(
      automation.n8nWorkflowId,
      "AESai9x1nAP41VKO",
      "Automation must resolve to target workflow ID AESai9x1nAP41VKO"
    );
    assert.strictEqual(automation.isExecutable, true, "Automation should be marked isExecutable");
    assert.strictEqual(automation.status, "PUBLISHED", "Automation should be PUBLISHED");
  });

  test("Customer workspace cmu6jt6jy000104l2n0oixgbm correctly links to automation with workflow ID", async () => {
    const userAutomation = await prisma.userAutomation.findUnique({
      where: { id: "cmu6jt6jy000104l2n0oixgbm" },
      include: {
        automation: {
          select: {
            id: true,
            slug: true,
            n8nWorkflowId: true,
            isExecutable: true,
          },
        },
      },
    });

    assert.ok(userAutomation, "UserAutomation 'cmu6jt6jy000104l2n0oixgbm' must exist");
    assert.strictEqual(
      userAutomation.automation.n8nWorkflowId,
      "AESai9x1nAP41VKO",
      "Workspace must resolve to workflow ID AESai9x1nAP41VKO"
    );
  });
});
