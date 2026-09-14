# Dynamic Automation Pricing, Entitlements & Razorpay Billing System

## Architectural Overview

This system decouples commercial pricing, entitlements, transactions, and runtime workspaces into distinct, production-grade architectural layers.

No pricing logic, plan durations, trial days, or maintenance fees are hardcoded into application code. **The Admin Panel is the sole source of truth for the commercial model of every automation product.**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CATALOG DEFINITION (Admin Configurable)                  │
│    Automation ──1:N──> AutomationPlan                      │
│    (Defines display metadata, plan tiers, durations, prices)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. COMMERCIAL TRANSACTIONS (Financial Audit Trail)          │
│    Order ──1:N──> OrderItem (Plan Snapshots: price, terms)   │
│    UserSubscription (Razorpay recurring billing records)    │
│    ProcessedWebhookEvent (Idempotent webhook ledger)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. ACCESS ENTITLEMENTS (Authorization Source of Truth)      │
│    AutomationEntitlement (Audit history of all grants)      │
│    AutomationTrialTracker (One-trial-per-user enforcement)   │
│    checkAutomationAccess() -> Deterministic state machine   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. RUNTIME WORKSPACE (Never Destroyed by Billing Expiry)    │
│    UserAutomation (Configs & runtime state)                 │
│    UserAutomationSecret (Encrypted credential vault)        │
│    AutomationExecution (Execution logs)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Database Architecture & Models

### `AutomationPlan`
Represents an Admin-defined pricing package attached to an `Automation`:
* `planType`: Generic classification (`TRIAL`, `TIME_LIMITED`, `LIFETIME`).
* `price`: Integer in paise (strictly 0 for free trials).
* `durationDays`: Duration in days for `TIME_LIMITED` plans (e.g. 30, 90, 180, 365). `null` for `LIFETIME`.
* `trialDays`: Duration in days for `TRIAL` plans (e.g. 5, 7, 14).
* `maintenanceEnabled`: Boolean toggling recurring maintenance.
* `maintenancePrice`: Monthly maintenance fee in paise (e.g. 29900 = ₹299/mo).
* `maintenanceInterval`: `MONTHLY` or `YEARLY`.
* `maintenanceStartRule`: `AFTER_ACCESS_EXPIRY` or `IMMEDIATELY`.
* `razorpayPlanId`: Cached Razorpay Plan ID (`plan_xxxx`) for active recurring billing.
* `isActive`: Soft-activation flag so retired plans never break historical orders.

### `AutomationEntitlement`
Maintains an auditable trail of all grants for a customer without overwriting past history:
* `clerkUserId`, `automationId`, `planId`, `orderId`, `userAutomationId`.
* `status`: `ACTIVE`, `TRIAL`, `EXPIRED`, `GRACE_PERIOD`, `SUSPENDED`, `REVOKED`, `SUPERSEDED`.
* `isLifetime`: Boolean flag for perpetual access.
* `startsAt`, `expiresAt`, `gracePeriodEndsAt`.
* `maintenanceStatus`: `NOT_APPLICABLE`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `CANCELLED`.
* `maintenanceSubscriptionId`: Link to `UserSubscription`.

### `AutomationTrialTracker`
Enforces strict one-trial-per-user abuse prevention via a composite unique index on `@@unique([clerkUserId, automationId])`.

