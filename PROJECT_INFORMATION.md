# Chowdhury Duo — Living Project Information System

**Last Verified:** 2026-09-13  
**Status:** Living Canonical Architecture & Knowledge Memory  
**Target Milestone:** Production AI Customer Support Gmail SaaS  

> **NOTICE FOR AI AGENTS & DEVELOPERS:**  
> This file is the project's **canonical source of truth**. Before analyzing or modifying the repository, read this document first to understand the architecture, subsystem boundaries, and reusable components. Only inspect source files when implementing, verifying, or debugging specific details. **Never rebuild existing systems.**

---

## 1. Project Identity

- **Project Name:** Chowdhury Duo Platform (`chowdhury_duo_professional_website`)
- **Core Product Vision:** A high-security, multi-tenant automation marketplace and SaaS platform where businesses purchase, configure, and execute AI-powered business workflows.
- **Current Flagship SaaS Product:** **AI Customer Support Email Automation via Gmail**.
- **Primary Customer Communication Channel:** Customer's own Google Workspace / Gmail account (connected via OAuth 2.0 PKCE).
- **Core Value Proposition:** High-confidence automated email support replies grounded in customer business knowledge, with deterministic prompt-injection defense and a human-in-the-loop escalation queue for ambiguous or sensitive inquiries.
- **Current Development Phase:** **Phase 1 Complete (Foundation & Inbound Pipeline)**; entering **Phase 2 (Tenant Knowledge Base / pgvector RAG)** & **Phase 3 (Inbound Support AI Engine)**.

---

## 2. Technology Stack (Verified Live)

| Category | Technology | Version | Purpose / Evidence |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `16.3.4` | Server Components, Route Handlers, Server Actions |
| **UI Library** | React | `19.2.4` | React 19 client components |
| **Language** | TypeScript | `^5.0.0` | Strict type safety across full stack (`tsc --noEmit` clean) |
| **Styling** | Tailwind CSS | `^4.0.0` | Tailwind v4 with `@tailwindcss/postcss` |
| **Database** | PostgreSQL on Neon | Serverless | Pooled connection with native `vector` extension |
| **ORM** | Prisma | `7.9.0` | Prisma 7 schema, `@prisma/client`, `@prisma/adapter-neon` |
| **Customer Auth** | Clerk | `^7.7.4` | Server-side auth, session tokens, user identity |
| **Admin Auth** | Custom HMAC Session | Native | Independent admin credential login & hashed cookies |
| **Vault Encryption** | AES-256-GCM | Node `crypto` | 12-byte IV, 16-byte auth tag, authenticated encryption |
| **Payments** | Razorpay | `^2.9.8` | Order creation, HMAC-SHA256 signature verification |
| **Workflow Engine**| n8n (Self-Hosted) | REST API | Durable orchestration executed via transient single-use grants |
| **AI Inference** | OpenRouter | HTTP REST | OpenAI-compatible inference bridge |
| **Google APIs** | Native REST Client | Native `fetch` | OAuth 2.0 PKCE, Gmail REST API, Scheduled Polling |
| **Media Storage** | Cloudinary | `^2.10.0` | Static asset and media uploads |
| **Email Delivery** | Brevo | HTTP REST | Transactional email & human escalation notifications |

---

## 3. Repository Structure

