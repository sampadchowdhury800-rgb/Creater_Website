<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document n8n orchestration architecture, target workflows, node topologies, and operating rules.
-->

# n8n Automation Architecture & Operating Rules

This document details the n8n workflow orchestration topology, node pipeline structures, environment separations, and strict security rules.

Key source paths:
- `deployments/n8n/gmail_Customer_Support_Agent.json`
- `deployments/n8n/gmail_Backend_Poll_Scheduler.json`
- `app/api/internal/automation/`
- `app/api/internal/gateway/gmail/`

---

## 1. Operating Rules & Boundaries

1. **Environment Separation:**
   - **Local n8n (`localhost:5678`):** Restricted to local development, simulated mock runs, and sandbox experimentation.
   - **Railway n8n (`n8n-production-a20f.up.railway.app`):** The authoritative production instance.
2. **Orchestration vs. Authority:**
   - n8n coordinates transitions between nodes, branches, and retries.
   - The Next.js backend remains the **exclusive security and business-logic authority**.
   - n8n **NEVER** stores or receives permanent Gmail OAuth refresh/access tokens.
   - All backend calls require transient execution grants and internal shared secret headers.
3. **Pre-Production Guardrails:**
   - Workflows must **remain INACTIVE** until controlled baseline verification is complete.
   - Under no circumstances should workflows be activated against live customer inboxes without authorization.

---

## 2. Target Production Workflow: `gmail_Customer_Support_Agent`

- **Workflow Name:** `gmail_Customer_Support_Agent`
- **Workflow ID:** `AESai9x1nAP41VKO`
- **Trigger Type:** Inbound Webhook (`POST /webhook/v1/inbound-event`)
- **Current Status:** **INACTIVE** (`active: false`)

### Pipeline Topology & Node Graph

```
[ Webhook: Authorized Inbound Event ]
                   │
                   ▼
       [ Code: Validate Context ]
                   │
                   ▼
[ HTTP: Resolve Execution & Entitlements ]
                   │
                   ▼
    [ Switch: Grant & Entitlement Guard ]
         │ (Valid & Entitled)         │ (Invalid / Expired)
         │                            ▼
         │                 [ NoOp: Entitlement Stopped ]
         ▼
[ HTTP: Ingest & Deduplicate Email ]
         │
         ▼
    [ Switch: Idempotency Guard ]
         │ (New & Locked)             │ (Duplicate)
         │                            ▼
         │                   [ NoOp: Duplicate ]
         ▼
[ HTTP: Process AI Inference & Policy ]
         │
         ▼
    [ Switch: Route Backend Action ]
         ├── AUTO_REPLY   ─────────► [ HTTP: Send Reply via Gmail Gateway ]
         │                                         │
         │                                         ▼
         │                           [ HTTP: Finalize Execution Success ]
         │                                         │
         │                                         ▼
         │                                 [ NoOp: Completed ]
         │
         ├── HUMAN_REVIEW ─────────► [ HTTP: Mark Human Review ]
         │                                         │
         │                                         ▼
         │                               [ NoOp: Review Queued ]
         │
         ├── IGNORE       ─────────► [ NoOp: Ignored ]
         │
         └── FAILED / Fallback ───► [ HTTP: Record Failure ]
                                                   │
                                                   ▼
                                           [ NoOp: Failed ]
```

### Node Inventory & Contracts

| Node Name | Node Type | Target Endpoint / Purpose |
|---|---|---|
| `Webhook: Authorized Inbound Event` | `n8n-nodes-base.webhook` | Receives `GMAIL_INBOUND_NOTIFICATION` event from backend poll worker |
| `Code: Validate Context` | `n8n-nodes-base.code` | Validates presence of `eventId`, `eventType`, `tenantId`, `emailId`, `threadId`, `executionGrantId` |
| `HTTP: Resolve Execution & Entitlements` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/automation/grants/validate` to verify tenant subscription and grant validity |
| `Switch: Grant & Entitlement Guard` | `n8n-nodes-base.switch` | Passes only if `status === "VALID"` and `isEntitled === true` |
| `HTTP: Ingest & Deduplicate Email` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/gateway/gmail/fetch-and-lock` to acquire atomic processing lock |
| `Switch: Idempotency Guard` | `n8n-nodes-base.switch` | Halts execution if `isDuplicate === true` |
| `HTTP: Process AI Inference & Policy` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/automation/process-email` for RAG, prompt defense, and action routing |
| `Switch: Route Backend Action` | `n8n-nodes-base.switch` | Multi-way switch evaluating `action` (`AUTO_REPLY`, `HUMAN_REVIEW`, `IGNORE`, `FAILED`) |
| `HTTP: Send Reply via Gmail Gateway` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/gateway/gmail/send-reply` with `idempotencyKey: idem_reply_<emailId>` |
| `HTTP: Finalize Execution Success` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/automation/record-outcome` with `status: SUCCESS` |
| `HTTP: Mark Human Review` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/automation/queue-review` with draft reply and reason |
| `HTTP: Record Failure` | `n8n-nodes-base.httpRequest` | Calls `/api/internal/automation/record-outcome` with `status: FAILED` |

---

## 3. Production Polling Scheduler: `gmail_Backend_Poll_Scheduler`

- **Workflow Name:** `gmail_Backend_Poll_Scheduler`
- **Workflow ID:** `eFgsgtIqInoZDMJy`
- **Trigger Type:** Schedule Trigger (`n8n-nodes-base.scheduleTrigger`)
- **Schedule Interval:** Every 2 minutes
- **Current Status:** **INACTIVE** (`active: false`)

### Topology
```
[ Schedule: Poll Gmail Every 2 Minutes ]
                   │
                   ▼
[ HTTP: Call Gmail Polling Gateway ] ──► POST https://chowdhuryduo.in/api/internal/gateway/gmail/poll
```

- **Separation of Concerns:** The scheduler triggers the backend polling coordinator. It carries no payload, has no customer context, and does not interact directly with the support agent workflow.
- **Authentication:** Must have `Chowdhury Duo Backend Service` (`httpHeaderAuth`) attached.
