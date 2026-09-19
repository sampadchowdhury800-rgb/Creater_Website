# Phase 5 — Admin ConfigSchema Visual Editor

**Date:** September 9, 2026  
**Status:** Completed & Production-Verified  
**Verification Results:**
- TypeScript / Next.js Production Build: **PASS (44/44 routes, 0 errors, Exit Code 0)**
- ESLint: **PASS (0 errors, Exit Code 0)**
- ConfigSchema Test Suite (`scripts/test-config-schema.ts`): **PASS (24 passed, 0 failed, Exit Code 0)**
- Execution Engine Test Suite (`scripts/test-execution-engine.ts`): **PASS (15 passed, 0 failed, Exit Code 0)**

---

## 1. ConfigSchema Structure

The `configSchema` is stored as JSON on the `Automation` database record in PostgreSQL (`Automation.configSchema Json?`). It acts as the global design contract for the user-facing configuration form shown to customers after purchase in `/my-automations/[id]`.

### TypeScript Interface
```typescript
export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigSchemaField {
  key: string;               // Unique alphanumeric/underscore machine identifier
  label: string;             // Human-readable title displayed above input
  type: ConfigFieldType;     // One of the 10 supported field types
  required: boolean;         // Execution blocker if empty
  placeholder?: string;      // Input placeholder text
  helpText?: string;         // Explanatory guidance text below input
  defaultValue?: unknown;    // Initial value
  sensitive?: boolean;       // Masked with dots + eye toggle (passwords, tokens, API keys)
  options?: ConfigFieldOption[]; // Options for select and multiselect fields
  min?: number;              // Minimum numeric value (number fields)
  max?: number;              // Maximum numeric value (number fields)
  step?: number;             // Step increment (number fields)
  minLength?: number;        // Minimum string length (text/textarea)
  maxLength?: number;        // Maximum string length (text/textarea)
}

export interface ConfigSchema {
  fields: ConfigSchemaField[];
}
```

### Example JSON Payload
```json
{
  "fields": [
    {
      "key": "recipientEmail",
      "label": "Recipient Email",
      "type": "email",
      "required": true,
      "placeholder": "lead@company.com",
      "helpText": "Enter the primary recipient for automated alerts."
    },
    {
      "key": "leadCount",
      "label": "Daily Lead Limit",
      "type": "number",
      "required": false,
      "min": 1,
      "max": 500,
      "step": 1,
      "defaultValue": 50
    },
    {
      "key": "emailTone",
      "label": "Writing Style",
      "type": "select",
      "required": true,
      "options": [
        { "label": "Professional", "value": "professional" },
        { "label": "Casual", "value": "casual" },
        { "label": "Direct", "value": "direct" }
      ]
    },
    {
      "key": "apiKey",
      "label": "Third-Party API Key",
      "type": "text",
      "required": false,
      "sensitive": true,
      "placeholder": "sk_live_...",
      "helpText": "Stored as plaintext JSON pending vault encryption."
    }
  ]
}
```

---

## 2. Supported Field Types (10 Types)

The visual editor exclusively supports the 10 field types handled by the execution engine and form renderer:

| Type | UI Representation | Server-Side Validation |
| :--- | :--- | :--- |
| `text` | `<input type="text">` | String length bounds (`minLength`, `maxLength`) |
| `email` | `<input type="email">` | Regex RFC email format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) |
| `textarea` | `<textarea rows={4}>` | String length bounds (`minLength`, `maxLength`) |
| `number` | `<input type="number">` | Numeric check + range bounds (`min`, `max`, `step`) |
| `select` | `<select>` dropdown | Value must match one of the defined option values |
| `multiselect`| Multi-chip tag buttons | Every selected value must be in defined options |
| `checkbox` | `<input type="checkbox">` | Boolean conversion |
| `toggle` | Accessible switch toggle | Boolean toggle state |
| `url` | `<input type="url">` | Standard `new URL(str)` parsing |
| `date` | `<input type="date">` | Date string check |

---

## 3. Admin Visual Editor Behavior

The editor component ([`app/admin/automations/ConfigSchemaEditor.tsx`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/app/admin/automations/ConfigSchemaEditor.tsx)) provides a fluid, enterprise-grade card-based builder integrated into the admin form:

1. **Adding Fields:**
   - Click `+ Add Field` or `+ Add First Configuration Field`.
   - Auto-assigns an incremental unique machine key (e.g., `field_1`).
   - Expands the newly created card automatically for editing.
2. **Key & Label Decoupling:**
   - As the admin types the label, the machine key is automatically suggested in `camelCase` (e.g., `"Gmail Address"` → `"gmailAddress"`).
   - Once the admin manually modifies the key, it permanently decouples and preserves the custom key.
3. **Reordering:**
   - `Move Up` and `Move Down` arrow buttons allow instant, stable reordering.
   - The saved array order in `configSchema.fields` directly dictates the rendering order in the customer workspace.
4. **Duplication:**
   - Duplicates field properties and assigns a unique `_copy` key suffix.
5. **Deletion:**
   - Instant field removal with order reassignment.
6. **Select / Multiselect Options UI:**
   - Dedicated option manager: Add, delete, and rename options with separate `label` and `value` fields.
7. **Type-Specific Setting Panels:**
   - Number inputs reveal `Minimum`, `Maximum`, and `Step` fields.
   - Text inputs reveal `Min Length` and `Max Length` fields.
   - Dropdown types reveal the Option list.

---

## 4. Server-Side Validation

Client-side validation is strictly treated as advisory. When an Admin submits the form:
1. `FormData` reaches the server action (`createAutomation` or `updateAutomation`).
2. Server parses `configSchema` from the raw form string:
   ```typescript
   let configSchema: ConfigSchema | null = null;
   const configSchemaRaw = formData.get("configSchema") as string;
   if (configSchemaRaw && configSchemaRaw.trim()) {
     configSchema = JSON.parse(configSchemaRaw);
   }
   ```