```
chowdhury_duo_professional_website/
├── app/
│   ├── admin/                         # Admin dashboard & CMS control plane
│   │   ├── automations/               # Admin automation catalog management
│   │   └── ...                        # Blog, analytics, settings management
│   ├── api/
│   │   ├── admin/                     # Admin-gated API endpoints (HMAC auth)
│   │   ├── ai-support/                # Website chat support endpoints
│   │   ├── automation-executions/     # Trigger & poll user automation runs
│   │   ├── automations/               # Public automation catalog & trials
│   │   ├── cron/
│   │   │   └── renew-watches/         # Scheduled job: 7-day Gmail watch renewals
│   │   ├── gateway/
│   │   │   └── gmail/                 # SECURE GMAIL GATEWAY (consumed by n8n)
│   │   ├── integrations/
│   │   │   └── google/
│   │   │       ├── connect/           # Initiates Google OAuth with PKCE
│   │   │       ├── callback/          # Exchanges OAuth code & encrypts tokens
│   │   │       ├── disconnect/        # Revokes & deletes integration tokens
│   │   │       └── watch/             # Enable/disable mailbox push notifications
│   │   ├── my-automations/[id]/       # Workspace downloads & operations
│   │   ├── orders/                    # Razorpay order generation & checkout
│   │   ├── user-automations/          # Workspace bindings & custom settings
│   │   └── webhooks/
│   │       ├── gmail/                 # Legacy webhook receiver (deprecated; replaced by Supabase polling)
│   │       └── razorpay/              # Razorpay payment & subscription ledger
│   ├── my-automations/[id]/           # Customer Workspace UI (WorkspaceClient.tsx)
│   ├── automations/                   # Marketplace product listings & detail
│   ├── cart/ & checkout/              # Commerce checkout pages
│   └── proxy.ts                       # Clerk middleware proxy
├── components/
│   ├── automations/                   # Dynamic schema form renderers & widgets
│   ├── ui/                            # Shared design components
│   └── ...
├── lib/
│   ├── admin-session.ts               # Custom HMAC admin session utilities
│   ├── auth-server.ts                 # Server-side Clerk identity helpers
│   ├── auth.ts                        # Client-side Clerk wrappers
│   ├── env.ts                         # Validated environment configuration
│   ├── prisma.ts                      # PrismaClient initialization with Neon adapter
│   ├── ai-support/                    # Website AI chat provider & guardrails
│   ├── automation/
│   │   ├── authorization.ts           # Ownership & entitlement gating
│   │   ├── execution-rate-limiter.ts  # In-process sliding window limiter
│   │   ├── execution-service.ts       # Full execution pipeline coordinator
│   │   ├── n8n-client.ts              # HTTP client for n8n webhooks
│   │   ├── output-sanitizer.ts        # Credential redaction engine
│   │   ├── validation.ts              # Input schema limits & control-plane defense
│   │   └── vault-service.ts           # UserAutomationSecret encryption access
│   ├── crypto/
│   │   └── vault.ts                   # Core AES-256-GCM encryption & decryption
│   ├── entitlement/
│   │   └── checker.ts                 # Deterministic license/trial evaluator
│   ├── integrations/
│   │   ├── gateway-validator.ts       # Validates gateway payloads & capability params
│   │   ├── grant-service.ts           # Ephemeral single-use grant token manager
│   │   ├── pkce.ts                    # RFC 7636 PKCE & state CSRF hashing
│   │   ├── registry.ts                # Capability definitions & prohibited scope asserts
│   │   ├── token-service.ts           # Concurrency-safe token refresh & vault storage
│   │   ├── types.ts                   # Gateway request/response contracts
│   │   ├── watch-service.ts           # Gmail Pub/Sub watch registration & renewal
│   │   └── providers/
│   │       └── google.ts              # Native Gmail REST API client & MIME parser
│   └── security/
│       └── ip-utils.ts                # Client IP extraction
├── prisma/
│   ├── schema.prisma                  # 46 models including Inbound Watch & Support
│   └── migrations/                    # Historical SQL migrations
├── public/                            # Static assets & favicons
├── PROJECT_INFORMATION.md             # Living architectural memory (THIS FILE)
└── package.json                       # Dependencies and run scripts
```

---

## 4. Architectural Map

### 4.1 Inbound AI Email Support Loop (Target Flagship Architecture)

```
[Inbound Email arrives at Customer's Gmail]
                  │
                  ▼
[Supabase pg_cron (Every 5 mins)]
                  │
                  ▼
[Supabase Edge Function: gmail-check] ◄── Polling via Gmail REST API
                  │
                  ├─► 1. Lookup connected Gmail accounts & check token validity
                  ├─► 2. Delta sync via historyId / recent inbox messages
                  ├─► 3. Atomic deduplication via automation_executions
                  │
                  ▼
[Supabase Edge Function: gmail-process] (Classifies intent, RAG knowledge retrieval, generates reply)
                  │
                  ▼
[n8n Workflow: Gmail Support Orchestrator]
                  │
                  ├─► Step 1: POST /api/gateway/gmail (Action: GMAIL_GET_MESSAGE)
                  │           └─► Gateway decrypts OAuth token and returns clean email body
                  │
                  ├─► Step 2: POST /api/gateway/support-ai
                  │           ├─► RAG: Query pgvector KnowledgeChunk (filtered by clerkUserId)
                  │           ├─► Assemble XML-delimited prompt (<untrusted_email_body>)
                  │           ├─► OpenRouter LLM inference with structured JSON output
                  │           ├─► Deterministic Backend Policy Gate (outside LLM):
                  │           │   • High confidence & Auto-reply ON ──► Status: APPROVED
                  │           │   • Low confidence / policy flag     ──► Status: NEEDS_REVIEW
                  │           └─► Persist to SupportConversation & SupportMessage
                  │
                  └─► Step 3: Branch:
                         ├── IF APPROVED (Auto-Reply):
                         │   POST /api/gateway/gmail (Action: GMAIL_SEND)
                         │   └─► Dispatches reply from customer's Gmail
                         │
                         └── IF NEEDS_REVIEW (Escalation):
                             Enqueues draft in customer's workspace review tab
```

