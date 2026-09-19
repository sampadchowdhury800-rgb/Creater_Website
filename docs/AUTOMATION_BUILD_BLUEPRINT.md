# AUTOMATION BUILD BLUEPRINT

> **Canonical reference for building, extending, and operating automations in this project.**
> Every future automation MUST be implemented following this blueprint.
> Do NOT rebuild authentication, database, scheduling, or security from scratch.

---

## 1. EXISTING ARCHITECTURE

### Application / Orchestration Layer

- **Framework:** Next.js 16 on Vercel (serverless, edge-optional)
- **Role:** Hosts all automation logic as API routes under `app/api/internal/`
- **Pattern:** Production automations are **custom application code** running inside this
  Next.js project, NOT n8n workflows. n8n exists as an optional orchestration bridge for
  marketplace-style triggers, not as the primary execution engine.

### Database / State / Scheduler Layer

- **Database:** Supabase (PostgreSQL), project: `udfqrlzsgkdbvungumto.supabase.co`
- **Prisma:** Used for the main application schema (users, automations, executions, plans, billing)
- **Supabase client:** Used for Gmail AI support tables (multi-tenant schema described below)
- **Scheduling:** `pg_cron` + `pg_net` extensions in Supabase trigger HTTP calls to Vercel
  polling endpoints on a schedule.

```
pg_cron (Supabase) ──[HTTP POST]──► Vercel API route
                                    (x-cron-secret: CHOWDHURY_DUO_GATEWAY_SECRET)
```

### Infrastructure Rules

| Rule | Detail |
|---|---|
| One Vercel project | Do NOT create a second Vercel project for individual automations |
| Reuse existing infra | Auth, DB, scheduling, secrets, executions already exist |
| pg_cron for scheduling | One job per polling endpoint; use `cron.unschedule()` before re-creating |
| One gateway secret | `CHOWDHURY_DUO_GATEWAY_SECRET` — all internal service-to-service calls use this |

### Authentication Infrastructure

- **User auth:** Clerk (`@clerk/nextjs`) — Clerk User IDs are the primary tenant identifier
- **Internal service auth:** `CHOWDHURY_DUO_GATEWAY_SECRET` header (`x-cron-secret`) for
  scheduler → Vercel route authentication
- **Validation:** `lib/security/internal-auth.ts` → `validateInternalServiceRequest()`

### Encryption / Vault Infrastructure

- **Location:** `lib/crypto/vault.ts`
- **Algorithm:** AES-256-GCM
- **Key:** `AUTOMATION_VAULT_KEY` (64 hex chars, stored server-side only)
- **Usage:** Encrypt all sensitive automation credentials (API passwords, tokens, etc.)
  before persisting to the database. Never store plaintext.
- **Functions:** `vaultEncrypt(plaintext)` → `{ encryptedValue, iv, authTag, version }`,
  `vaultDecrypt({ version, iv, authTag, encryptedValue })` → plaintext

### Execution / Activity Infrastructure

- **Prisma tables:** `AutomationExecution`, `UserAutomation`
- **Pattern:** Every automation poll that processes a message should mirror a record to
  Prisma's `AutomationExecution` table so it appears in the user Activity UI.
- **Activity mirror:** Look up `UserAutomation` by `clerkUserId`, then `prisma.automationExecution.create()`

---

## 2. GMAIL CUSTOMER SUPPORT — BASELINE ARCHITECTURE

This is the reference implementation for all future automations.

### Email Flow

```
Customer email
  → Gmail inbox (IMAP)
  → Supabase pg_cron [every 1 minute]
  → POST /api/internal/gateway/gmail/poll
  → validateInternalServiceRequest()          [CHOWDHURY_DUO_GATEWAY_SECRET]
  → Load tenant gmail_accounts from Supabase  [multi-tenant loop]
  → vaultDecrypt(app_password_enc)            [AES-256-GCM]
  → listUnreadImapMessages()                  [imap.gmail.com:993 TLS]
  → fetchImapMessage()                        [full body]
  → deduplication check (automation_executions UNIQUE constraint)
  → classifyEmailIntent()                     [GMAIL_SUPPORT_AI_API_KEY]
  → retrieveBusinessKnowledge()               [Supabase full-text search]
  → generateGroundedReply()                   [GMAIL_SUPPORT_AI_API_KEY]
  → safety/confidence threshold check
  → if confident & auto_reply_enabled:
      sendSmtpReply()                         [smtp.gmail.com:465 TLS]
      markImapMessageSeen()
      prisma.automationExecution.create()     [Activity UI mirror]
  → else:
      PENDING_APPROVAL status (human review queue)
```

