<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document authentication, authorization, vault encryption, grant lifecycle, and defensive security.
-->

# Authentication & Security Architecture

This document defines the multi-tiered security architecture across user identity, internal service authentication, secrets management, orchestration boundaries, and automated defenses.

Key source paths:
- `lib/security/internal-auth.ts` (Internal service verification)
- `lib/security/vault.ts` (AES-256-GCM vault encryption)
- `lib/integrations/grant-service.ts` (Execution grant minting & validation)
- `app/api/internal/automation/process-email/route.ts` (Prompt injection defense)
- `app/api/internal/gateway/gmail/send-reply/route.ts` (Outbound send authorization)

---

## 1. User Identity & Multi-Tenant Isolation

1. **Customer Authentication:** Managed through Clerk (`@clerk/nextjs`). Every client API route calls `getCurrentUserId()` to resolve the customer's authenticated `clerkUserId`.
2. **Tenant Boundary Enforcement:** 
   - All database queries for connections, automations, executions, and grants strictly enforce `where: { clerkUserId: tenantId }`.
   - IDOR prevention: A user cannot view, trigger, or modify another tenant's automations by manipulating execution or connection IDs.
3. **Administrative Access:** Admin dashboard utilizes a separate `AdminSession` token-based cookie authentication backed by bcrypt-hashed credentials, independent rate-limiting (`RateLimit`), and audit logging (`AuditLog`).

---

## 2. Internal Service-to-Service Authentication

Internal API endpoints (`/api/internal/...`) receive requests from the n8n orchestration layer and background workers.

- **Shared Secret:** Verified against `CHOWDHURY_DUO_GATEWAY_SECRET`.
- **Accepted Headers:**
  - `x-n8n-gateway-secret: <secret>`
  - `x-internal-service-key: <secret>`
  - `Authorization: Bearer <secret>`
- **Constant-Time Verification:** Uses Node.js `crypto.timingSafeEqual` to guard against timing analysis attacks.
- **Dual Secret Rotation:** Supports zero-downtime rotation via comma-delimited keys (`current_secret,retiring_secret`).

---

## 3. Secrets Vault & Token Protection

Google OAuth credentials and sensitive configuration keys are protected using a server-side encryption vault (`lib/security/vault.ts`).

- **Cipher Algorithm:** AES-256-GCM with PBKDF2 key derivation.
- **Payload Format:** Salt (16 bytes) + IV (12 bytes) + Auth Tag (16 bytes) + Encrypted Ciphertext.
- **Master Secret:** `AUTOMATION_VAULT_KEY` (must be a 256-bit / 32-byte hex or base64 key).
- **In-Memory Lifetime:**
  - Refresh tokens are stored encrypted at rest in the database (`IntegrationConnection.encryptedRefreshToken`).
  - Access tokens are decrypted and refreshed in-memory on demand; they are **never written to persistent disk, never logged, and never returned in API responses**.
- **No Token Leaks to n8n:** n8n never receives OAuth access or refresh tokens. It interacts only through backend proxy endpoints.

---

## 4. Ephemeral Execution Grants

Orchestration workflows cannot act with ambient authority. Each step requires a transient `AutomationExecutionGrant`:

1. **Minting:** The backend mints a grant during polling (`mintExecutionGrant()`) bound to:
   - `clerkUserId` (Tenant ID)
   - `userAutomationId`
   - `automationExecutionId`
   - `integrationConnectionId`
   - `allowedCapability` (e.g., `SUPPORT_AI`)
2. **Hashing:** Only the SHA-256 hash (`grantTokenHash`) is stored in the database. The plaintext token is dispatched once in the webhook payload.
3. **Strict 5-Minute TTL:** Grants expire 5 minutes after minting (`expiresAt`).
4. **Validation:** Each subsequent HTTP call from n8n passes `executionGrantId`. The backend validates tenant ownership, expiration, and capability before proceeding.
5. **Consumption:** Grants are single-use or finalized upon workflow termination (`finalizeGrant()`).

---

## 5. Defense-in-Depth & Outbound Send Authorization

### A. Prompt Injection Defense
In `app/api/internal/automation/process-email/route.ts`, inbound email subject lines, bodies, and thread snippets are evaluated against prompt-injection heuristics:
- Flags patterns such as `ignore previous instructions`, `system prompt`, `you are now in developer mode`, and `jailbreak`.
- **Mitigation:** When triggered, the engine overrides any model recommendation, sets `action = "HUMAN_REVIEW"`, and logs `reviewReason: "Security flag: Potential prompt injection attempt"`. The email is queued for manual staff review.

### B. Outbound Send Guardrails
In `app/api/internal/gateway/gmail/send-reply/route.ts`:
- Outbound emails are permitted **ONLY** when `action === "AUTO_REPLY"` with a valid, active execution grant.
- Routes marked `HUMAN_REVIEW`, `IGNORE`, or `FAILED` are strictly prohibited from dispatching outbound emails.
- **Idempotency:** Every send request checks `idem_reply_<emailId>`. If already dispatched, the backend returns the cached response rather than sending duplicate messages.