### 4.2 Standard Outbound Automation Execution Loop

```
Customer Workspace (WorkspaceClient.tsx)
   ↓ POST /api/automation-executions
ExecutionRateLimiter (Per-user, per-IP, concurrent cap)
   ↓
ExecutionService (lib/automation/execution-service.ts)
   ├── authorizeAutomationExecution() (IDOR check + Entitlement verification)
   ├── rejectControlPlaneKeys() (Security check)
   ├── validateExecutionInput() (Dynamic schema check)
   ├── mintExecutionGrant() (Ephemeral 60s grant with required capability)
   └── N8nClient.triggerWorkflow() (HTTP POST with X-N8N-WEBHOOK-SECRET)
         ↓
      n8n Orchestrator
         ↓ POST /api/gateway/gmail
      Secure Gateway (app/api/gateway/gmail/route.ts)
         ├── verifyGatewaySharedSecret()
         ├── atomicallyConsumeGrant() (Burns single-use grant token)
         ├── checkAutomationAccess() (Defense-in-depth re-check)
         ├── getValidAccessToken() (Fenced atomic refresh if expired)
         └── executeGmail*() (Provider REST call)
```

---

## 5. Authentication

1. **Customer Authentication:** Handled completely by **Clerk** (`@clerk/nextjs`).
   - Server identity helper: `getCurrentUserId()` in `lib/auth-server.ts`.
   - Guaranteed throws helper: `getCurrentUserOrThrow()` in `lib/auth-server.ts`.
   - Customer identity key: `clerkUserId`.
   - Middleware: `proxy.ts` handles Clerk session pass-through.
2. **Admin Authentication:** Custom independent session system (`lib/admin-session.ts`).
   - Models: `Admin`, `AdminSession`.
   - Session stored in HTTP-only HMAC-signed cookie (`admin_session`).
   - Completely decoupled from Clerk to prevent privilege escalation.

> **CRITICAL RULE:** Do NOT create any new authentication systems. Always use `getCurrentUserId()` for customer routes and `getAdminFromSession()` for admin routes.

---

## 6. Multi-Tenancy & Data Isolation

**Tenant Concept:** Single-user business tenancy where `tenant = clerkUserId`.

### Isolation Invariants:
- Every tenant-owned database record contains a `clerkUserId` column.
- Every API endpoint resolving customer data **must** filter by `clerkUserId: currentUserId`.
- Database ownership relationships:
  ```
  clerkUserId (Clerk User ID)
     ├── UserAutomation (One-to-one per purchased automation)
     ├── IntegrationConnection (One per connected provider account)
     ├── GmailWatchSubscription (One per connected Gmail inbox)
     ├── ProcessedGmailEvent (History deduplication ledger)
     ├── KnowledgeDocument (Tenant-specific business documents)
     │     └── KnowledgeChunk (Vector chunks with clerkUserId)
     ├── SupportConversation (Tenant-specific email threads)
     │     └── SupportMessage (Individual messages and AI drafts)
     └── AutomationExecutionGrant (Transient execution grants)
  ```
- **IDOR Protection:** Cross-tenant resource access is strictly impossible because all route handlers and background grant consumers verify that `record.clerkUserId === request.clerkUserId`.

---

## 7. Database Architecture (Prisma & Neon PostgreSQL)

- **Provider:** PostgreSQL on Neon Serverless.
- **ORM:** Prisma 7 (`^7.9.0`) using `@prisma/adapter-neon`.
- **Vector Extension:** Native PostgreSQL `vector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`).
- **Vector Storage:** `KnowledgeChunk.embedding` column typed as `vector(1536)`.

### Core Model Inventory (46 Models Total):
1. **Tenancy & Marketplace:**
   - `Automation`: Catalog definition, JSON `configSchema`, `integrationRequirements`.
   - `UserAutomation`: Customer's instance of an automation, user JSON `config`, status.
   - `AutomationExecution`: Log of executions with input/output payloads sanitized.
   - `UserAutomationSecret`: AES-256-GCM encrypted per-field custom secrets.
