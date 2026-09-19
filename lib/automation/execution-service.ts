/**
 * ExecutionService — orchestrates the full secure automation execution pipeline.
 *
 * PIPELINE:
 *   Client → POST /api/automation-executions
 *     → getCurrentUserId() [Clerk auth]
 *     → Rate limit check [F1: user + IP + concurrent cap]
 *     → ExecutionService.triggerExecution()
 *       → rejectControlPlaneKeys()          [F4: block control-plane injection]
 *       → validateInputLimits()             [F2: structural size limits]
 *       → authorizeAutomationExecution()    [ownership + entitlement check]
 *       → stripUnknownInputKeys()           [F4: whitelist to schema keys only]
 *       → validateExecutionInput()          [schema validation]
 *       → Create AutomationExecution DB record (QUEUED → RUNNING)
 *       → N8nClient.triggerWorkflow()       [server-side n8n call]
 *       → sanitizeExecutionOutput()         [F3: persistence-time sanitization]
 *       → Update record (COMPLETED / FAILED)
 *       → Return sanitized result
 *
 * SECURITY:
 * - workflowId is resolved server-side from the Automation DB record.
 * - Client NEVER supplies workflowId — it only supplies userAutomationId + input.
 * - Control-plane keys (workflowId, clerkUserId, etc.) are rejected at the gate.
 * - Unknown input keys are stripped before schema validation and n8n dispatch.
 * - Error messages returned to client are always sanitized.
 * - Raw n8n errors, DB errors, and stack traces are logged server-side only.
 * - n8n output is sanitized before DB write AND again at response time.
 *
 * RATE LIMITING: [F1]
 * Rate limiting is applied in the route handler BEFORE this service is called.
 * See: app/api/automation-executions/route.ts
 * The rate limiter uses the existing centralized IP utility (lib/security/ip-utils.ts).
 */

import { prisma } from "@/lib/prisma";
import { authorizeAutomationExecution } from "./authorization";
import {
  validateExecutionInput,
  validateInputLimits,
  rejectControlPlaneKeys,
  stripUnknownInputKeys,
} from "./validation";
import { N8nClient, N8nConfigurationError, N8nHttpError } from "./n8n-client";
import {
  getDecryptedSecretsForExecution,
  maskSensitiveInput,
} from "./vault-service";
import { sanitizeExecutionOutput } from "./output-sanitizer";
import { validateIntegrationRequirements } from "@/lib/integrations/requirements-validator";
import { getCapabilityDefinition, hasRequiredScopes } from "@/lib/integrations/registry";
import { mintExecutionGrant } from "@/lib/integrations/grant-service";
import type { SupportedGoogleCapability } from "@/lib/integrations/types";


export interface TriggerExecutionInput {
  clerkUserId: string | null | undefined;
  userAutomationId: string;
  input?: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  execution?: {
    id: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  };
  errorCode?: string;
  errorMessage?: string;
  statusCode: number;
}

