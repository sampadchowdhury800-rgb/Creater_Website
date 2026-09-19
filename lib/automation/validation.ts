/**
 * Automation configSchema types and validation.
 *
 * The configSchema is stored as JSON on the Automation record and defines
 * what user interface fields are required for a given automation.
 *
 * ARCHITECTURE:
 * - Automation.configSchema: global product definition (what fields exist)
 * - UserAutomation.config:   user-specific values (what the user entered)
 *
 * The server validates user-supplied input against the Automation's configSchema
 * before execution — the browser cannot add, remove, or redefine schema fields.
 *
 * SUPPORTED FIELD TYPES:
 *   text, email, textarea, number, select, multiselect, checkbox, toggle, url, date
 */

import {
  MAX_INPUT_KEYS,
  MAX_STRING_VALUE_LENGTH,
  MAX_ARRAY_ITEMS,
  MAX_OBJECT_DEPTH,
} from "./execution-limits";

// ─── Schema Types ─────────────────────────────────────────────────────────────

export type ConfigFieldType =
  | "text"
  | "email"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "toggle"
  | "url"
  | "date";

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigSchemaField {
  /** Unique identifier for this field — used as the key in UserAutomation.config */
  key: string;
  /** Human-readable label shown to the user */
  label: string;
  /** Field input type */
  type: ConfigFieldType;
  /** Whether this field must have a value before execution is allowed */
  required: boolean;
  /** Placeholder text for text-like inputs */
  placeholder?: string;
  /** Options for select and multiselect fields */
  options?: ConfigFieldOption[];
  /** Default value pre-filled in the form */
  defaultValue?: unknown;
  /** Helper text shown below the field */
  helpText?: string;
  /**
   * Marks this field as containing sensitive data (API keys, tokens, passwords).
   * Future: values with sensitive=true will be encrypted before storage.
   * Current: documented as future requirement — stored as plaintext for now.
   */
  sensitive?: boolean;
  /** Minimum numeric value (for type: "number") */
  min?: number;
  /** Maximum numeric value (for type: "number") */
  max?: number;
  /** Step increment (for type: "number") */
  step?: number;
  /** Minimum string length (for text, email, url, textarea) */
  minLength?: number;
  /** Maximum string length (for text, email, url, textarea) */
  maxLength?: number;
}

export interface ConfigSchema {
  fields: ConfigSchemaField[];
}

export const VALID_CONFIG_FIELD_TYPES: readonly ConfigFieldType[] = [
  "text",
  "email",
  "textarea",
  "number",
  "select",
  "multiselect",
  "checkbox",
  "toggle",
  "url",
  "date",
] as const;

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isConfigSchema(value: unknown): value is ConfigSchema {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.fields);
}

export function isConfigSchemaField(value: unknown): value is ConfigSchemaField {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  return typeof f.key === "string" && typeof f.type === "string" && typeof f.required === "boolean";
}

// ─── Schema Definition Validation (Admin Server-Side) ─────────────────────────

export interface SchemaDefinitionValidationResult {
  valid: boolean;
  errors: string[];
  schema?: ConfigSchema;
}

/**
 * Validates a ConfigSchema structure submitted by an Admin before saving to Automation.configSchema.
 *
 * Rules:
 * - null, undefined, or empty string is valid (represents an automation without configuration).
 * - Must be an object with a `fields` array.
 * - Each field key must be unique, non-empty, and match /^[a-zA-Z0-9_]+$/ (alphanumeric and underscore only).
 * - Each field label must be non-empty.
 * - Type must be one of the 10 supported ConfigFieldType values.
 * - If select or multiselect, must have at least 1 option, with non-empty label/value and unique values.
 * - If number, min <= max if both are specified.
 * - If string-like, minLength <= maxLength if both are specified.
 */
