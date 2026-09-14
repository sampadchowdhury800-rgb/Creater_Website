/**
 * Phase 5 — Admin ConfigSchema Test Suite
 *
 * Tests:
 * 1. Schema definition validation (server-side admin guardrails)
 * 2. Invalid schema rejection (duplicate keys, invalid chars, missing labels, unsupported types)
 * 3. Select / Multiselect options validation
 * 4. Number and string bounds validation
 * 5. Execution input validation against defined schema
 * 6. Backward compatibility (null/empty schemas)
 */

import {
  validateConfigSchemaDefinition,
  validateExecutionInput,
  type ConfigSchema,
} from "../lib/automation/validation";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Phase 5 — Admin ConfigSchema Test Suite");
console.log("═══════════════════════════════════════════════════════════\n");

// ─── Section 1: Backward Compatibility & Empty Schemas ───────────────────────
console.log("📋 Section 1: Backward Compatibility & Empty Schemas\n");

const nullResult = validateConfigSchemaDefinition(null);
assert(nullResult.valid === true, "null schema is valid (no-config automation)");
assert(nullResult.schema?.fields.length === 0, "null schema returns empty fields array");

const undefResult = validateConfigSchemaDefinition(undefined);
assert(undefResult.valid === true, "undefined schema is valid");

const emptyObjResult = validateConfigSchemaDefinition({ fields: [] });
assert(emptyObjResult.valid === true, "empty fields array is valid");

const emptyStrResult = validateConfigSchemaDefinition("");
assert(emptyStrResult.valid === true, "empty string is valid");

// ─── Section 2: Valid Schemas ────────────────────────────────────────────────
console.log("\n📋 Section 2: Valid Schemas\n");

const validSchema: ConfigSchema = {
  fields: [
    {
      key: "targetEmail",
      label: "Recipient Email",
      type: "email",
      required: true,
      placeholder: "lead@company.com",
    },
    {
      key: "leadCount",
      label: "Number of Leads",
      type: "number",
      required: false,
      min: 1,
      max: 500,
      step: 1,
      defaultValue: 50,
    },
    {
      key: "emailTone",
      label: "Email Tone",
      type: "select",
      required: true,
      options: [
        { label: "Professional", value: "professional" },
        { label: "Casual", value: "casual" },
        { label: "Direct", value: "direct" },
      ],
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "text",
      required: false,
      sensitive: true,
      minLength: 10,
      maxLength: 64,
    },
  ],
};

const validResult = validateConfigSchemaDefinition(validSchema);
assert(validResult.valid === true, "Valid multi-type schema passes validation");
assert(validResult.schema?.fields.length === 4, "Schema preserves all 4 fields");
assert(validResult.errors.length === 0, "Zero errors reported for valid schema");

// ─── Section 3: Schema Rejection Guardrails ──────────────────────────────────
console.log("\n📋 Section 3: Schema Rejection Guardrails\n");

// Duplicate keys
const dupKeySchema = {
  fields: [
    { key: "username", label: "User Name", type: "text", required: true },
    { key: "userName", label: "Duplicate User Name", type: "text", required: false },
  ],
};
const dupResult = validateConfigSchemaDefinition(dupKeySchema);
assert(dupResult.valid === false, "Rejects duplicate field keys (case-insensitive)");
assert(
  dupResult.errors.some((e) => e.includes("duplicate key")),
  "Error message specifically mentions duplicate key"
);

// Missing key
const missingKeySchema = {
  fields: [{ key: "", label: "Some Label", type: "text", required: true }],
};
const missingKeyResult = validateConfigSchemaDefinition(missingKeySchema);
assert(missingKeyResult.valid === false, "Rejects empty field key");

// Invalid characters in key
const invalidCharKeySchema = {
  fields: [{ key: "my field key!", label: "Bad Key", type: "text", required: true }],
};
const invalidCharResult = validateConfigSchemaDefinition(invalidCharKeySchema);
assert(invalidCharResult.valid === false, "Rejects keys with spaces or special characters");

