<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document database architecture, core data models, relationships, and persistence contracts.
-->

# Database Architecture & Data Models

This document details the database layer, Prisma ORM entities, idempotency mechanisms, and timestamp contracts supporting the automation platform.

Key source paths:
- `prisma/schema.prisma` (Complete schema definitions)
- `lib/prisma.ts` (PrismaClient singleton instantiation)

---

## 1. Database Infrastructure

- **Provider:** PostgreSQL (Neon DB Serverless)
- **ORM:** Prisma ORM (`@prisma/client`)
- **Connection Model:** SSL-required connection pool via `DATABASE_URL`
- **Vector Embeddings / pgvector:** The current Prisma schema utilizes standard relational models and JSON fields. Conceptual RAG pipelines retrieve knowledge without requiring explicit pgvector schema extensions.

---

## 2. Core Entities & Lifecycle Roles

### A. Automation Catalog & Tenant Bindings
- **`Automation`:** Represents an available automation product in the marketplace (e.g., Gmail Customer Support Agent). Contains execution metadata, status (`PUBLISHED`, `DRAFT`), and pricing tiers.
- **`UserAutomation`:** A tenant's active installation of an automation. Stores custom runtime options in `config` (JSON) such as `autoReplyEnabled`, `confidenceThreshold`, and prompt rules.
- **`UserAutomationSecret`:** Encrypted environment variables or API keys specific to a tenant's automation instance, encrypted via the backend vault.

### B. Provider Integrations & Connections
- **`IntegrationConnection`:** Represents an authenticated external account (e.g., Google OAuth).
  - `encryptedRefreshToken`: Vault-encrypted OAuth refresh token.
  - `accountEmail`: Associated mailbox or service account identifier.
  - `status`: `CONNECTED`, `DISCONNECTED`, or `REVOKED`.
  - `createdAt`: Immutable timestamp when the account was first authorized.
  - `lastRefreshedAt`: Updated upon each access token renewal (does NOT alter `createdAt`).
- **`UserAutomationIntegration`:** Join table associating a `UserAutomation` with an `IntegrationConnection`.
  - Its `createdAt` defines the authoritative **polling baseline** for that automation instance.

### C. Security Grants & Orchestration
- **`AutomationExecution`:** High-level execution log for customer visibility and auditing (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`). Stores triggering inputs and final outputs with sensitive fields redacted.
- **`AutomationExecutionGrant`:** Transient security token issued by the backend to authorize n8n to perform operations on behalf of an execution.
  - `grantTokenHash`: SHA-256 hash of the raw token (raw token is never persisted).
  - `expiresAt`: 5-minute strict TTL from minting.
  - `allowedCapability`: Scoped privilege (e.g., `SUPPORT_AI`).
  - `status`: `ISSUED`, `PROCESSING`, `SUCCEEDED`, or `FAILED`.

### D. Idempotency & Deduplication
- **`AutomationGatewayOperation`:** Low-level lock preventing race conditions across polling workers and webhook dispatchers.
  - `idempotencyKey`: Unique constraint (`poll_claim_<messageId>`, `fetch_lock_<messageId>`, `idem_reply_<messageId>`).
  - `status`: `PENDING`, `COMPLETED`, `FAILED`.
- **`ProcessedGmailEvent`:** Fast-lookup audit record documenting processed Gmail messages per tenant to ensure no email is processed twice.
- **`ProcessedWebhookEvent`:** Fast-lookup table recording external webhook delivery IDs (e.g., Razorpay payment events).

### E. Entitlements & Trials
- **`AutomationPlan`:** Pricing tiers defining monthly execution limits, concurrency, and feature flags.
- **`AutomationEntitlement`:** Active customer subscription granting execution rights.
- **`AutomationTrialTracker`:** Enforces execution quotas for accounts on active trials.

---

## 3. Timestamp Contracts & Baseline Preservation

To protect pre-existing customer inboxes from bulk processing upon initial connection:

1. **Baseline Inception:** When a tenant links Gmail to an automation, the baseline is determined by:
   $$\text{Baseline} = \text{UserAutomationIntegration.createdAt} \lor \text{IntegrationConnection.createdAt}$$
2. **Refresh Invariance:** When Google OAuth access tokens are refreshed, `lastRefreshedAt` is updated, but `createdAt` remains unchanged. The baseline timestamp never shifts forward or backward during routine authentication.
3. **Re-connection Reset:** If a tenant explicitly disconnects and reconnects their account, a new `IntegrationConnection` is generated with a new `createdAt`, setting a fresh baseline from that moment forward.