export function validateConfigSchemaDefinition(raw: unknown): SchemaDefinitionValidationResult {
  if (raw === null || raw === undefined || raw === "") {
    return { valid: true, errors: [], schema: { fields: [] } };
  }

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { valid: false, errors: ["configSchema is not valid JSON."] };
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { valid: false, errors: ["configSchema must be an object with a 'fields' array."] };
  }

  const obj = parsed as Record<string, unknown>;
  if (!("fields" in obj) || !Array.isArray(obj.fields)) {
    return { valid: false, errors: ["configSchema must contain a 'fields' array."] };
  }

  const errors: string[] = [];
  const fields: ConfigSchemaField[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < obj.fields.length; i++) {
    const item = obj.fields[i];
    const prefix = `Field #${i + 1}`;

    if (typeof item !== "object" || item === null) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    const f = item as Record<string, unknown>;

    // 1. Key validation
    if (typeof f.key !== "string" || !f.key.trim()) {
      errors.push(`${prefix} is missing a required identifier key.`);
      continue;
    }
    const key = f.key.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      errors.push(`${prefix} key "${key}" contains invalid characters. Use letters, numbers, and underscores only.`);
    }
    if (key.length > 64) {
      errors.push(`${prefix} key "${key}" cannot exceed 64 characters.`);
    }
    const lowerKey = key.toLowerCase();
    if (seenKeys.has(lowerKey)) {
      errors.push(`${prefix} has duplicate key "${key}". Every field in the schema must have a unique key.`);
    }
    seenKeys.add(lowerKey);

    // 2. Label validation
    if (typeof f.label !== "string" || !f.label.trim()) {
      errors.push(`${prefix} (${key}) is missing a label.`);
    }
    const label = typeof f.label === "string" ? f.label.trim() : key;

    // 3. Type validation
    if (typeof f.type !== "string" || !VALID_CONFIG_FIELD_TYPES.includes(f.type as ConfigFieldType)) {
      errors.push(
        `${prefix} (${key}) has unsupported type "${f.type}". Allowed types: ${VALID_CONFIG_FIELD_TYPES.join(", ")}.`
      );
    }
    const type = f.type as ConfigFieldType;

    // 4. Flags
    const required = Boolean(f.required);
    const sensitive = Boolean(f.sensitive);

    // 5. Select / Multiselect options
    let options: ConfigFieldOption[] | undefined = undefined;
    if (type === "select" || type === "multiselect") {
      if (!Array.isArray(f.options) || f.options.length === 0) {
        errors.push(`${prefix} (${key}) of type "${type}" must have at least one option.`);
      } else {
        options = [];
        const seenOptionValues = new Set<string>();
        for (let j = 0; j < f.options.length; j++) {
          const opt = f.options[j];
          if (typeof opt !== "object" || opt === null) {
            errors.push(`${prefix} (${key}) option #${j + 1} is invalid.`);
            continue;
          }
          const optLabel = typeof opt.label === "string" ? opt.label.trim() : "";
          const optValue = typeof opt.value === "string" ? opt.value.trim() : "";
          if (!optLabel || !optValue) {
            errors.push(`${prefix} (${key}) option #${j + 1} must have both a label and a value.`);
          }
          if (seenOptionValues.has(optValue.toLowerCase())) {
            errors.push(`${prefix} (${key}) has duplicate option value "${optValue}". Option values must be unique.`);
          }
          seenOptionValues.add(optValue.toLowerCase());
          options.push({ label: optLabel, value: optValue });
        }
      }
    }

    // 6. Number bounds
    let min: number | undefined = undefined;
    let max: number | undefined = undefined;
    let step: number | undefined = undefined;
    if (type === "number") {
      if (f.min !== undefined && f.min !== null && f.min !== "") {
        const numMin = Number(f.min);
        if (isNaN(numMin)) errors.push(`${prefix} (${key}) min must be a valid number.`);
        else min = numMin;
      }
      if (f.max !== undefined && f.max !== null && f.max !== "") {
        const numMax = Number(f.max);
        if (isNaN(numMax)) errors.push(`${prefix} (${key}) max must be a valid number.`);
        else max = numMax;
      }
      if (f.step !== undefined && f.step !== null && f.step !== "") {
        const numStep = Number(f.step);
        if (isNaN(numStep) || numStep <= 0) errors.push(`${prefix} (${key}) step must be a positive number.`);
        else step = numStep;
      }
      if (min !== undefined && max !== undefined && min > max) {
        errors.push(`${prefix} (${key}) min (${min}) cannot be greater than max (${max}).`);
      }
    }

    // 7. String length bounds
    let minLength: number | undefined = undefined;
    let maxLength: number | undefined = undefined;
    if (type === "text" || type === "textarea" || type === "email" || type === "url") {
      if (f.minLength !== undefined && f.minLength !== null && f.minLength !== "") {
        const numMinLen = Number(f.minLength);
        if (isNaN(numMinLen) || numMinLen < 0) errors.push(`${prefix} (${key}) minLength must be a non-negative integer.`);
        else minLength = Math.floor(numMinLen);
      }
      if (f.maxLength !== undefined && f.maxLength !== null && f.maxLength !== "") {
        const numMaxLen = Number(f.maxLength);
        if (isNaN(numMaxLen) || numMaxLen < 1) errors.push(`${prefix} (${key}) maxLength must be a positive integer.`);
        else maxLength = Math.floor(numMaxLen);
      }
      if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
        errors.push(`${prefix} (${key}) minLength (${minLength}) cannot be greater than maxLength (${maxLength}).`);
      }
    }

    const cleanField: ConfigSchemaField = {
      key,
      label,
      type,
      required,
      ...(f.placeholder && typeof f.placeholder === "string" && f.placeholder.trim() ? { placeholder: f.placeholder.trim() } : {}),
      ...(f.helpText && typeof f.helpText === "string" && f.helpText.trim() ? { helpText: f.helpText.trim() } : {}),
      ...(f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "" ? { defaultValue: f.defaultValue } : {}),
      ...(sensitive ? { sensitive: true } : {}),
      ...(options ? { options } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(step !== undefined ? { step } : {}),
      ...(minLength !== undefined ? { minLength } : {}),
      ...(maxLength !== undefined ? { maxLength } : {}),
    };

    fields.push(cleanField);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], schema: { fields } };
}