### What This Implementation Does NOT Use

The Gmail implementation intentionally avoids these dependencies:

| Avoided Dependency | Reason |
|---|---|
| Gmail API | Not required for App Password IMAP/SMTP |
| Google OAuth | No OAuth flow needed |
| Google Cloud Console | No GCP project required |
| Pub/Sub push notifications | Replaced by pg_cron polling |
| n8n | Not in the email-delivery critical path |

Unless explicitly requested in the future, new email automations should follow this
App Password + IMAP/SMTP pattern.

### Relevant Files

| File | Role |
|---|---|
| `app/api/internal/gateway/gmail/poll/route.ts` | Main polling endpoint |
| `lib/ai/support-engine.ts` | Gmail AI — classify, retrieve, generate |
| `lib/supabase/ai-agent.ts` | Gmail AI agent helper (used by tests) |
| `lib/integrations/providers/imap.ts` | IMAP connection wrapper |
| `lib/integrations/providers/smtp.ts` | SMTP reply sender |
| `lib/crypto/vault.ts` | Credential encrypt/decrypt |
| `lib/security/internal-auth.ts` | Gateway secret validation |
| `supabase/migrations/20260919000001_gmail_ai_support_schema.sql` | Core DB schema |
| `supabase/migrations/20260919000002_polling_scheduler_schema.sql` | pg_cron setup reference |

---

## 3. MULTI-TENANT REQUIREMENTS

Every automation MUST be designed for SaaS/multi-tenant operation.

### Isolation Guarantee

One tenant MUST NEVER access another tenant's:

- Gmail credentials or App Passwords
- Customers / contacts
- Conversations or message history
- Business rules, tone, or policies
- Knowledge base documents
- Automation execution records
- AI context or conversation history
- Automation configuration

### Tenant Identifier

The primary tenant key is the **Clerk User ID** (`clerkUserId`). In Supabase tables, this is
stored as the `slug` column in `businesses`.

### Data Scoping Pattern

All Supabase queries MUST scope by `business_id`:

```typescript
// Always filter by the tenant's business_id — never query across tenants
const { data } = await supabase
  .from('some_table')
  .select('...')
  .eq('business_id', tenantBusinessId);
```

### RLS

All Supabase tables in the automation schema have Row-Level Security (RLS) enabled.
The Vercel service role key bypasses RLS for backend operations; the anon key respects it.
Never expose the service role key to the client.

---

## 4. BUILDING A NEW AUTOMATION

When a new automation is requested, follow this checklist before writing any code:

### Pre-Implementation Questions

1. **Trigger** — What starts this automation? (Schedule? Webhook? User action? Inbound event?)
2. **Inputs** — What data does it receive? What external services does it read from?
3. **Outputs** — What does it produce? (Reply email? Database record? Notification?)
4. **Business rules** — What tenant-specific rules govern its behavior?
5. **AI behavior** — Does it use AI? Which operations? What safety constraints apply?
6. **Integrations** — Which external APIs/services does it call?
7. **Safety requirements** — What must it never do? What must be escalated?
8. **Tenant configuration** — What can a tenant configure? What is system-wide?
9. **Credentials** — What sensitive credentials does it need? How are they stored/encrypted?

### Implementation Checklist

- [ ] Reuse `CHOWDHURY_DUO_GATEWAY_SECRET` for internal service authentication
- [ ] Store sensitive credentials encrypted with `vaultEncrypt()` (never plaintext)
- [ ] Scope all DB queries by `business_id` (tenant isolation)
- [ ] Use the unique constraint pattern for deduplication (prevents double-processing)
- [ ] Mirror completed executions to Prisma `AutomationExecution` for the Activity UI
- [ ] Use a **dedicated API key environment variable** for any automation-specific AI
      (do NOT reuse `AI_SUPPORT_API_KEY` — that belongs to the website chatbot)
