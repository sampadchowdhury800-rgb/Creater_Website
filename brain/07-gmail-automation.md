<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document Gmail inbound polling architecture, baseline timestamp protections, and idempotency strategy.
-->

# Gmail Inbound Automation & Baseline Protection

This document outlines the scheduled polling architecture for Gmail inboxes, detailing timestamp baseline protections, idempotency locks, and the transition away from Google Cloud Pub/Sub.

Key source paths:
- `app/api/internal/gateway/gmail/poll/route.ts` (Core polling coordinator)
- `app/api/internal/gateway/gmail/fetch-and-lock/route.ts` (Atomic message lock & ingestion)
- `app/api/internal/gateway/gmail/send-reply/route.ts` (Outbound reply gateway)
- `lib/integrations/grant-service.ts` (Transient grant lifecycle)
- `lib/integrations/providers/google.ts` (Gmail API client)

---

## 1. Architectural Shift: Polling vs. Pub/Sub

The Chowdhury Duo platform **intentionally does not depend on Google Cloud Pub/Sub push notifications**:
- **No Google Cloud Billing / Credit Card Requirement:** Avoids requiring customers or the platform to maintain GCP billing accounts, Pub/Sub topics, or IAM subscription policies.
- **Scheduled Polling Architecture:** Inbound messages are processed via scheduled pull coordination triggered by `gmail_Backend_Poll_Scheduler` (every 2 minutes) calling `/api/internal/gateway/gmail/poll`.
- **Legacy Components:** Legacy watch and webhook routes (`app/api/webhooks/gmail/`, `app/api/integrations/google/watch/`, `app/api/cron/renew-watches/`) remain in the codebase for backward compatibility, but are **not** the active inbound path.

---

## 2. End-to-End Orchestration Lifecycle

```
1. Railway Scheduler (eFgsgtIqInoZDMJy) runs every 2 minutes
   └─► POST https://chowdhuryduo.in/api/internal/gateway/gmail/poll
         │
2. Backend discovers active connected accounts
   └─► IntegrationConnection.findMany({ provider: "GOOGLE", status: "CONNECTED" })
         │
3. Strict Tenant Isolation & Entitlement Check
   └─► checkAutomationAccess(tenantId, automationId)
         │
4. Baseline Calculation & Gmail Query
   ├─► baselineDate = UserAutomationIntegration.createdAt || connection.createdAt
   ├─► query = "is:unread label:INBOX after:" + Math.floor(baselineDate / 1000)
   └─► executeGmailReadList(accessToken, { query })
         │
5. Defense-in-Depth Timestamp Check
   └─► executeGmailGetMessage(accessToken, { messageId, format: "metadata" })
       If message.internalDate < baselineDate -> SKIP (messagesSkippedBaseline++)
         │
6. Atomic Claim & Execution Creation (Transaction)
   ├─► Lock idempotencyKey: "poll_claim_" + messageId
   ├─► Create AutomationExecution (status: "QUEUED")
   └─► Mint transient AutomationExecutionGrant (5-minute TTL)
         │
7. Event Dispatch to Railway n8n
   └─► POST N8N_SUPPORT_WEBHOOK_URL with GMAIL_INBOUND_NOTIFICATION payload
         │
8. n8n Executes 'gmail_Customer_Support_Agent' (AESai9x1nAP41VKO)
   ├─► Validate Grant -> Ingest & Deduplicate -> AI Inference & Policy
   └─► Decision:
         ├── AUTO_REPLY   ──► /api/internal/gateway/gmail/send-reply (idem_reply_<id>)
         ├── HUMAN_REVIEW ──► /api/internal/automation/queue-review
         ├── IGNORE       ──► Terminal NoOp
         └── FAILED       ──► /api/internal/automation/record-outcome
```

---

## 3. Initial Baseline Protection

To ensure an automation connecting to an existing Gmail inbox does not trigger hundreds of unread historical emails:

1. **Baseline Inception:** The baseline timestamp is set when the customer connects their account:
   $$\text{Baseline} = \text{UserAutomationIntegration.createdAt} \lor \text{IntegrationConnection.createdAt}$$
2. **Search Filter:** Polling requests to Google API include an explicit epoch boundary:
   ```
   is:unread label:INBOX after:<baseline_epoch_seconds>
   ```
3. **Defense-in-Depth Metadata Verification:** Because Gmail's search index operates at 1-day granularity for date queries, every candidate message undergoes secondary metadata inspection (`executeGmailGetMessage` with format `metadata`). If the message's `internalDate` is prior to `baselineDate`, it is immediately discarded (`messagesSkippedBaseline++`).
4. **Token Refresh Invariance:** Normal OAuth token refreshes update `lastRefreshedAt` while `createdAt` remains unchanged. Routine credential refreshes never shift the baseline.
5. **Re-connection Behavior:** If a customer disconnects and reconnects their account, a fresh `IntegrationConnection` is generated, establishing a new baseline from that moment forward.

---

## 4. Multi-Layer Idempotency Strategy

Duplicate email processing is prevented across three sequential layers:

1. **Pre-Ingest Claim Lock:** During polling, an atomic database transaction writes `AutomationGatewayOperation` with `idempotencyKey = "poll_claim_" + emailId`. If another worker or process is evaluating the message, the unique constraint immediately halts execution.
2. **Fetch-and-Lock Barrier:** When n8n invokes `/api/internal/gateway/gmail/fetch-and-lock`, a second lock key (`fetch_lock_` + `emailId`) is acquired and verified against `ProcessedGmailEvent`. Duplicate requests return `isDuplicate: true` and exit immediately.
3. **Outbound Send Idempotency:** When `/api/internal/gateway/gmail/send-reply` is called, it requires `idempotencyKey = "idem_reply_" + emailId`. If already dispatched, the existing `sentMessageId` is returned from cache without sending another email.
