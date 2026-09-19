# Business Configuration & Support Supervisor Architecture

## 1. Overview & Architecture
This document details the multi-tenant SaaS Business Information, Business Knowledge, Support Scope, and Decision Supervisor architecture for the automation platform.

```
+-------------------------------------------------------------+
|                  BUSINESS OWNER CONFIGURATION               |
|  (Profile, Weekly Operating Hours, Structured Policies)     |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     BUSINESS INFORMATION                    |
|  (Brand name, timezone, contact info, business description) |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                    BUSINESS RULES & POLICIES                |
|  (Refund, Return, Cancellation, Warranty, Shipping, Payment)|
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                   KNOWLEDGE DOCUMENTS (RAG)                 |
|  (Full-text / pgvector search strictly scoped to tenant)    |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 SUPPORT SUPERVISOR LAYER                    |
|  Deterministic routing:                                     |
|  1. Mailbox support_enabled check                           |
|  2. Business hours & after-hours rules check                |
|  3. Email classification & category extraction              |
|  4. Category enablement check (scope filter)                |
|  5. Escalation triggers (complaints, refunds, confidence)   |
|  6. Knowledge retrieval                                     |
|  7. Grounded reply generation                               |
|  8. Guardrail validation (no halluncinations/leaks)         |
+-------------------------------------------------------------+
                               |
            +------------------+------------------+
            |                  |                  |
            v                  v                  v
     [AUTO_REPLY]       [HUMAN_REVIEW]      [FALLBACK / SKIP]
       via SMTP           Flag in DB         Safe notice / skip
```

---

## 2. Source-of-Truth Hierarchy
When the AI generates customer responses, it follows this strict priority:

1. **System Safety & Platform Rules** (Absolute priority — zero secret/prompt leakage)
2. **Business Profile & Contact Info** (Official business identity)
3. **Structured Business Policies** (Refund, return, cancellation, shipping, warranty, working hours)
4. **Approved Knowledge Documents** (Tenant-specific FAQs and guides)
5. **Email Context** (Customer question and message history)
6. **Model General Knowledge** (Lowest priority — **NEVER allowed to invent business policies, prices, or delivery commitments**)

---

## 3. Data Model

### `businesses` Table (Extended)
- `id` (uuid, PK)
- `slug` (text, unique tenant identifier)
- `name` (text)
- `brand_name` (text, customer-facing brand)
- `business_type` (text, category e.g. SaaS, E-commerce)
- `description` (text)
- `website` (text)
- `contact_email` (text)
- `contact_phone` (text)
- `address`, `city`, `state`, `country` (text)
- `timezone` (text, e.g. `Asia/Kolkata`, `UTC`, `America/New_York`)
- `currency` (text, e.g. `USD`, `INR`, `EUR`)

### `business_rules` Table (Extended)
- `business_id` (uuid, FK businesses)
- Structured policies: `refund_policy`, `return_policy`, `cancellation_policy`, `warranty_policy`, `shipping_policy`, `order_policy`, `payment_policy`, `product_service_info`
- Brand voice: `tone`, `greeting_preference`, `sign_off_preference`, `mention_business_name`, `mention_support_team`, `custom_writing_instructions`
- Unknown questions: `unknown_question_behavior` (`NO_REPLY` | `FALLBACK_RESPONSE` | `NOTIFY_TEAM` | `HUMAN_REVIEW`), `fallback_message`
- After hours: `after_hours_behavior` (`REPLY_NORMALLY` | `AFTER_HOURS_MESSAGE` | `DO_NOT_REPLY` | `ESCALATE`), `after_hours_message`
- Guardrails: `max_reply_length`, `complaints_require_human`, `refunds_require_human`

### `business_hours` Table (New)
- `id` (uuid, PK)
- `business_id` (uuid, FK businesses)
- `day_of_week` (integer 0–6: 0=Sunday, 1=Monday ... 6=Saturday)
- `open_time` (text, HH:MM 24h format)
- `close_time` (text, HH:MM 24h format)
- `is_closed` (boolean)
- `timezone` (text)

### `support_categories` & `business_support_categories` Tables (New)
- 19 Standard Categories: `customer_support`, `general_questions`, `business_hours`, `product_questions`, `service_questions`, `pricing_questions`, `order_questions`, `shipping_questions`, `delivery_questions`, `returns`, `refunds`, `cancellations`, `warranty`, `complaints`, `product_availability`, `appointment_questions`, `booking_questions`, `account_questions`, `other`.
- Per-tenant toggles: `enabled`, `requires_human_review`, `auto_reply`.

### `gmail_accounts` Table (Extended)
- `id` (uuid, PK)
- `business_id` (uuid, FK businesses)
- `email` (text)
- `support_enabled` (boolean, default true)
- `auto_reply_enabled` (boolean, default true)
- `custom_instructions` (text)
- `signature` (text)
- `app_password_enc/iv/tag` (AES-256-GCM encrypted)

---

## 4. Support Supervisor Decision Flow
Deterministic application logic evaluates:
1. **Mailbox Active Check**: If `account.support_enabled === false` -> `SKIP`.
2. **Business Hours Evaluation**: Using tenant's timezone. If outside hours -> respects `after_hours_behavior` (`REPLY_NORMALLY`, `AFTER_HOURS_MESSAGE`, `DO_NOT_REPLY`, `ESCALATE`).
3. **Intent Classification**: Evaluates customer message against standard categories.
4. **Category Scope Filter**: Checks if category is enabled for this business. If disabled -> respects `unknown_question_behavior`.
5. **Human Escalation Check**:
   - `complaints_require_human` -> escalates complaints
   - `refunds_require_human` -> escalates refunds
   - `confidence < threshold` -> escalates low-confidence queries
   - Category-level `requires_human_review === true` -> escalates
6. **Grounding & Reply Generation**: Injects structured policies, tone, and tenant knowledge into prompt.
7. **AI Guardrail Validation**:
   - Blocks secret exposures (API keys, vault keys, passwords)
   - Blocks internal system prompt leaks
   - Blocks unauthorized transactional claims ("I have processed your refund")
   - Blocks fabricated price quotes when pricing policies are missing
8. **Action Dispatch**: Sends SMTP response (`AUTO_REPLY`, `FALLBACK`, `AFTER_HOURS`) or marks conversation `PENDING_APPROVAL` for `HUMAN_REVIEW`.

---

## 5. Multi-Account Support
A single business can connect multiple Gmail accounts (`support@example.com`, `billing@example.com`, `orders@example.com`).
- Polling iterates over each connected account independently.
- Each account maintains its own status, `last_polled_at`, and `last_error`.
- Each account can have individual `support_enabled` and `auto_reply_enabled` toggles.

---

## 6. How Future Automations Consume Business Configuration
Any future automation (e.g. WhatsApp Support, Website Chat, Slack Bot, Shopify Automation) can reuse the identical service layer:
```ts
import { getBusinessProfile } from "@/lib/services/business-profile";
import { getBusinessRules } from "@/lib/services/business-rules";
import { getBusinessHours, isWithinBusinessHours } from "@/lib/services/business-hours";
import { evaluateSupportDecision } from "@/lib/services/support-supervisor";
```
The decision engine accepts generic parsed messages and returns standard supervisor decisions, making it completely decoupled from Gmail IMAP/SMTP transport.