2. **Integrations & Credential Vault:**
   - `IntegrationConnection`: Encrypted OAuth tokens (`accessTokenEncrypted`, `refreshTokenEncrypted`), IVs, auth tags, scopes, refresh lock fences.
   - `UserAutomationIntegration`: Role-based binding between `UserAutomation` and `IntegrationConnection`.
   - `AutomationExecutionGrant`: Single-use ephemeral grant tokens with SHA-256 hashes, capability restriction, and expiration.
   - `OAuthAuthorizationSession`: Ephemeral PKCE code verifier and CSRF state hash storage.
   - `AutomationGatewayOperation`: Idempotency ledger for gateway operations.
3. **Gmail Inbound Polling Pipeline:**
   - `gmail_accounts`: Connected accounts, token expiry, polling state (`last_checked_at`, `history_id`).
   - `automation_executions`: Dedicated deduplication ledger with unique index on `(business_id, gmail_message_id)`.
4. **Tenant Knowledge Base (RAG):**
   - `KnowledgeDocument`: File metadata (`title`, `fileType`, `fileSize`, `status`, `clerkUserId`).
   - `KnowledgeChunk`: Text chunks (`content`, `tokenCount`, `embedding vector(1536)`, `clerkUserId`).
5. **Support Conversations & Human Escalation:**
   - `SupportConversation`: Support email threads (`gmailThreadId`, `subject`, `customerEmail`, `status`, `confidenceScore`, `clerkUserId`).
   - `SupportMessage`: Individual thread messages (`role`, `content`, `rawAiOutput`, `reasoning`, `gmailMessageId`).
6. **Billing & Entitlements:**
   - `AutomationPlan`, `AutomationEntitlement`, `AutomationTrialTracker`, `UserSubscription`, `ProcessedWebhookEvent`, `Order`, `OrderItem`.

---

## 8. Security Architecture

| Defense Layer | Implementation Status | Implementation Details |
|---|---|---|
| **Route Protection** | `IMPLEMENTED` | Server-side Clerk check on every customer route |
| **IDOR Protection** | `IMPLEMENTED` | Strict `clerkUserId` scoping on all queries and updates |
| **Credential Encryption** | `IMPLEMENTED` | AES-256-GCM vault with unique 12-byte IVs & 16-byte auth tags |
| **OAuth CSRF & PKCE** | `IMPLEMENTED` | RFC 7636 PKCE code verifiers and SHA-256 state hashes |
| **Transient Grants** | `IMPLEMENTED` | Single-use, 60-second to 5-minute TTL tokens, SHA-256 hashed |
| **Orchestrator Isolation** | `IMPLEMENTED` | n8n never receives raw OAuth access or refresh tokens |
| **Gateway Rate Limiting** | `IMPLEMENTED` | 30 req/min sliding window per execution grant |
| **Log Sanitization** | `IMPLEMENTED` | Regex-based credential redactor (`output-sanitizer.ts`) |
| **Webhook Idempotency** | `IMPLEMENTED` | Atomic uniqueness on `[emailAddress, historyId]` & Razorpay event ID |
| **Scope Enclosure** | `IMPLEMENTED` | Startup assertion rejecting full account takeover scope `mail.google.com` |
| **Prompt Injection Barrier**| `PARTIAL` | XML delimiters & external deterministic policy gate designed; active in gateway |

---

## 9. Encryption & Secrets Management

- **Master Key:** Sourced exclusively from `process.env.AUTOMATION_VAULT_KEY` (32-byte hex-encoded key).
- **Core Engine:** `lib/crypto/vault.ts`.
  - Function: `vaultEncrypt(plaintext: string): EncryptedPayload`.
  - Function: `vaultDecrypt(payload: EncryptedPayload): string`.
- **Protected Fields in DB:**
  - `IntegrationConnection.accessTokenEncrypted`
  - `IntegrationConnection.refreshTokenEncrypted`
  - `OAuthAuthorizationSession.codeVerifierEnc`
  - `UserAutomationSecret.encryptedValue`
- **Zero-Plaintext Rule:** Plaintext credentials are never written to database tables, logs, error responses, or client bundles.

---

## 10. Google & Gmail Integration

### Components:
- **OAuth Connect / Callback:** `app/api/integrations/google/connect/route.ts` and `callback/route.ts`.
- **Token Service:** `lib/integrations/token-service.ts` provides `getValidAccessToken(connectionId)` with optimistic locking to prevent concurrent token refresh race conditions.
- **Provider API Client:** `lib/integrations/providers/google.ts`.
  - `executeGmailSend`: Sends RFC 2822 MIME messages.
  - `executeGmailReadList`: Lists threads or messages matching query filters.
  - `executeGmailGetMessage`: Retrieves full message payload, parsing text & HTML bodies recursively.
  - `executeGmailModify`: Modifies labels and trashing status.
  - `executeGmailWatch`: Deprecated (Pub/Sub push notifications retired).
  - `executeGmailStopWatch`: Deprecated.
  - `executeGmailListHistory`: Synchronizes message history events since a `startHistoryId`.