export class ExecutionService {
  static async triggerExecution({
    clerkUserId,
    userAutomationId,
    input,
  }: TriggerExecutionInput): Promise<ExecutionResult> {
    const rawInput = input ?? {};

    // ─── Step 1: Block control-plane key injection (F4) ───────────────────────
    // Must run before any other processing — client must never supply reserved keys.
    const cpCheck = rejectControlPlaneKeys(rawInput);
    if (!cpCheck.clean) {
      // Log the offending key internally but do not expose it in the response
      console.warn(
        `[ExecutionService] Control-plane key injection attempt: key="${cpCheck.offendingKey}", userId=${clerkUserId?.slice(0, 8) ?? "anon"}...`
      );
      return {
        success: false,
        errorCode: "BAD_REQUEST",
        errorMessage: "Invalid execution input.",
        statusCode: 400,
      };
    }

    // ─── Step 2: Structural size limits (F2) ──────────────────────────────────
    // Validates key count, string length, array length, object depth.
    const limitsResult = validateInputLimits(rawInput);
    if (!limitsResult.valid) {
      return {
        success: false,
        errorCode: "BAD_REQUEST",
        errorMessage: limitsResult.errorMessage ?? "Input exceeds size limits.",
        statusCode: 400,
      };
    }

    // ─── Step 3: Authorization ────────────────────────────────────────────────
    const authResult = await authorizeAutomationExecution(clerkUserId, userAutomationId);
    if (!authResult.authorized) {
      return {
        success: false,
        errorCode: authResult.errorCode,
        errorMessage: authResult.errorMessage,
        statusCode: authResult.statusCode,
      };
    }

    const { userAutomation, n8nWorkflowId } = authResult;
    const automation = userAutomation.automation;

    // ─── Step 3b: Execution Mode Guard (EVENT_DRIVEN vs MANUAL) ───────────────
    // EVENT_DRIVEN automations run automatically upon incoming events (e.g. Gmail
    // polling/webhooks) and must never enter the generic manual execution pipeline.
    if (automation.executionMode === "EVENT_DRIVEN") {
      return {
        success: false,
        errorCode: "WORKFLOW_MODE_INCOMPATIBLE",
        errorMessage:
          "This automation is event-driven and runs automatically when incoming events arrive. Manual execution is not supported.",
        statusCode: 400,
      };
    }

    // ─── Step 4: Strip unknown input keys to schema whitelist (F4) ────────────
    // The configSchema is loaded from the DB (trusted). Keys not in the schema
    // are silently dropped — the client cannot inject arbitrary fields into n8n.
    const cleanInput = stripUnknownInputKeys(automation.configSchema, rawInput);

    // ─── Step 5: Schema validation ────────────────────────────────────────────
    const validationResult = validateExecutionInput(automation.configSchema, cleanInput);
    if (!validationResult.valid) {
      return {
        success: false,
        errorCode: "INVALID_INPUT",
        errorMessage: validationResult.errorMessage ?? "Invalid execution input.",
        statusCode: 400,
      };
    }

    // ─── Step 5b: Integration Requirements Validation ─────────────────────────
    const reqValidation = validateIntegrationRequirements(automation.integrationRequirements);
    if (!reqValidation.valid) {
      console.error(
        `[ExecutionService] Malformed integrationRequirements on automationId=${automation.id}:`,
        reqValidation.errors
      );
      return {
        success: false,
        errorCode: "INTEGRATION_ERROR",
        errorMessage: "Automation integration configuration is invalid.",
        statusCode: 500,
      };
    }

    const requirements = reqValidation.sanitized?.requirements ?? [];
    let activeConnectionId: string | null = null;
    let activeCapability: SupportedGoogleCapability | null = null;

    for (const req of requirements) {
      const binding = await prisma.userAutomationIntegration.findUnique({
        where: {
          userAutomationId_role: {
            userAutomationId,
            role: req.id,
          },
        },
        include: {
          integrationConnection: true,
        },
      });

      if (!binding || !binding.integrationConnection) {
        if (req.required) {
          return {
            success: false,
            errorCode: "MISSING_INTEGRATION",
            errorMessage: `Required integration "${req.label}" is not connected.`,
            statusCode: 400,
          };
        }
        continue;
      }

      const connection = binding.integrationConnection;

      // Strict tenant ownership
      if (connection.clerkUserId !== clerkUserId) {
        return {
          success: false,
          errorCode: "UNAUTHORIZED",
          errorMessage: "Integration connection does not belong to the authenticated user.",
          statusCode: 403,
        };
      }

      // Connection status check
      if (connection.status !== "CONNECTED") {
        return {
          success: false,
          errorCode: "CONNECTION_EXPIRED",
          errorMessage: `Integration "${req.label}" is ${connection.status.toLowerCase()}. Reconnection required.`,
          statusCode: 400,
        };
      }

      // Permission / Scope check
      const capDef = getCapabilityDefinition(req.capability);
      if (!capDef || !hasRequiredScopes(connection.scopes, capDef.requiredScopes)) {
        return {
          success: false,
          errorCode: "CAPABILITY_NOT_ALLOWED",
          errorMessage: `Integration "${req.label}" does not have required permissions for ${req.capability}.`,
          statusCode: 403,
        };
      }

      if (!activeConnectionId) {
        activeConnectionId = connection.id;
        activeCapability = req.capability as SupportedGoogleCapability;
      }
    }

    // ─── Step 6: Create Execution Record (QUEUED) ─────────────────────────────
    // SECURITY: Mask sensitive fields before persisting to DB.
    // Plaintext credentials must never appear in AutomationExecution.input.
    const maskedInput = maskSensitiveInput(cleanInput, automation.configSchema);

    let execution = await prisma.automationExecution.create({
      data: {
        userAutomationId,
        clerkUserId: clerkUserId!,
        status: "QUEUED",
        input: maskedInput as any,
      },
    });

    // ─── Step 7: Mark as RUNNING ──────────────────────────────────────────────
    execution = await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // ─── Step 8: Dispatch to n8n ──────────────────────────────────────────────
    try {
      // Mint single-use ephemeral execution grant if integration requirement exists
      let primaryGrantToken: string | undefined = undefined;
      if (activeConnectionId && activeCapability) {
        const grant = await mintExecutionGrant({
          clerkUserId: clerkUserId!,
          userAutomationId,
          automationExecutionId: execution.id,
          integrationConnectionId: activeConnectionId,
          allowedCapability: activeCapability,
        });
        primaryGrantToken = grant.rawGrantToken;
      }

      // Decrypt vault secrets in-memory for this execution only.
      // These are merged into the n8n payload and are NEVER written back to any DB column.
      // They exist in server memory only for the duration of this request.
      let decryptedSecrets: Record<string, string> = {};
      try {
        decryptedSecrets = await getDecryptedSecretsForExecution(userAutomationId);
      } catch (vaultErr) {
        // If decryption fails (wrong key, tampering), abort execution safely.
        console.error("[ExecutionService] Vault decryption failed:", vaultErr instanceof Error ? vaultErr.message : vaultErr);
        throw new Error("Credential decryption failed. Please reconfigure your sensitive credentials.");
      }

      // Merge: whitelisted + schema-validated input + decrypted secrets + single-use grant → n8n payload.
      // decryptedSecrets overrides any placeholder values in cleanInput for sensitive fields.
      // cleanInput has already had unknown keys stripped — no arbitrary client JSON here.
      // Google OAuth access & refresh tokens are NEVER included here.
      const dispatchInput = {
        ...cleanInput,
        ...decryptedSecrets,
        ...(primaryGrantToken ? { executionGrant: primaryGrantToken } : {}),
      };

      const n8nResult = await N8nClient.triggerWorkflow(n8nWorkflowId!, {
        userAutomationId,
        automationId: automation.id,
        automationSlug: automation.slug,
        input: dispatchInput,
      });

      // ─── Step 9: Sanitize n8n output before DB persistence (F3) ────────────
      // NEVER store raw n8n output — it may contain internal metadata, node names,
      // or credential echoes from misconfigured workflows.
      const { output: sanitizedOutput, truncated } = sanitizeExecutionOutput(
        n8nResult.output
      );
      if (truncated) {
        console.warn(
          `[ExecutionService] n8n output truncated for execution in userAutomationId=${userAutomationId}`
        );
      }

      // ARCHITECTURAL RULE: Successful HTTP dispatch to n8n does NOT equal "COMPLETED".
      // An execution is marked RUNNING upon dispatch and preserved with its externalExecutionId.
      // It is only marked COMPLETED if n8n explicitly returns finished: true synchronously.
      const isFinished = n8nResult.finished === true;
      const finalStatus = isFinished ? "COMPLETED" : "RUNNING";

      execution = await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: finalStatus,
          completedAt: isFinished ? new Date() : null,
          externalExecutionId: n8nResult.externalExecutionId,
          // Store sanitized output only — raw n8n output is never persisted
          output: sanitizedOutput as any,
        },
      });

      return {
        success: true,
        execution: {
          id: execution.id,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          createdAt: execution.createdAt,
        },
        statusCode: 200,
      };
    } catch (err: unknown) {
      const error = err as Error;
      let sanitizedError: string;
      let statusCode = 500;

      // Map known error types to sanitized messages
      if (error instanceof N8nConfigurationError) {
        sanitizedError = "Execution engine is not configured. Please contact support.";
        statusCode = 503;
      } else if (error instanceof N8nHttpError) {
        console.error(
          `[ExecutionService] n8n HTTP execution failed: status=${error.status}, workflowId="${error.workflowId}", details="${error.safeDetails || "none"}"`
        );
        sanitizedError =
          "Automation execution engine is currently unreachable or rejected the request. Please try again later.";
        statusCode = error.status >= 500 ? 502 : 400;
      } else {
        // Log real error server-side, return generic message to client
        console.error("[ExecutionService] Execution failed:", error);
        sanitizedError = "Automation execution is temporarily unavailable. Please try again.";
      }

      // ─── Step 10: Mark as FAILED ────────────────────────────────────────────
      execution = await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: sanitizedError,
        },
      });

      return {
        success: false,
        execution: {
          id: execution.id,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          createdAt: execution.createdAt,
        },
        errorCode: "EXECUTION_FAILED",
        errorMessage: sanitizedError,
        statusCode,
      };
    }
  }
}
