<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document verified third-party integrations, authentication models, and security boundaries.
-->

# External Integrations & Service Boundaries

This document catalogues all third-party services, APIs, and infrastructure integrations active in the Chowdhury Duo codebase, detailing their authentication models and security boundaries.

Key source paths:
- `lib/integrations/providers/google.ts` (Google API client)
- `lib/email/brevo.ts` (Brevo email client)
- `lib/razorpay.ts` (Razorpay client & signature verification)
- `lib/cloudinary.ts` (Cloudinary media client)
- `lib/env.ts` (Environment configuration registry)

---

## 1. Verified Third-Party Integrations

### A. Google / Gmail API
- **Purpose:** Inbound email polling, metadata inspection, message body ingestion, and automated replies.
- **Source Paths:**
  - `lib/integrations/providers/google.ts`
  - `lib/integrations/token-service.ts`
  - `app/api/integrations/google/`
  - `app/api/internal/gateway/gmail/`
- **Authentication Model:** OAuth 2.0 Web Application flow requesting `access_type: "offline"` and `prompt: "consent"`.
  - Scopes: `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.modify`.
- **Security Boundary:** All Google API calls are routed through server-side wrappers in `lib/integrations/providers/google.ts`. Plaintext OAuth tokens are never logged or exported to n8n or client apps.

### B. OpenRouter AI
- **Purpose:** LLM inference for email understanding, intent classification, policy checks, and reply generation.
- **Source Paths:**
  - `lib/env.ts` (`AI_SUPPORT_API_KEY`, `AI_SUPPORT_MODEL`, `AI_SUPPORT_BASE_URL`, `AI_SUPPORT_FREE_ONLY`)
  - `app/api/internal/automation/process-email/route.ts`
- **Authentication Model:** Server-side API key passed via HTTP Bearer token.
- **Safety Controls:** `AI_SUPPORT_FREE_ONLY` default enforcement ensures only permitted free-tier models are invoked unless explicitly overridden.

### C. Brevo (formerly Sendinblue)
- **Purpose:** Automated escalation notices to human supervisors and operational error alerts.
- **Source Paths:**
  - `lib/email/brevo.ts`
  - `app/api/ai-support/escalate/route.ts`
- **Authentication Model:** REST API Key passed via `api-key` request header. Server-side only.

### D. Razorpay
- **Purpose:** Customer payment processing, checkout orders, and subscription lifecycle management.
- **Source Paths:**
  - `lib/razorpay.ts`
  - `app/api/orders/`
  - `app/api/webhooks/razorpay/route.ts`
- **Authentication Model:** Key ID and Secret for API operations; HMAC-SHA256 signature verification for inbound webhook events (`x-razorpay-signature`).

### E. Cloudinary
- **Purpose:** Cloud media asset hosting for portfolio showcases, blog images, and marketplace assets.
- **Source Paths:**
  - `lib/cloudinary.ts`
  - `app/api/admin/upload/route.ts`
- **Authentication Model:** API Key and Secret using official Cloudinary Node.js SDK.

### F. Clerk Identity Platform
- **Purpose:** Customer authentication, session lifecycle, multi-factor authentication, and user directory.
- **Source Paths:**
  - `@clerk/nextjs`
  - `middleware.ts`
- **Authentication Model:** JWT session cookies for browser clients; Secret Key for server-side verification.

### G. Neon PostgreSQL
- **Purpose:** Relational database storage and persistence.
- **Source Paths:**
  - `prisma/schema.prisma`
  - `lib/prisma.ts`
- **Authentication Model:** TLS-secured connection string (`DATABASE_URL` with `sslmode=require`).

### H. n8n Orchestration Platform
- **Purpose:** Distributed workflow coordination for event-driven automations.
- **Environments:** Local n8n (development/testing) vs. Railway n8n (production).
- **Authentication Model:** Internal service shared secret (`CHOWDHURY_DUO_GATEWAY_SECRET`).
