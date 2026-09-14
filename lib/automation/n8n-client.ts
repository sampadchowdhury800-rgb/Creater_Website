/**
 * N8nClient — server-side only abstraction for communicating with n8n.
 *
 * SECURITY:
 * - Reads credentials only from process.env (never from client-supplied values).
 * - n8n API key is never returned to the browser or included in API responses.
 * - If N8N_BASE_URL or N8N_API_KEY are not set, throws a safe error.
 * - The caller (ExecutionService) converts this to a sanitized 503 response.
 *
 * ARCHITECTURE:
 * - All n8n communication is isolated here so n8n can be swapped later.
 * - Workflow IDs are resolved server-side from the Automation DB record.
 *   The browser never supplies workflowId directly.
 *
 * N8N_BASE_URL    — e.g. "https://n8n.yourserver.com"  (server env only)
 * N8N_API_KEY     — e.g. "eyJhbGci..."                 (server env only)
 *
 * NEVER use NEXT_PUBLIC_ prefix for these variables.
 */

import { env } from "@/lib/env";

export interface N8nTriggerResult {
  externalExecutionId: string | null;
  output: Record<string, unknown> | null;
  finished: boolean;
}

export class N8nConfigurationError extends Error {
  constructor() {
    super("Execution engine is not configured.");
    this.name = "N8nConfigurationError";
  }
}

export class N8nClient {
  /**
   * Triggers a workflow execution on n8n via the Workflow trigger endpoint.
   *
   * Uses the n8n REST API:
   * POST /api/v1/workflows/{workflowId}/execute
   *
   * Or if using a webhook trigger:
   * POST /webhook/{webhookPath}
   *
   * The workflow ID comes from the server-side Automation.n8nWorkflowId field —
   * it is NEVER accepted from the client request body.
   */
  static async triggerWorkflow(
    workflowId: string,
    payload: Record<string, unknown>
  ): Promise<N8nTriggerResult> {
    const baseUrl = env.N8N_BASE_URL;
    const apiKey = env.N8N_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new N8nConfigurationError();
    }

    // Strip trailing slash from base URL
    const base = baseUrl.replace(/\/$/, "");

    const response = await fetch(`${base}/api/v1/workflows/${workflowId}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // n8n API authentication — server-side only, never exposed to browser
        "X-N8N-API-KEY": apiKey,
      },
      body: JSON.stringify({ data: payload }),
    });

    if (!response.ok) {
      const statusText = response.statusText || "Unknown error";
      const status = response.status;

      // Log technical details server-side only
      console.error(`[n8n] Workflow execution failed: HTTP ${status} ${statusText}`);

      throw new Error(`n8n execution request failed with status ${status}.`);
    }

    let responseData: Record<string, unknown> = {};
    try {
      responseData = (await response.json()) as Record<string, unknown>;
    } catch {
      // Response body is optional for some n8n trigger modes
    }

    // n8n returns finished: true only when execution completes synchronously.
    const isFinished = responseData.finished === true;

    return {
      externalExecutionId:
        typeof responseData.executionId === "string"
          ? responseData.executionId
          : typeof responseData.id === "string"
          ? responseData.id
          : null,
      output: responseData ?? null,
      finished: isFinished,
    };
  }
}
