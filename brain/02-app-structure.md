<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document primary application directory structure, route groups, and conventions.
-->

# Application Structure & Route Conventions

This document outlines the core directory structure of the Next.js App Router codebase, detailing critical API namespaces, internal route groups, shared libraries, and test suites.

Key source paths:
- `app/api/` (Public and internal REST endpoints)
- `lib/` (Business logic, security guards, provider clients, DB access)
- `deployments/n8n/` (Production n8n workflow definitions)
- `scripts/` (Integration verification suites)

---

## 1. Primary Directory Layout

```
├── app/
│   ├── (auth)/                    # Authentication pages (Clerk-integrated)
│   ├── (marketing)/               # Public pages (Landing, blog, portfolio, pricing)
│   ├── admin/                     # Protected admin panel & management UI
│   ├── dashboard/                 # Customer dashboard (my automations, connections)
│   └── api/                       # API route handlers (see breakdown below)
├── lib/
│   ├── prisma.ts                  # Shared PrismaClient singleton
│   ├── env.ts                     # Runtime environment validation and schema
│   ├── security/                  # Encryption vault, internal auth, OIDC verification
│   ├── integrations/              # Token services, grant management, provider clients
│   ├── entitlement/               # Customer subscription and execution entitlement checks
│   ├── email/                     # Brevo notification client
│   └── ai/                        # OpenRouter client and model routing
├── prisma/
│   └── schema.prisma              # Database schema definitions
├── deployments/
│   └── n8n/                       # Workflow definitions exported for n8n
└── scripts/                       # End-to-end integration and readiness test scripts
```

---

## 2. API Namespaces (`app/api/`)

### A. Internal Automation & Gateway API (`app/api/internal/`)
Secured via `CHOWDHURY_DUO_GATEWAY_SECRET` (HTTP headers: `x-n8n-gateway-secret`, `x-internal-service-key`, or `Authorization: Bearer <secret>`).

| Route | Method | Purpose |
|---|---|---|
| `/api/internal/gateway/gmail/poll` | `POST`, `GET` | Periodic inbox polling gateway for all active connected Google accounts |
| `/api/internal/automation/grants/validate` | `POST` | Validates transient execution grant and verifies tenant entitlement |
| `/api/internal/gateway/gmail/fetch-and-lock` | `POST` | Atomically claims and downloads email payload for processing |
| `/api/internal/automation/process-email` | `POST` | Evaluates prompt injection, RAG context, and policy to choose routing action |
| `/api/internal/gateway/gmail/send-reply` | `POST` | Dispatches outbound reply (strictly for `AUTO_REPLY` with valid grant) |
| `/api/internal/automation/record-outcome` | `POST` | Logs execution termination status (`SUCCESS` or `FAILED`) |
| `/api/internal/automation/queue-review` | `POST` | Enqueues draft in database for human agent review |

### B. Automation Management (`app/api/automations/` & `app/api/user-automations/`)
- **Dual Identifier Resolution Pattern (`[id]` vs `[slug]`):**
  Endpoints under `app/api/automations/[id]/` (e.g., `plans/route.ts`, `comments/route.ts`, `reviews/route.ts`, `trial/route.ts`) support resolution by either CUID/UUID `id` or string `slug`:
  ```typescript
  const automation = await prisma.automation.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
  });
  ```
- `/api/user-automations`: Manages customer-installed automations, config overrides, and connection bindings.

### C. OAuth & Third-Party Integrations (`app/api/integrations/`)
- `/api/integrations/google/connect`: Generates Google OAuth consent URL with requested scopes (`gmail.readonly`, `gmail.send`, `gmail.modify`).
- `/api/integrations/google/callback`: Handles OAuth exchange, encrypts refresh token into vault, and creates `IntegrationConnection`.
- `/api/integrations/google/disconnect`: Revokes tokens and marks connection as disconnected.

### D. Webhooks (`app/api/webhooks/`)
- `/api/webhooks/razorpay`: Verifies payment signatures and provisions customer entitlements.
- `/api/webhooks/gmail`: Legacy Google Cloud Pub/Sub push notification sink (kept for backward compatibility; replaced by `/api/internal/gateway/gmail/poll`).

---

## 3. Core Libraries (`lib/`)

- `lib/security/internal-auth.ts`: Constant-time verification for internal service requests using `timingSafeEqual`.
- `lib/security/vault.ts`: AES-256-GCM encryption and decryption for sensitive tokens using `AUTOMATION_VAULT_KEY`.
- `lib/integrations/grant-service.ts`: Mints, validates, and consumes short-lived `AutomationExecutionGrant` records.
- `lib/integrations/token-service.ts`: Resolves and auto-refreshes Google OAuth access tokens in-memory.
- `lib/integrations/providers/google.ts`: Pure API wrappers for Gmail operations (`executeGmailReadList`, `executeGmailGetMessage`, `executeGmailSendReply`).
- `lib/entitlement/checker.ts`: Evaluates active plans, trial limits, and execution caps for tenants.