- **Scheduled Polling Engine:** Supabase Edge Function `gmail-check` (called via `pg_cron`).
- **Inbound AI Processing Pipeline:** Supabase Edge Function `gmail-process`.

---

## 11. n8n Workflow Architecture

### Operating Boundaries:
- **n8n DOES:** Orchestrate HTTP sequence loops, queue execution retries, manage workflow step timing.
- **n8n DOES NOT:**
  - Store or handle OAuth client secrets or refresh tokens.
  - Store master encryption vault keys.
  - Connect directly to the Neon PostgreSQL database.
  - Evaluate authorization or billing policies.
- **Communication Protocol:**
  - Inbound: n8n receives `executionGrant` and `executionId` via webhook.
  - Outbound: n8n calls `POST /api/gateway/gmail` passing `Authorization: Bearer <executionGrant>` and `X-N8N-GATEWAY-SECRET`.

---

## 12. Billing & Entitlements

- **Payment Gateway:** Razorpay.
- **Order Creation:** `app/api/orders/create/route.ts`.
- **Webhook Ledger:** `app/api/webhooks/razorpay/route.ts` validates HMAC-SHA256 signature and records events into `ProcessedWebhookEvent`.
- **Entitlement Evaluation:** `lib/entitlement/checker.ts` (`checkAutomationAccess(clerkUserId, automationId)`).
  - Precedence: Lifetime Entitlement ──► Active Time-Limited Plan ──► Active Trial.
  - Expired subscriptions immediately disable gateway and execution operations without deleting customer configurations.

---

## 13. AI Architecture

### 1. Website Chatbot (Existing System)
- **Files:** `lib/ai-support/provider.ts`, `lib/ai-support/guardrails.ts`, `app/api/ai-support/chat/route.ts`.
- **Purpose:** Public-facing support widget answering questions about Chowdhury Duo services and products.

### 2. Inbound Gmail Support AI (SaaS Flagship System)
- **Purpose:** Analyzes incoming customer support emails, consults tenant-specific knowledge, generates responses, and determines confidence.
- **Inference Client:** OpenRouter via `lib/ai-support/provider.ts`.
- **Prompt Structure:**
  ```xml
  <system_instructions>
  Operating guidelines and customer business identity.
  </system_instructions>
  <verified_knowledge_base>
  Retrieved chunks from pgvector.
  </verified_knowledge_base>
  <untrusted_email_body>
  Raw customer email text (strictly treated as data, not instructions).
  </untrusted_email_body>
  ```
- **Output Schema:** Structured JSON with `category`, `confidence_score`, `requires_escalation`, `proposed_reply`.
- **Policy Gate:** Evaluated in Next.js backend, **not** inside the LLM.

---

## 14. Knowledge Base / RAG Architecture

- **Vector Database:** PostgreSQL `pgvector` hosted directly on the existing Neon database.
- **Document Model:** `KnowledgeDocument` (tracks parsing and indexing status).
- **Chunk Model:** `KnowledgeChunk` (stores chunk text and `vector(1536)` embedding).
- **Tenant Scoping:** Every similarity search query **must** contain `WHERE clerk_user_id = $1` to guarantee absolute tenant isolation.
- **Pipeline:** Document Upload ──► Text Extraction ──► Chunking ──► OpenRouter/OpenAI Embeddings ──► pgvector Upsert.

---

## 15. Human Escalation Architecture

- **Container Model:** `SupportConversation` (`status: PENDING_APPROVAL | AUTO_REPLIED | RESOLVED | DISMISSED`).
- **Message Model:** `SupportMessage` (`role: CUSTOMER | AI_DRAFT | SENT_REPLY | HUMAN_REPLY`).
- **Review Queue:** Customer workspace tab displaying threads flagged with low confidence or policy triggers.
- **Actions:**
  - **Approve:** Dispatches AI draft as-is via Gmail Gateway.
  - **Edit & Send:** Customer edits response text, then dispatches via Gmail Gateway.
  - **Dismiss:** Marks thread resolved without sending an email.

---

## 16. API Route Inventory

