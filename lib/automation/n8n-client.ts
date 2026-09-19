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

export class N8nHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly workflowId: string;
  readonly safeDetails?: string;

  constructor(status: number, statusText: string, workflowId: string, safeDetails?: string) {
    super(
      `n8n execution request failed with HTTP ${status} (${statusText}) for workflow ID ${workflowId}.`
    );
    this.name = "N8nHttpError";
    this.status = status;
    this.statusText = statusText;
    this.workflowId = workflowId;
    this.safeDetails = safeDetails;
  }
}

/**
 * Strips potential tokens, passwords, and secret keys from raw error snippets
 * before technical server logging.
 */
function sanitizeErrorDetail(raw: string): string {
  return raw
    .slice(0, 300)
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(api[-_]?key\s*[:=]\s*)[^\s&,;]+/gi, "$1[REDACTED]")
    .replace(/(password\s*[:=]\s*)[^\s&,;]+/gi, "$1[REDACTED]")
    .replace(/(secret\s*[:=]\s*)[^\s&,;]+/gi, "$1[REDACTED]")
    .replace(/(token\s*[:=]\s*)[^\s&,;]+/gi, "$1[REDACTED]");
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

      let safeDetails: string | undefined;
      try {
        const errText = await response.text();
        if (errText) {
          try {
            const parsed = JSON.parse(errText);
            const msg =
              typeof parsed?.message === "string"
                ? parsed.message
                : typeof parsed?.error === "string"
                ? parsed.error
                : errText;
            safeDetails = sanitizeErrorDetail(msg);
          } catch {
            safeDetails = sanitizeErrorDetail(errText);
          }
        }
      } catch {
        // Failed to read response body; omit details
      }

      // Log technical details server-side only. Never log N8N_API_KEY or credentials.
      console.error(
        `[n8n] Workflow execution failed: HTTP ${status} ${statusText} | workflowId="${workflowId}"${safeDetails ? ` | details="${safeDetails}"` : ""}`
      );

      throw new N8nHttpError(status, statusText, workflowId, safeDetails);
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
