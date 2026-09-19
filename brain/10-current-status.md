<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Record a verified current-state snapshot, active/inactive workflow states, and known blockers.
-->

# Current Platform Status & Readiness Snapshot

This document captures the verified operational status of the Chowdhury Duo platform as of **September 16, 2026**, documenting active/inactive workflow states, verified readiness probes, and exact pre-launch blockers.

Key source paths:
- `deployments/n8n/` (Exported workflow definitions)
- `scripts/test-n8n-backend-integration.ts` (Backend integration suite)
- `scripts/test-gmail-polling-suite.ts` (Polling logic test suite)

---

## 1. Verified Component Status

| Component / Service | Verified State | Details |
|---|:---:|---|
| **Next.js Web Frontend** | **OPERATIONAL** | Responds HTTP 200 OK at `https://chowdhuryduo.in` |
| **Backend Internal Gateway** | **OPERATIONAL** | `/api/internal/gateway/gmail/poll` rejects unauthenticated requests with HTTP 401 |
| **Relational Database** | **OPERATIONAL** | Neon DB online; currently 0 connected Google accounts in production |
| **Railway n8n Host** | **OPERATIONAL** | `https://n8n-production-a20f.up.railway.app` online with persistent volume |
| **Target Workflow (`AESai9x1nAP41VKO`)** | **INACTIVE** | `gmail_Customer_Support_Agent` exists; `active: false`, 0 lifetime executions |
| **Scheduler (`eFgsgtIqInoZDMJy`)** | **INACTIVE** | `gmail_Backend_Poll_Scheduler` exists; `active: false`, 0 lifetime executions |
| **Google Cloud Pub/Sub** | **STANDBY / OBSOLETE**| Decoupled; polling architecture requires zero GCP Pub/Sub topics or billing |
| **Live Customer Mailboxes** | **TOUCHED: ZERO** | No live Gmail accounts connected, polled, or emailed during verification |

---

## 2. Integration Readiness & Verification History

- **Local Integration Suite:** `scripts/test-n8n-backend-integration.ts` verifies:
  - Route existence for all internal automation endpoints.
  - Mocked grant lifecycle (mint, hash, 5-minute TTL, single-use enforcement).
  - Decision routing across `AUTO_REPLY`, `HUMAN_REVIEW`, `IGNORE`, and `FAILED`.
  - Prompt injection detection routing to `HUMAN_REVIEW`.
  - Inbound and outbound idempotency locks (`poll_claim_`, `fetch_lock_`, `idem_reply_`).
- **Target Workflows Verification:** Probes into Railway n8n via MCP confirmed both workflows exist with all expected nodes, zero hardcoded secrets, and no stored OAuth tokens.

---

## 3. Known Pre-Launch Blockers

Before activating `gmail_Backend_Poll_Scheduler` or `gmail_Customer_Support_Agent` against real customer accounts, the following four blockers must be resolved:

1. **Deploy Local Baseline Protection to Vercel:**
   - *Current State:* Vercel is deployed from GitHub commit `2e5a653`, which contains the unconstrained query `is:unread label:INBOX`.
   - *Action Required:* Commit, push, and deploy local updates in `app/api/internal/gateway/gmail/poll/route.ts` and `lib/integrations/providers/google.ts` so production uses `after:${baselineSeconds}` and metadata receipt verification.
2. **Synchronize `CHOWDHURY_DUO_GATEWAY_SECRET` on Vercel:**
   - *Current State:* Authenticated probe with the local secret returned HTTP 401 (`INVALID_SERVICE_AUTH`).
   - *Action Required:* Configure `CHOWDHURY_DUO_GATEWAY_SECRET` in Vercel Project Settings to match the value stored in the Railway n8n credential.
3. **Link Backend Service Credential in Railway n8n:**
   - *Current State:* Credential `Chowdhury Duo Backend Service` (ID: `fWVUiIteHrABav0m`) exists in Railway n8n, but the HTTP Request nodes in `gmail_Customer_Support_Agent` and `gmail_Backend_Poll_Scheduler` have `credentials: null`.
   - *Action Required:* Open both workflows in the n8n editor and select `Chowdhury Duo Backend Service` under Authentication on all HTTP Request nodes.
4. **Configure `CHOWDHURY_DUO_API_BASE_URL` in Railway n8n:**
   - *Current State:* Workflow expressions call `{{ $env.CHOWDHURY_DUO_API_BASE_URL }}`.
   - *Action Required:* Set `CHOWDHURY_DUO_API_BASE_URL=https://chowdhuryduo.in` in the Railway service environment variables.