3. Authoritative validation runs via `validateConfigSchemaDefinition()` inside `AutomationSchema.superRefine`:
   - **Key validation:** Non-empty, alphanumeric + underscore only (`/^[a-zA-Z0-9_]+$/`), max 64 chars.
   - **Duplicate key rejection:** Case-insensitive uniqueness check across all fields.
   - **Label validation:** Non-empty string.
   - **Type validation:** Must be one of the 10 permitted types.
   - **Select options validation:** Requires at least 1 option, non-empty labels/values, and unique option values.
   - **Number bounds validation:** Numbers only, and `min <= max`.
   - **String bounds validation:** Positive integers, and `minLength <= maxLength`.
4. Invalid schemas are rejected with readable custom Zod error messages and the transaction is aborted.

---

## 5. Live Preview Architecture

The editor features a **zero-drift** live preview system:
- It renders the **exact same** component ([`components/automations/AutomationInterfaceRenderer.tsx`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/components/automations/AutomationInterfaceRenderer.tsx)) used by the real customer workspace.
- **Workflow:**
  ```
  Admin Schema State
  ↓
  Same ConfigSchema Object
  ↓
  AutomationInterfaceRenderer
  ↓
  Identical Customer UI in /my-automations/[id]
  ```
- Admins can switch between the "Builder" and "User Preview" tabs at any time to interact with inputs, dropdowns, toggles, and sensitive masking.

---

## 6. User Config Separation

The strict boundary between product definitions and customer workspaces is maintained:
- `Automation.configSchema`: Global product template defining *what fields exist*.
- `UserAutomation.config`: Customer-specific instance storing *what values the buyer entered*.
- **Admin edits do not touch user data:** Editing or publishing a new `configSchema` on an `Automation` updates only `Automation.configSchema`. It **never** mutates or deletes existing `UserAutomation.config` records.
- **Renderer resilience:** If an admin deletes a field from `configSchema`, the user's saved config value remains safely in `UserAutomation.config` (unrendered), preventing accidental data destruction. If an admin adds a new field, the renderer falls back gracefully to `field.defaultValue ?? ""`.

---

## 7. Backward Compatibility

- **No Database Migration Required:** The `Automation.configSchema` column was already established in PostgreSQL as a `Json?` field.
- **No-Config Automations:** Automations with `null`, `undefined`, or `{ fields: [] }` continue to work seamlessly. A schema is **never** forced on automations that do not require customer configuration (such as static workflow downloads or fully managed jobs).
- **Existing Records:** All existing automations, purchases, users, and execution logs remain 100% intact.

---

## 8. Sensitive Fields Limitation & Warning

- Marking a field with `sensitive: true` instructs `AutomationInterfaceRenderer` to render the input as a masked password field (`type="password"`, `autoComplete="off"`) with an eye reveal toggle.
- **CRITICAL REMINDER:** Sensitive values entered by customers are currently stored as **plaintext JSON** in the PostgreSQL database. **This is not encrypted at rest.**
- Before launching real automations that collect third-party secrets (e.g. Gmail App Passwords or OAuth tokens), application-level envelope encryption (`lib/crypto/vault.ts` with AES-256-GCM) must be implemented.

---

## 9. Security Model

- Only authenticated administrators with a valid session can create or edit automation products.
- Server actions call `await requireAdminSession()` as their very first instruction.
- Regular Clerk users have no endpoints or capabilities to mutate `Automation.configSchema`.
- `Automation.isExecutable` and `Automation.n8nWorkflowId` remain protected behind admin verification and are never exposed in user query responses.

---

## 10. Files Changed & Created

### Created Files
- [`app/admin/automations/ConfigSchemaEditor.tsx`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/app/admin/automations/ConfigSchemaEditor.tsx): Visual schema builder and interactive preview component.
- [`scripts/test-config-schema.ts`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/scripts/test-config-schema.ts): Automated test suite covering schema definitions and edge cases.
- [`PHASE_5_CONFIG_SCHEMA_EDITOR.md`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/PHASE_5_CONFIG_SCHEMA_EDITOR.md): Architectural report and documentation.

### Modified Files
- [`lib/automation/validation.ts`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/lib/automation/validation.ts): Added `validateConfigSchemaDefinition`, numeric/string bounds in `ConfigSchemaField`, and runtime bounds enforcement in `validateExecutionInput`.
- [`components/automations/AutomationInterfaceRenderer.tsx`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/components/automations/AutomationInterfaceRenderer.tsx): Bound `min`, `max`, `step`, `minLength`, and `maxLength` props to form inputs.
- [`app/admin/automations/actions.ts`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/app/admin/automations/actions.ts): Added `configSchema` to `AutomationSchema`, superRefine schema validation, `parseFormData`, and Prisma mutations.
- [`app/admin/automations/AutomationForm.tsx`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/app/admin/automations/AutomationForm.tsx): Integrated `ConfigSchemaEditor` with state persistence and FormData submission.

---

## 11. Verification Matrix

| Test Suite | Command | Total Tests | Passed | Failed |
| :--- | :--- | :--- | :--- | :--- |
| **ConfigSchema Guardrails** | `npx tsx scripts/test-config-schema.ts` | 24 | 24 | 0 |
| **Execution Engine Security** | `npx tsx --env-file=.env scripts/test-execution-engine.ts` | 15 | 15 | 0 |
| **ESLint** | `npm run lint` | Full codebase | 0 errors | 0 |
| **Next.js Production Build** | `npm run build` | 44 routes | 44/44 | 0 |