| Method | Route | Purpose | Auth | Tenant Resolution | Status |
|---|---|---|---|---|---|
| `POST` | `/api/webhooks/gmail` | Decommissioned (Pub/Sub retired; replaced by Supabase polling) | None | N/A | `DEPRECATED` |
| `POST` | `/api/integrations/google/watch` | Decommissioned (Push watches retired) | None | N/A | `DEPRECATED` |
| `DELETE`| `/api/integrations/google/watch` | Decommissioned (Push watches retired) | None | N/A | `DEPRECATED` |
| `GET`  | `/api/cron/renew-watches` | Decommissioned (Watch renewals retired) | None | N/A | `DEPRECATED` |
| `POST` | `/api/gateway/gmail` | Proxies Gmail actions for n8n | Gateway Secret + Grant | Grant ownership verification | `IMPLEMENTED` |
| `POST` | `/api/integrations/google/connect` | Starts Google OAuth PKCE flow | Clerk | `getCurrentUserId()` | `IMPLEMENTED` |
| `GET`  | `/api/integrations/google/callback` | Completes Google OAuth flow | Clerk | State hash match | `IMPLEMENTED` |
| `POST` | `/api/integrations/google/disconnect` | Revokes and deletes connection | Clerk | `getCurrentUserId()` | `IMPLEMENTED` |
| `POST` | `/api/automation-executions` | Manually triggers automation run | Clerk | `getCurrentUserId()` | `IMPLEMENTED` |
| `POST` | `/api/webhooks/razorpay` | Ingests Razorpay payment webhooks | HMAC Signature | Webhook event payload | `IMPLEMENTED` |
| `POST` | `/api/gateway/support-ai` | RAG query and AI reply generator | Execution Grant | Grant ownership verification | `PLANNED (Phase 3)` |
| `GET`  | `/api/knowledge/documents` | Lists tenant knowledge documents | Clerk | `getCurrentUserId()` | `PLANNED (Phase 2)` |
| `POST` | `/api/knowledge/documents` | Uploads and indexes new document | Clerk | `getCurrentUserId()` | `PLANNED (Phase 2)` |
| `GET`  | `/api/support/conversations` | Lists escalation review queue | Clerk | `getCurrentUserId()` | `PLANNED (Phase 4)` |
| `POST` | `/api/support/conversations/[id]/approve` | Approves and dispatches draft | Clerk | `getCurrentUserId()` | `PLANNED (Phase 4)` |

---

## 17. Important File Index

| File Path | Subsystem | Purpose |
|---|---|---|
| `lib/auth-server.ts` | Auth | Server-side Clerk identity helpers (`getCurrentUserId`) |
| `lib/prisma.ts` | Database | Prisma client singleton with Neon serverless adapter |
| `lib/crypto/vault.ts` | Security | Core AES-256-GCM authenticated encryption engine |
| `lib/integrations/types.ts` | Integrations | Contracts and types for gateway actions and capabilities |
| `lib/integrations/registry.ts` | Integrations | Capability registry and prohibited scope assertions |
| `lib/integrations/token-service.ts` | Integrations | Concurrency-safe token refresh and vault storage |
| `lib/integrations/grant-service.ts` | Integrations | Transient single-use execution grant manager |
| `lib/integrations/watch-service.ts` | Integrations | Gmail Pub/Sub watch registration and renewal manager |
| `lib/integrations/providers/google.ts`| Integrations | Gmail API client, MIME builder, and body extractor |
| `lib/automation/execution-service.ts`| Execution | Pipeline orchestrator validating inputs and triggering n8n |
| `lib/automation/n8n-client.ts` | Execution | HTTP client dispatching workflow execution to n8n |
| `lib/automation/output-sanitizer.ts` | Security | Redacts secrets from execution logs before saving |
| `lib/entitlement/checker.ts` | Commerce | Evaluates license and trial entitlement access |
| `lib/ai-support/provider.ts` | AI | OpenRouter inference client |
| `app/api/gateway/gmail/route.ts` | Gateway | Secure proxy executing Gmail actions for n8n |
| `app/api/webhooks/gmail/route.ts` | Webhook | Decommissioned legacy Pub/Sub receiver |
| `app/api/cron/renew-watches/route.ts` | Maintenance | Decommissioned legacy watch renewal route |
| `app/my-automations/[id]/WorkspaceClient.tsx` | UI | Customer workspace shell |
| `prisma/schema.prisma` | Database | Complete Prisma schema definition |

---

## 18. Implementation Status