### `UserSubscription`
Tracks recurring Razorpay Subscriptions for monthly maintenance:
* `razorpaySubscriptionId` (`sub_xxxx`).
* `razorpayPlanId` (`plan_xxxx`).
* `status`: `PENDING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, `HALTED`.

### `ProcessedWebhookEvent`
Guarantees webhook idempotency with `eventId` uniqueness.

---

## 2. Centralized Access Evaluator (`checkAutomationAccess`)

Located in [`lib/entitlement/checker.ts`](file:///c:/Users/Sampad%20Chowdhury/OneDrive/Documents/website/chowdhury_duo_professional_website/lib/entitlement/checker.ts):
```ts
export async function checkAutomationAccess(
  clerkUserId: string,
  automationId: string
): Promise<EntitlementAccessResult>
```

### Deterministic State Machine:
1. **Lifetime Entitlement (`isLifetime === true`):**
   * If maintenance is required and `maintenanceStatus === PAST_DUE` with expired grace: access restricted (`MAINTENANCE_PAST_DUE`).
   * Otherwise: `hasAccess = true` (`LIFETIME`).
2. **Time-Limited Entitlement (`status === ACTIVE`):**
   * Extends furthest `expiresAt` into the future.
   * If maintenance is past due beyond grace period: `MAINTENANCE_PAST_DUE`.
   * If `expiresAt > now`: `hasAccess = true` (`VALID`).
3. **Trial Entitlement (`status === TRIAL`):**
   * If `expiresAt > now`: `hasAccess = true` (`TRIAL_ACTIVE`).
   * If `expiresAt <= now`: `hasAccess = false` (`TRIAL_EXPIRED`).
4. **Expired Access:**
   * Returns `hasAccess = false` (`EXPIRED`).
   * **Workspace and vault secrets are never deleted.**

---

## 3. Order Creation & Verification Lifecycle

### One-Time Access Plans:
1. Client calls `POST /api/orders/create` with `{ automationId, planId }`.
2. Server loads the `AutomationPlan` from the database.
3. Server takes immutable snapshots in `OrderItem`:
   * `titleSnapshot`, `planNameSnapshot`, `planCodeSnapshot`, `priceSnapshot`, `durationDaysSnapshot`, `isLifetimeSnapshot`, `maintenancePriceSnapshot`.
4. Razorpay Order is generated in paise server-side.
5. On checkout completion, `POST /api/orders/verify` validates HMAC-SHA256 signature using `crypto.timingSafeEqual`.
6. `grantOrExtendEntitlement()` provisions or extends access:
   * **No Lost Days:** If the user already has 10 days remaining on an active pass, purchasing 30 days extends the expiry from the current `expiresAt` (to 40 days).
   * Upgrading to Lifetime sets `isLifetime = true` and `expiresAt = null`.

### Free Trials:
1. Client calls `POST /api/automations/[id]/trial`.
2. Validates user authentication.
3. Checks `AutomationTrialTracker` (rejects if already claimed).
4. Atomically registers tracker, upserts `UserAutomation`, and creates `AutomationEntitlement` (`status = TRIAL`, `expiresAt = now + trialDays`). Zero payment gateway friction.

---

## 4. Recurring Maintenance & Razorpay Subscriptions

1. Plans with maintenance configured call `getOrCreateRazorpayPlan()`.
2. **Plan Versioning:** If the Admin modifies the maintenance price from ₹299 to ₹399:
   * A new Razorpay Plan is provisioned for future customers.
   * Existing subscribers remain on their original plan ID.
3. **Failure & Grace Period:**
   * When Razorpay fires `payment.failed`, the entitlement status transitions to `PAST_DUE` with a 7-day grace period.
   * Access is maintained during the 7 days.
   * If payment remains uncollected after 7 days, execution engine restricts runs with `MAINTENANCE_PAST_DUE`.
   * Reactivating clears past-due state and restores access immediately.

---

## 5. Admin Panel Experience

Accessible via `/admin/automations/[id]/plans`:
1. Non-developer admins can add, edit, reorder, and toggle plans dynamically.
2. The form dynamically toggles inputs based on `planType`:
   * `TRIAL`: displays `trialDays`, locks price to ₹0.
   * `TIME_LIMITED`: reveals arbitrary `durationDays`.
   * `LIFETIME`: locks duration to perpetual.
   * `Maintenance`: toggles `maintenancePrice`, interval, and start rule.
3. Changes immediately reflect in the marketplace with zero developer intervention.

---

## 6. Verification Summary

* **Automated Test Suite (`scripts/test-pricing-entitlements.ts`):** 9/9 phases passed with 100% success.
* **Typecheck (`npx tsc --noEmit`):** 0 errors.
* **Linter (`npm run lint`):** 0 errors.
* **Production Build (`npm run build`):** Successful compilation and bundling of all 44 routes.
