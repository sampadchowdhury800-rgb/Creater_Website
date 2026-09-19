<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document high-level platform architecture, component boundaries, and security authorities.
-->

# System Architecture & Component Boundaries

This document outlines the high-level architecture of the Chowdhury Duo platform, detailing the operational boundaries between the Next.js backend, database, external services, and the n8n automation pipeline.

Key source paths:
- `app/` (Next.js App Router endpoints and pages)
- `lib/` (Core services: auth, vault, database, integrations, grants)
- `prisma/schema.prisma` (PostgreSQL data schema)
- `deployments/n8n/` (Exported workflow definitions)

---

## 1. Core Technology Stack

| Layer | Technology | Primary Responsibilities |
|---|---|---|
| **Web Framework** | Next.js 14+ (App Router), React, TypeScript | SSR/CSR pages, public API, internal service gateway, admin dashboard |
| **Authentication** | Clerk (`@clerk/nextjs`) + Custom Admin Sessions | Customer identity, multi-tenant isolation, admin session cookies |
| **Database & ORM** | PostgreSQL (Neon DB Serverless) via Prisma ORM | Relational state, audit logs, idempotency records, automation configurations |
| **Secrets Vault** | AES-256-GCM (`lib/security/vault.ts`) | Server-side encryption for customer OAuth refresh tokens and credentials |
| **AI Inference** | OpenRouter (`lib/ai/` / `AI_SUPPORT_MODEL`) | Context analysis, customer support drafting, safety filtering |
| **Billing & Payments** | Razorpay SDK | Order creation, subscription billing, webhook verification |
| **Media Storage** | Cloudinary | Automation asset uploads, marketing images, portfolio media |
| **Transactional Email** | Brevo REST API (`lib/email/brevo.ts`) | Escalation notices, human review alerts, system notifications |
| **Workflow Orchestration**| n8n (Railway production, Local dev) | Multi-step pipeline coordination, decision routing, trigger management |

---

## 2. Core Architectural Principles

### Authority Model: Backend as the Single Source of Truth
The Next.js backend remains the **exclusive security and business-logic authority**:
1. **Tenant Authorization:** The backend verifies whether a customer owns a given connection, automation, and subscription before executing any task.
2. **Token Custody:** Google OAuth refresh and access tokens are strictly confined to backend memory. **n8n NEVER receives permanent OAuth tokens or vault master keys.**
3. **Execution Grants:** The backend issues ephemeral, cryptographically hashed `AutomationExecutionGrant` tokens (5-minute TTL, single-use) scoped to specific capabilities (`SUPPORT_AI`) for orchestration steps.
4. **Gateway Boundary:** All inbound and outbound interactions with external APIs (e.g., Gmail reading and sending) pass through authenticated internal backend endpoints (`/api/internal/gateway/...`), authenticated via `CHOWDHURY_DUO_GATEWAY_SECRET`.
5. **Orchestration Only:** n8n coordinates flow transitions, retry policies, and decision routing based on backend instructions, but cannot mint its own permissions or bypass backend guards.

---

## 3. High-Level System Topography

```
[ Customer / Inbound Email ]
            │
            ▼
┌─────────────────────────┐
│     Google Gmail API    │
└───────────┬─────────────┘
            │
 (1) Poll   │ (7) Send Reply (AUTO_REPLY only)
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                     Next.js Backend (Vercel)                        │
│                                                                     │
│  • Scheduled Gateway:  /api/internal/gateway/gmail/poll            │
│  • Grant Minting:      mintExecutionGrant() [5m TTL]                │
│  • Vault Decryption:   getValidAccessToken() [Memory Only]         │
│  • Deduplication:      AutomationGatewayOperation / ProcessedGmail  │
│  • Policy & RAG:       /api/internal/automation/process-email       │
│  • Outbound Gateway:   /api/internal/gateway/gmail/send-reply       │
│  • Terminal Sinks:     /record-outcome, /queue-review               │
└───────────┬─────────────────────────────────────────────▲───────────┘
            │                                             │
 (2) Webhook Dispatch                           (3-6) Internal HTTP Calls
 (Event + Transient Grant)                      (Validated via Shared Secret)
            │                                             │
┌───────────▼─────────────────────────────────────────────┴───────────┐
│                      n8n Orchestration Layer                         │
│                                                                     │
│  Target Workflow: gmail_Customer_Support_Agent (AESai9x1nAP41VKO)   │
│  • Validate Context -> Validate Grant & Entitlement                 │
│  • Fetch & Lock Email -> Ingest Deduplicated Payload                │
│  • Request AI Inference -> Route Decision:                          │
│      ├── AUTO_REPLY   -> Send Reply via Backend Gateway             │
│      ├── HUMAN_REVIEW -> Enqueue Review Draft                       │
│      ├── IGNORE       -> Terminate Silently                         │
│      └── FAILED       -> Record Audit Failure                       │
└─────────────────────────────────────────────────────────────────────┘
```