// ─── Input Validation (User Execution Time) ───────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
  missingFields?: string[];
  fieldErrors?: Record<string, string>;
}

/**
 * Validates user-supplied execution input against an automation's configSchema.
 *
 * SECURITY RULE:
 * The schema is loaded from the Automation DB record — never from the browser.
 * The browser cannot add extra fields or mark required fields as optional.
 */
export function validateExecutionInput(
  configSchema: unknown,
  input: unknown
): ValidationResult {
  const inputObj = (
    input && typeof input === "object" ? input : {}
  ) as Record<string, unknown>;

  // Case A: Automation has no inputs (null, undefined, non-object, or empty fields)
  if (
    !configSchema ||
    typeof configSchema !== "object" ||
    !isConfigSchema(configSchema) ||
    !configSchema.fields ||
    configSchema.fields.length === 0
  ) {
    // Only an explicitly empty input object is allowed
    if (Object.keys(inputObj).length > 0) {
      return {
        valid: false,
        errorMessage: "This automation does not accept input parameters.",
      };
    }
    return { valid: true };
  }

  const { fields } = configSchema;
  const validSchemaFields = fields.filter(isConfigSchemaField);
  const declaredKeys = new Set(validSchemaFields.map((f) => f.key));

  // Case B: Automation schema has inputs — reject undeclared fields
  const undeclaredKeys = Object.keys(inputObj).filter((k) => !declaredKeys.has(k));
  if (undeclaredKeys.length > 0) {
    return {
      valid: false,
      errorMessage: `Undeclared input field(s): ${undeclaredKeys.join(", ")}. Only fields declared in the automation schema are permitted.`,
    };
  }

  const missingFields: string[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const field of validSchemaFields) {
    const { key, required, type, options, min, max, minLength, maxLength } = field;
    if (!key) continue;

    const value = inputObj[key];
    const isEmpty = value === undefined || value === null || value === "";

    // Required check
    if (required && isEmpty) {
      missingFields.push(key);
      fieldErrors[key] = `"${field.label ?? key}" is required.`;
      continue;
    }

    // Skip type validation for empty optional fields
    if (isEmpty) continue;

    // Type-specific validation
    if (type === "email" && typeof value === "string") {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) {
        fieldErrors[key] = `"${field.label ?? key}" must be a valid email address.`;
      }
    } else if (type === "url" && typeof value === "string") {
      try {
        new URL(value);
      } catch {
        fieldErrors[key] = `"${field.label ?? key}" must be a valid URL.`;
      }
    } else if (type === "number") {
      const numVal = typeof value === "number" ? value : Number(value);
      if (isNaN(numVal)) {
        fieldErrors[key] = `"${field.label ?? key}" must be a number.`;
      } else {
        if (min !== undefined && numVal < min) {
          fieldErrors[key] = `"${field.label ?? key}" must be at least ${min}.`;
        }
        if (max !== undefined && numVal > max) {
          fieldErrors[key] = `"${field.label ?? key}" cannot exceed ${max}.`;
        }
      }
    } else if (type === "select" && options && options.length > 0) {
      const validValues = options.map((o) => o.value);
      if (!validValues.includes(String(value))) {
        fieldErrors[key] = `"${field.label ?? key}" must be one of the allowed options.`;
      }
    } else if (type === "multiselect" && options && options.length > 0) {
      const values = Array.isArray(value) ? value : [value];
      const validValues = options.map((o) => o.value);
      const invalid = values.filter((v) => !validValues.includes(String(v)));
      if (invalid.length > 0) {
        fieldErrors[key] = `"${field.label ?? key}" contains invalid option(s).`;
      }
    }

    // String length validation (text, textarea, email, url)
    if (typeof value === "string") {
      if (minLength !== undefined && value.length < minLength) {
        fieldErrors[key] = `"${field.label ?? key}" must be at least ${minLength} characters.`;
      }
      if (maxLength !== undefined && value.length > maxLength) {
        fieldErrors[key] = `"${field.label ?? key}" cannot exceed ${maxLength} characters.`;
      }
    }
  }

  const hasErrors = missingFields.length > 0 || Object.keys(fieldErrors).length > 0;

  if (hasErrors) {
    const errorParts: string[] = [];
    if (missingFields.length > 0) {
      errorParts.push(`Missing required fields: ${missingFields.join(", ")}`);
    }
    const typeErrors = Object.values(fieldErrors).filter(
      (_, i) => !missingFields.includes(Object.keys(fieldErrors)[i])
    );
    if (typeErrors.length > 0) {
      errorParts.push(...typeErrors);
    }

    return {
      valid: false,
      errorMessage: errorParts.join(". "),
      missingFields,
      fieldErrors,
    };
  }

  return { valid: true };
}

