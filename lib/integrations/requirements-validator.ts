/**
 * lib/integrations/requirements-validator.ts
 *
 * Server-side validator for Automation.integrationRequirements.
 *
 * Validates that integration requirements declared on an automation product
 * adhere to strict security invariants before being persisted to the database.
 */

import { isSupportedGoogleCapability, GOOGLE_CAPABILITY_REGISTRY } from "./registry";
import type { IntegrationRequirement, AutomationIntegrationRequirements } from "./types";

const ALLOWED_PROVIDERS = new Set(["GOOGLE"]);

export interface IntegrationRequirementsValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: AutomationIntegrationRequirements;
}

/**
 * Validates the integrationRequirements JSON field of an Automation product.
 *
 * Rules:
 * 1. null or undefined or empty array is valid (represents automation with no integration requirements).
 * 2. Must be an object with a `requirements` or `integrationRequirements` array (or a raw array).
 * 3. Each requirement must have:
 *    - `id`: unique string /^[a-zA-Z0-9_]{1,32}$/
 *    - `provider`: "GOOGLE"
 *    - `capability`: valid key in GOOGLE_CAPABILITY_REGISTRY
 *    - `required`: boolean
 *    - `label`: non-empty string <= 100 chars
 *    - `description`: string <= 500 chars
 * 4. MUST NOT contain `scopes` or `requiredScopes` (raw scopes are rejected to prevent tampering).
 * 5. No duplicate requirement IDs.
 */
export function validateIntegrationRequirements(
  raw: unknown
): IntegrationRequirementsValidationResult {
  if (raw === null || raw === undefined || raw === "") {
    return { valid: true, errors: [], sanitized: { requirements: [] } };
  }

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { valid: false, errors: ["integrationRequirements is not valid JSON."] };
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      valid: false,
      errors: ["integrationRequirements must be a JSON object or array."],
    };
  }

  // Support either { requirements: [...] }, { integrationRequirements: [...] }, or [...]
  let rawList: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.requirements)) {
      rawList = obj.requirements;
    } else if (Array.isArray(obj.integrationRequirements)) {
      rawList = obj.integrationRequirements;
    } else {
      return {
        valid: false,
        errors: ["integrationRequirements must contain a 'requirements' or 'integrationRequirements' array."],
      };
    }
  }

  const errors: string[] = [];
  const sanitizedList: IntegrationRequirement[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const prefix = `Requirement #${i + 1}`;

    if (typeof item !== "object" || item === null) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    const req = item as Record<string, unknown>;

    // Security check: Reject raw scope injection
    if ("scopes" in req || "requiredScopes" in req) {
      errors.push(
        `${prefix} contains raw OAuth scopes. Scopes must NOT be defined manually; they are derived server-side from capabilities.`
      );
    }

    // 1. ID
    if (typeof req.id !== "string" || !req.id.trim()) {
      errors.push(`${prefix} is missing a required identifier 'id'.`);
      continue;
    }
    const id = req.id.trim();
    if (!/^[a-zA-Z0-9_]{1,32}$/.test(id)) {
      errors.push(
        `${prefix} id "${id}" is invalid. Must be 1-32 alphanumeric characters or underscores.`
      );
    }
    const lowerId = id.toLowerCase();
    if (seenIds.has(lowerId)) {
      errors.push(`${prefix} duplicate requirement ID "${id}". Requirement IDs must be unique.`);
    }
    seenIds.add(lowerId);

    // 2. Provider
    if (typeof req.provider !== "string" || !ALLOWED_PROVIDERS.has(req.provider)) {
      errors.push(
        `${prefix} (${id}) has unsupported provider "${req.provider}". Allowed providers: ${Array.from(ALLOWED_PROVIDERS).join(", ")}.`
      );
    }
    const provider = (req.provider as string) as "GOOGLE";

    // 3. Capability
    if (typeof req.capability !== "string" || !isSupportedGoogleCapability(req.capability)) {
      errors.push(
        `${prefix} (${id}) has unsupported capability "${req.capability}". Allowed capabilities: ${Object.keys(GOOGLE_CAPABILITY_REGISTRY).join(", ")}.`
      );
    }
    const capability = req.capability as any;

    // 4. Required flag
    if (typeof req.required !== "boolean") {
      errors.push(`${prefix} (${id}) 'required' must be a boolean.`);
    }
    const required = Boolean(req.required);

    // 5. Label
    const label = typeof req.label === "string" ? req.label.trim() : id;
    if (!label) {
      errors.push(`${prefix} (${id}) is missing a label.`);
    }
    if (label.length > 100) {
      errors.push(`${prefix} (${id}) label cannot exceed 100 characters.`);
    }

    // 6. Description
    const description = typeof req.description === "string" ? req.description.trim() : "";
    if (description.length > 500) {
      errors.push(`${prefix} (${id}) description cannot exceed 500 characters.`);
    }

    sanitizedList.push({
      id,
      provider,
      capability,
      required,
      label,
      description,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: { requirements: sanitizedList },
  };
}