// Missing label
const missingLabelSchema = {
  fields: [{ key: "validKey", label: "   ", type: "text", required: true }],
};
const missingLabelResult = validateConfigSchemaDefinition(missingLabelSchema);
assert(missingLabelResult.valid === false, "Rejects empty field label");

// Unsupported type
const badTypeSchema = {
  fields: [{ key: "badField", label: "Bad Field", type: "unsupported_type", required: true }],
};
const badTypeResult = validateConfigSchemaDefinition(badTypeSchema);
assert(badTypeResult.valid === false, "Rejects unsupported field type");

// Select without options
const emptySelectSchema = {
  fields: [{ key: "category", label: "Category", type: "select", required: true, options: [] }],
};
const emptySelectResult = validateConfigSchemaDefinition(emptySelectSchema);
assert(emptySelectResult.valid === false, "Rejects select field with zero options");

// Select with duplicate option values
const dupOptionSchema = {
  fields: [
    {
      key: "tone",
      label: "Tone",
      type: "select",
      required: true,
      options: [
        { label: "Option A", value: "opt" },
        { label: "Option B", value: "opt" },
      ],
    },
  ],
};
const dupOptionResult = validateConfigSchemaDefinition(dupOptionSchema);
assert(dupOptionResult.valid === false, "Rejects select with duplicate option values");

// Number min > max
const badNumberSchema = {
  fields: [
    {
      key: "count",
      label: "Count",
      type: "number",
      required: true,
      min: 100,
      max: 10,
    },
  ],
};
const badNumberResult = validateConfigSchemaDefinition(badNumberSchema);
assert(badNumberResult.valid === false, "Rejects number field with min > max");

// Text minLength > maxLength
const badTextLenSchema = {
  fields: [
    {
      key: "code",
      label: "Code",
      type: "text",
      required: true,
      minLength: 50,
      maxLength: 10,
    },
  ],
};
const badTextLenResult = validateConfigSchemaDefinition(badTextLenSchema);
assert(badTextLenResult.valid === false, "Rejects string field with minLength > maxLength");

// ─── Section 4: Execution Input Validation with Bounds ───────────────────────
console.log("\n📋 Section 4: Execution Input Validation with Bounds\n");

// Valid input against validSchema
const validExecutionInput = {
  targetEmail: "lead@acme.com",
  leadCount: 25,
  emailTone: "professional",
  apiKey: "secret_1234567890",
};
const inputResult1 = validateExecutionInput(validSchema, validExecutionInput);
assert(inputResult1.valid === true, "Valid execution input passes validation");

// Number exceeding max bound
const invalidNumberInput = {
  targetEmail: "lead@acme.com",
  leadCount: 999, // max is 500
  emailTone: "casual",
};
const inputResult2 = validateExecutionInput(validSchema, invalidNumberInput);
assert(inputResult2.valid === false, "Rejects numeric input exceeding max bound");
assert(
  inputResult2.fieldErrors?.["leadCount"]?.includes("cannot exceed") === true,
  "Field error mentions max bound exceeded"
);

// Number below min bound
const belowMinInput = {
  targetEmail: "lead@acme.com",
  leadCount: 0, // min is 1
  emailTone: "casual",
};
const inputResult3 = validateExecutionInput(validSchema, belowMinInput);
assert(inputResult3.valid === false, "Rejects numeric input below min bound");

// String below minLength bound
const shortStringInput = {
  targetEmail: "lead@acme.com",
  apiKey: "short", // minLength is 10
  emailTone: "direct",
};
const inputResult4 = validateExecutionInput(validSchema, shortStringInput);
assert(inputResult4.valid === false, "Rejects string input below minLength bound");

// Invalid select option
const badSelectInput = {
  targetEmail: "lead@acme.com",
  emailTone: "aggressive", // not in options
};
const inputResult5 = validateExecutionInput(validSchema, badSelectInput);
assert(inputResult5.valid === false, "Rejects unlisted select option");

// ─── Results ─────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