- [ ] Add a **safe failure path** if the dedicated API key is missing
      (do NOT silently fall back to another product's AI credentials)
- [ ] Add the new env var placeholder to `.env` only (not `.env.example`)
- [ ] Add pg_cron job if scheduling is needed (unschedule existing before creating)
- [ ] Write tests that verify tenant isolation, deduplication, and safe failure

### Scheduling Pattern

```sql
-- Always unschedule existing job with same name before creating
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '<job-name>') THEN
    PERFORM cron.unschedule('<job-name>');
  END IF;
END $$;

SELECT cron.schedule(
  '<job-name>',
  '* * * * *',   -- or appropriate cron expression
  $$
  SELECT net.http_post(
    url     := 'https://<VERCEL_DOMAIN>/api/internal/gateway/<feature>/poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CHOWDHURY_DUO_GATEWAY_SECRET>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Future Automation Store

Automations should eventually be:
1. Registered in the Prisma `Automation` table (slug, title, description, category)
2. Linked to customers via `UserAutomation` (per-tenant automation instance)
3. Configurable through the Automation Store / admin UI without code changes
4. The automation store slug and configuration schema should be designed upfront

---

## 5. CUSTOMER CONFIGURATION

Every automation that interacts with customers on behalf of a tenant MUST support
per-tenant configuration. Do NOT hard-code business-specific information.

### Gmail Customer Support Configuration Fields

The `business_rules` Supabase table captures tenant-specific configuration:

| Field | Type | Purpose |
|---|---|---|
| `company_description` | text | Company overview used in AI context |
| `products_services` | text | Products/services the AI can discuss |
| `support_policies` | text | Support SLA, response time guarantees |
| `refund_return_rules` | text | Refund/return policy the AI must follow |
| `tone` | text | AI tone (professional, friendly, formal) |
| `prohibited_responses` | text | Things the AI must NEVER say |
| `escalation_rules` | text | When to escalate to a human agent |
| `contact_info` | text | Escalation contact / support email |
| `working_hours` | text | Business hours the AI should reference |
| `custom_instructions` | text | Additional tenant-specific instructions |
| `auto_reply_enabled` | boolean | Whether AI should send replies automatically |
| `confidence_threshold` | numeric | Minimum confidence to auto-send (0.0–1.0) |
| `slack_webhook_url` | text | Optional Slack webhook for notifications |
| `slack_channel_id` | text | Optional Slack channel for notifications |

### Future Configuration Fields (Planned)

When frontend configuration UI is implemented, also support:

- Business name override
- Working days (Mon-Fri, Mon-Sat, etc.)
- Category allowlist (only answer emails about X, Y, Z)
- Categories that must always escalate to a human
- Custom knowledge documents (uploaded FAQs, policies, etc.)
- Whether unknown questions should escalate or send a polite deflection
- Email type filters (answer all, answer only support, ignore newsletters)
- AI model/temperature overrides (per-tenant, if allowed)

---

## 6. AI SAFETY REQUIREMENTS

Every AI-powered automation MUST enforce these safety constraints.

### Prohibited AI Behaviors

The AI MUST NOT fabricate or invent:

- Prices or discounts not stated in the knowledge base
- Policy exceptions or special offers not documented
- Business hours different from the configured hours
- Refund decisions without explicit policy backing
- Delivery dates or order status
- Product availability or stock levels
- Warranties or guarantees not explicitly documented
- Compensation or credits not authorized
- Legal claims or commitments
- Any business fact not grounded in tenant-provided knowledge

### Safe Failure Behavior

When the AI cannot answer with sufficient confidence:

1. Do NOT send a fabricated response
2. Do NOT use another tenant's or product's AI credentials
3. Set conversation status to `PENDING_APPROVAL`
4. Allow a human agent to review and respond
5. Optionally notify via Slack if configured

### Grounding Pipeline (Required)

All AI reply generation MUST follow this pipeline:

```
1. classifyEmailIntent()     — Is this a support email? (skip if not)
2. retrieveBusinessKnowledge() — What does the knowledge base say?
3. generateGroundedReply()   — Generate reply strictly from knowledge base
4. confidence threshold check — Only send if confidence >= tenant threshold
5. output sanitization       — Strip injection attempts
6. SMTP send OR escalate     — Based on confidence and auto_reply_enabled
```

### Prompt Injection Defense

The AI prompt system MUST include explicit injection-resistance instructions:

```
Ground your response strictly on the provided knowledge context.
If the answer cannot be determined with high confidence, state clearly
that the inquiry has been escalated to a senior support specialist.
Never fabricate facts or make commitments outside the documented policies.
```

---

## 7. AI CONFIGURATION PATTERN

### Dedicated Environment Variables Per Product Feature

Each product feature that uses AI MUST have its own dedicated credential and configuration.
Never share AI credentials between product features.

| Feature | API Key Env Var | Base URL Env Var | Model Env Var |
|---|---|---|---|
| Website chatbot | `AI_SUPPORT_API_KEY` | `AI_SUPPORT_BASE_URL` | `AI_SUPPORT_MODEL` |
| Gmail Customer Support | `GMAIL_SUPPORT_AI_API_KEY` | `GMAIL_SUPPORT_AI_BASE_URL` | `GMAIL_SUPPORT_AI_MODEL` |
| *(future feature)* | `<FEATURE>_AI_API_KEY` | `<FEATURE>_AI_BASE_URL` | `<FEATURE>_AI_MODEL` |

### Safe Failure Rule

If the dedicated API key for a feature is missing or empty:

- **MUST:** Fail safely (escalate, set PENDING_APPROVAL, or return error)
- **MUST NOT:** Fall back to another feature's API key
- **MUST NOT:** Fall back to generic `AI_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`
- **MUST NOT:** Send an AI-generated message using credentials that don't belong to this feature

### AI Client Pattern (OpenAI-compatible)

All AI calls in this project use the OpenAI-compatible chat completions API:

```typescript
// Standard pattern — OpenRouter or any OpenAI-compatible provider
const res = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': siteOrigin,      // Required by OpenRouter
    'X-Title': '<Feature Name>',    // Required by OpenRouter
  },
  body: JSON.stringify({ model, messages, temperature, max_tokens }),
});
```

### OpenRouter Configuration

OpenRouter is the default AI provider for this project:

- Base URL: `https://openrouter.ai/api/v1`
- Free model alias: `openrouter/free`
- Free-tier pinned models use `:free` suffix (e.g., `meta-llama/llama-3.1-8b-instruct:free`)
- Free-only enforcement: `AI_SUPPORT_FREE_ONLY=true` (chatbot) — set to `false` to allow paid models
- OpenRouter is OpenAI API-compatible; the same fetch client works for all models