| Feature | Status | Primary Files | Notes |
|---|---|---|---|
| **Clerk Customer Auth** | `IMPLEMENTED` | `lib/auth-server.ts`, `proxy.ts` | Production-ready; do not rebuild |
| **Admin Custom Auth** | `IMPLEMENTED` | `lib/admin-session.ts`, `app/admin/*` | Production-ready; do not rebuild |
| **Multi-Tenancy** | `IMPLEMENTED` | All route handlers & Prisma schema | Single-user tenancy via `clerkUserId` |
| **AES-256-GCM Vault** | `IMPLEMENTED` | `lib/crypto/vault.ts` | Production-ready; do not rebuild |
| **Google OAuth PKCE** | `IMPLEMENTED` | `app/api/integrations/google/*` | Production-ready; do not rebuild |
| **Gmail Security Gateway** | `IMPLEMENTED` | `app/api/gateway/gmail/route.ts` | Production-ready; do not rebuild |
| **Execution Grants** | `IMPLEMENTED` | `lib/integrations/grant-service.ts` | Production-ready; do not rebuild |
| **Gmail Poller (Scheduled)**| `IMPLEMENTED` | `supabase/functions/gmail-check` | 5-min scheduled polling via pg_cron |
| **Gmail AI Processor** | `IMPLEMENTED` | `supabase/functions/gmail-process` | Grounded AI reply pipeline with deduplication |
| **Legacy Watch/Webhook** | `DEPRECATED` | `app/api/webhooks/gmail/route.ts` | Decommissioned; Pub/Sub retired |
| **pgvector Extension** | `IMPLEMENTED` | Neon PostgreSQL database | Extension active; `embedding` column verified |
| **Knowledge Base Models** | `IMPLEMENTED` | `prisma/schema.prisma` | `KnowledgeDocument` & `KnowledgeChunk` |
| **Support Models** | `IMPLEMENTED` | `prisma/schema.prisma` | `SupportConversation` & `SupportMessage` |
| **Knowledge Ingestion / RAG**| `PLANNED` | `lib/knowledge/*`, `/api/knowledge/*` | Next phase: chunker, embeddings, search |
| **Inbound Support AI Engine**| `PLANNED` | `lib/support-automation/*`, gateway | Next phase: prompt builder, policy gate |
| **Escalation Review UI** | `PLANNED` | `WorkspaceClient.tsx` | Next phase: approvals tab in workspace |
| **Razorpay Commerce** | `IMPLEMENTED` | `app/api/orders/*`, `webhooks/razorpay`| Production-ready; do not rebuild |
| **n8n Orchestration** | `IMPLEMENTED` | `lib/automation/n8n-client.ts` | Production-ready; do not rebuild |

---

## 19. DO NOT REBUILD (Strict Reuse Rules)

1. **DO NOT rebuild Customer Authentication:** Clerk is fully integrated. Always use `getCurrentUserId()`.
2. **DO NOT rebuild Credential Encryption:** The AES-256-GCM vault in `lib/crypto/vault.ts` is verified and complete.
3. **DO NOT rebuild Google OAuth:** Native PKCE flow with CSRF state protection in `app/api/integrations/google/` is complete.
4. **DO NOT rebuild Gmail Gateway Primitives:** `executeGmailSend`, `executeGmailGetMessage`, `executeGmailReadList`, and `executeGmailModify` in `lib/integrations/providers/google.ts` are verified.
5. **DO NOT rebuild Execution Grants:** The SHA-256 single-use grant system in `lib/integrations/grant-service.ts` handles all capability scoping.
6. **DO NOT rebuild Commerce/Billing:** Razorpay orders, payments, and entitlement ledgers are verified.
7. **DO NOT introduce External Vector DBs (e.g. Pinecone):** `pgvector` is already enabled in the project's Neon PostgreSQL database.

---

## 20. Current Development Phase

- **Current Phase:** **Phase 2 (Tenant Knowledge Base / pgvector RAG)**
- **Completed:**
  - Phase 0: Prisma schema models added, synced via `prisma db push`, `vector` extension enabled on Neon.
  - Phase 1: Gmail watch registration, renewal cron, body extraction, and Pub/Sub webhook receiver implemented. Full TypeScript check passed.
- **Currently Working On:**
  - Document chunking, text extraction, OpenRouter embeddings generation, and tenant-namespaced pgvector similarity search.
- **Next Phase:**
  - Phase 3: Inbound Support AI Engine (`POST /api/gateway/support-ai`) with XML prompt injection defense and deterministic policy gate.
- **Blockers:** None.

---

## 21. Recent Changes (Changelog)