// ─── Structural Input Limits (F2) ─────────────────────────────────────────────

export interface InputLimitsResult {
  valid: boolean;
  errorMessage?: string;
}

/**
 * Validates that the client-supplied execution input object does not exceed
 * structural size limits.
 *
 * These checks run BEFORE schema validation and BEFORE forwarding to n8n.
 * They protect against oversized payloads that pass schema validation but
 * could exhaust memory or storage.
 *
 * Limits are configurable via server-side environment variables; see
 * lib/automation/execution-limits.ts.
 */
export function validateInputLimits(input: unknown): InputLimitsResult {
  if (input === null || input === undefined) {
    return { valid: true };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errorMessage: "Execution input must be a JSON object.",
    };
  }

  const obj = input as Record<string, unknown>;

  // Key count check
  const keys = Object.keys(obj);
  if (keys.length > MAX_INPUT_KEYS) {
    return {
      valid: false,
      errorMessage: `Input exceeds maximum allowed number of fields (${MAX_INPUT_KEYS}).`,
    };
  }

  // Recursive depth + string length + array length check
  function checkValue(value: unknown, depth: number): string | null {
    if (depth > MAX_OBJECT_DEPTH) {
      return `Input object exceeds maximum allowed nesting depth (${MAX_OBJECT_DEPTH}).`;
    }

    if (typeof value === "string") {
      if (value.length > MAX_STRING_VALUE_LENGTH) {
        return `Input contains a string value that exceeds the maximum allowed length (${MAX_STRING_VALUE_LENGTH} characters).`;
      }
      return null;
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS) {
        return `Input contains an array that exceeds the maximum allowed length (${MAX_ARRAY_ITEMS} items).`;
      }
      for (const item of value) {
        const err = checkValue(item, depth + 1);
        if (err) return err;
      }
      return null;
    }

    if (value !== null && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      const nestedKeys = Object.keys(nested);
      if (nestedKeys.length > MAX_INPUT_KEYS) {
        return `Input contains a nested object that exceeds the maximum allowed number of fields (${MAX_INPUT_KEYS}).`;
      }
      for (const v of Object.values(nested)) {
        const err = checkValue(v, depth + 1);
        if (err) return err;
      }
    }

    return null;
  }

  for (const value of Object.values(obj)) {
    const err = checkValue(value, 1);
    if (err) return { valid: false, errorMessage: err };
  }

  return { valid: true };
}