---

## 8. ENVIRONMENT VARIABLES REFERENCE

### Current Production Variables

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | Server | Neon PostgreSQL (Prisma) |
| `SESSION_SECRET` | Server | Admin session signing |
| `CLERK_SECRET_KEY` | Server | Clerk auth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Clerk client |
| `RAZORPAY_KEY_ID` | Server | Razorpay payments |
| `RAZORPAY_KEY_SECRET` | Server | Razorpay payments |
| `RAZORPAY_WEBHOOK_SECRET` | Server | Razorpay webhook verification |
| `AUTOMATION_VAULT_KEY` | Server | AES-256-GCM credential encryption |
| `CHOWDHURY_DUO_GATEWAY_SECRET` | Server | Internal service-to-service auth |
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase admin access (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Server | Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase URL (client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (client) |
| `AI_SUPPORT_API_KEY` | Server | **Website chatbot AI** (OpenRouter) |
| `AI_SUPPORT_MODEL` | Server | **Website chatbot** model |
| `AI_SUPPORT_BASE_URL` | Server | **Website chatbot** base URL |
| `AI_SUPPORT_FREE_ONLY` | Server | Enforce free-tier chatbot models |
| `GMAIL_SUPPORT_AI_API_KEY` | Server | **Gmail Support AI** (dedicated) |
| `GMAIL_SUPPORT_AI_BASE_URL` | Server | **Gmail Support AI** base URL |
| `GMAIL_SUPPORT_AI_MODEL` | Server | **Gmail Support AI** model |
| `BREVO_API_KEY` | Server | Brevo transactional email |
| `SUPPORT_EMAIL` | Server | Default support email address |
| `CLOUDINARY_CLOUD_NAME` | Server | Cloudinary media storage |
| `CLOUDINARY_API_KEY` | Server | Cloudinary API |
| `CLOUDINARY_API_SECRET` | Server | Cloudinary secret |
| `N8N_BASE_URL` | Server | n8n instance URL (optional) |
| `N8N_API_KEY` | Server | n8n API key (optional) |
| `NEXT_PUBLIC_SITE_URL` | Public | Production site URL |

> [!CAUTION]
> Never add `NEXT_PUBLIC_` prefix to any secret. Never log or print secret values.
> Never commit actual secrets — only placeholders.

---

## 9. SECURITY CHECKLIST

Before shipping any new automation:

- [ ] No plaintext credentials in database or logs
- [ ] All secrets are server-side only (no `NEXT_PUBLIC_` prefix)
- [ ] Internal endpoints validate `CHOWDHURY_DUO_GATEWAY_SECRET`
- [ ] RLS is enabled on all new Supabase tables
- [ ] All DB queries are scoped by `business_id`
- [ ] AI prompts include injection-resistance instructions
- [ ] AI cannot fabricate business facts
- [ ] Missing API key causes safe failure, not silent fallback
- [ ] Tests verify tenant isolation (tenant A cannot see tenant B's data)
- [ ] Tests verify deduplication (same message is not processed twice)
- [ ] Tests verify safe failure if credentials are absent
- [ ] New env vars added to `.env` as placeholders only (not `.env.example`)
- [ ] Vercel production environment variables updated manually

---

## 10. KNOWN PATTERNS AND GOTCHAS

### Cron Job Management

The pg_cron job must be **manually run** via Supabase Dashboard → SQL Editor.
Running `supabase db push` does NOT apply these migrations automatically.
Always unschedule the old job before creating the new one to avoid duplicates.

### Prisma vs. Supabase

This project uses both:
- **Prisma:** Application schema — users, automations, plans, billing, executions (Activity UI)
- **Supabase JS client:** Gmail AI support schema — businesses, gmail_accounts, conversations, messages

Do NOT mix them up. Prisma queries go through `lib/prisma.ts`. Supabase queries go through
`lib/supabase/server.ts` (server-side) or `lib/supabase/client.ts` (client-side).

### The Activity UI Mirror Pattern

When an automation completes processing (success or escalation), mirror a record to Prisma:

```typescript
const userAuto = await prisma.userAutomation.findFirst({
  where: { clerkUserId: business.slug },
  select: { id: true, clerkUserId: true },
});
if (userAuto) {
  await prisma.automationExecution.create({
    data: {
      userAutomationId: userAuto.id,
      clerkUserId: userAuto.clerkUserId,
      status: 'COMPLETED',
      startedAt: new Date(),
      completedAt: new Date(),
      input: { /* automation input */ },
      output: { /* automation output */ },
    },
  });
}
```

### Deduplication Pattern

Use a UNIQUE constraint in the database for atomic deduplication:

```typescript
// Attempt atomic claim — will fail if already claimed by another poll cycle
const { data: claim, error: claimErr } = await supabase
  .from('automation_executions')
  .insert({ business_id, gmail_message_id: messageId, status: 'PROCESSING', ... })
  .select('id')
  .single();

if (claimErr) continue; // Duplicate — already being processed
```

### Polling Latency Note

Changing the pg_cron schedule from `*/5 * * * *` to `* * * * *` reduces the maximum
scheduler polling interval from 5 minutes to 1 minute. This does NOT guarantee a
one-minute end-to-end reply time. Additional latency sources include:

- AI inference time (varies by model and provider)
- IMAP connection and message fetch time
- Supabase database operations
- SMTP delivery time
- External provider latency

---

*Last updated: 2026-09-19*
*Maintained by the project engineering team.*