### 2026-09-13
- **Inbound Gmail Push Pipeline Complete (Phase 1):**
  - Added `GMAIL_WATCH` and `SUPPORT_AI` capabilities to `SupportedCapability`.
  - Registered `GMAIL_WATCH` in `GOOGLE_CAPABILITY_REGISTRY`.
  - Implemented `executeGmailWatch`, `executeGmailStopWatch`, and `executeGmailListHistory` in `lib/integrations/providers/google.ts`.
  - Implemented recursive body extraction (`extractBodyFromPayload`) in `executeGmailGetMessage`.
  - Created `lib/integrations/watch-service.ts` for watch setup, teardown, and proactive renewals.
  - Created `app/api/webhooks/gmail/route.ts` with Pub/Sub decoding, `ProcessedGmailEvent` deduplication, tenant resolution, entitlement checks, grant minting, and n8n dispatching.
  - Created `app/api/cron/renew-watches/route.ts` secured by `CRON_SECRET`.
  - Created `app/api/integrations/google/watch/route.ts` for user-facing watch management.
- **Database Schema Synced (Phase 0):**
  - Added `GmailWatchSubscription`, `ProcessedGmailEvent`, `KnowledgeDocument`, `KnowledgeChunk`, `SupportConversation`, `SupportMessage`.
  - Applied schema to live Neon PostgreSQL database via `prisma db push`.
  - Enabled PostgreSQL `vector` extension on Neon and verified `embedding vector(1536)` column on `KnowledgeChunk`.
  - Validated TypeScript with `npx tsc --noEmit` (**0 errors**).

---

## 22. Validation History

- **TypeScript Compilation:** `PASS` (`npx tsc --noEmit` exited 0 on 2026-09-13).
- **Prisma Schema Validation:** `PASS` (`npx prisma validate` exited 0).
- **Database Schema Push:** `PASS` (`npx prisma db push` exited 0 to Neon PostgreSQL).
- **pgvector Extension Verification:** `PASS` (`CREATE EXTENSION IF NOT EXISTS vector;` executed cleanly on live database).
- **AES-256-GCM Vault:** Verified functional with authenticated tag checking.

---

## 23. Environment Inventory (Names Only — No Secrets)

```text
DATABASE_URL
AUTOMATION_VAULT_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTOMATION_GATEWAY_SECRET
N8N_BASE_URL
N8N_WEBHOOK_SECRET
N8N_SUPPORT_WEBHOOK_URL
OPENROUTER_API_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CRON_SECRET
BREVO_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

---

## 24. Known Risks & Mitigations

| Threat / Risk | Severity | Status | Mitigation Strategy |
|---|---|---|---|
| **Cross-Tenant Data Leakage (IDOR)** | `CRITICAL` | `PROTECTED` | All queries enforce `clerkUserId: currentUserId`. Grants validate ownership before execution. |
| **OAuth Token Exposure** | `CRITICAL` | `PROTECTED` | AES-256-GCM encryption in DB. Tokens never sent to n8n or client. |
| **Prompt Injection via Email** | `HIGH` | `IN_PROGRESS` | Strict XML delimiters (`<untrusted_email_body>`), structured JSON output, and backend deterministic policy gate. |
| **Pub/Sub Duplicate Processing** | `HIGH` | `PROTECTED` | Atomic idempotency ledger in `ProcessedGmailEvent` table keyed by `[emailAddress, historyId]`. |
| **Silent Watch Expiration** | `MEDIUM` | `PROTECTED` | Scheduled cron `/api/cron/renew-watches` proactively renews watches within 48h of expiry. |
| **Serverless Rate Limiting Bypass**| `MEDIUM` | `PARTIAL` | In-process sliding window limiter; plan to add Upstash Redis once multi-instance scaling requires it. |

---

## 25. Critical Architectural Rules

1. **Frontend Is Untrusted:** Never trust client-submitted parameters for pricing, user identity, or authorization.
2. **Strict Tenant Scoping:** Every customer-owned database table must include `clerkUserId` and be queried with tenant filters.
3. **No Plaintext Secrets:** Never store unencrypted OAuth tokens, refresh tokens, or API keys in the database or logs.
4. **Orchestrator Isolation:** n8n must never receive OAuth credentials or vault keys. All Gmail access occurs through gateway APIs using transient single-use grants.
5. **No AI Final Authority:** The LLM does not decide whether an email is sent; the deterministic Next.js policy gate evaluates confidence and rules.
6. **Untrusted Email Barrier:** All customer email content must be delimited as untrusted data in prompts to prevent instruction override.
7. **Server-Side Entitlement Checks:** Always verify active license or trial entitlements before executing automations.
8. **No Duplicate Architecture:** Always inspect `PROJECT_INFORMATION.md` and reuse existing modules before creating new services.
9. **Living Memory Update:** Update `PROJECT_INFORMATION.md` immediately following any verified implementation.