// ─── Strict Input Schema Enforcement (F4) ─────────────────────────────────────

/**
 * Control-plane field names that must NEVER appear in client-supplied input,
 * regardless of the automation's configSchema.
 *
 * If a client attempts to inject any of these keys, the request is rejected
 * with a 400 error. The server constructs these values itself from trusted
 * server-side sources.
 */
export const CONTROL_PLANE_KEYS: ReadonlySet<string> = new Set([
  "workflowId",
  "n8nWorkflowId",
  "externalExecutionId",
  "clerkUserId",
  "userAutomationId",
  "automationId",
  "entitlement",
  "plan",
  "isExecutable",
  "status",
  "createdAt",
  "updatedAt",
  "id",
  "executionGrant",
  "_auth_google_access_token",
  "_auth_google_refresh_token",
  "integrationConnectionId",
  "grantTokenHash",
  "gatewaySecret",
  "sharedSecret",
  "codeVerifier",
  "stateNonce",
]);

export interface ControlPlaneCheckResult {
  clean: boolean;
  /** The offending key, for internal logging. Never expose to client. */
  offendingKey?: string;
}

/**
 * Rejects any input that contains a control-plane key.
 *
 * SECURITY: These keys are always set by the server. A client attempting to
 * supply them is either confused or attempting an injection attack.
 *
 * Only checks top-level keys — nested control-plane keys are handled by
 * the structural sanitizer downstream (stripUnknownInputKeys).
 */
export function rejectControlPlaneKeys(
  input: Record<string, unknown>
): ControlPlaneCheckResult {
  for (const key of Object.keys(input)) {
    if (CONTROL_PLANE_KEYS.has(key)) {
      return { clean: false, offendingKey: key };
    }
  }
  return { clean: true };
}

/**
 * Returns a copy of `input` containing ONLY keys defined in the automation's
 * configSchema.
 *
 * Keys not present in the schema are silently dropped. This prevents arbitrary
 * client JSON from being forwarded wholesale to n8n.
 *
 * If configSchema is null/undefined/empty (schema-less automations), returns
 * an empty object — schema-less automations accept NO input fields.
 *
 * SECURITY RULE: The schema is always loaded from the Automation DB record.
 * The browser cannot add fields to the schema.
 *
 * @param configSchema - The automation's trusted configSchema from the DB
 * @param input - Client-supplied input (already checked for control-plane keys)
 * @returns Whitelisted input object
 */
export function stripUnknownInputKeys(
  configSchema: unknown,
  input: Record<string, unknown>
): Record<string, unknown> {
  if (
    !isConfigSchema(configSchema) ||
    !configSchema.fields ||
    configSchema.fields.length === 0
  ) {
    // Schema-less automations: accept no input fields
    return {};
  }

  const allowedKeys = new Set(
    configSchema.fields
      .filter(isConfigSchemaField)
      .map((f) => f.key)
  );

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (allowedKeys.has(k)) {
      cleaned[k] = v;
    }
  }

  return cleaned;
}
