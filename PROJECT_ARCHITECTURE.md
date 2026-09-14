# PROJECT_ARCHITECTURE.md
## Chowdhury Duo Professional Website — Automation Platform

> **Phase 4 Audit** — Generated from actual code inspection, not assumptions.
> Every item is marked as IMPLEMENTED, PARTIALLY IMPLEMENTED, or NOT IMPLEMENTED.

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.10 |
| Runtime | Node.js | 24.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL (via Neon serverless) | — |
| ORM | Prisma | 7.9.0 |
| Auth (Users) | Clerk | @clerk/nextjs ^7.7.4 |
| Auth (Admin) | Custom session (bcrypt + HMAC cookie) | bcryptjs ^3.0.3 |
| Payments | Razorpay | ^2.9.8 |
| Image/File Storage | Cloudinary | ^2.10.0 |
| Execution Engine | n8n (server-side only) | — |
| Styling | Tailwind CSS v4 | ^4 |
| Forms | react-hook-form + zod | ^7.83.0 / ^4.4.3 |
| Rich Text | TipTap | ^3.29.0 |
| Build | Turbopack (Next.js) | — |

---

## 2. Authentication

### User Authentication (Clerk)
IMPLEMENTED

- clerkMiddleware() in proxy.ts handles Clerk for non-admin routes.
- getCurrentUserId() in lib/auth-server.ts returns the Clerk userId server-side.
- No Clerk user records stored in DB — clerkUserId used as a foreign key string.

### Admin Authentication (Custom Session)
IMPLEMENTED

- Admin model: email, passwordHash via bcryptjs.
- AdminSession model: token, expiresAt, ipAddress, userAgent.
- Cookie: admin_session — HMAC-SHA256 signed with SESSION_SECRET.
- lib/session.ts: getAdminSession(), requireAdminSession(), cleanupAuthData().
- proxy.ts: Admin routes checked BEFORE Clerk.
- Rate limiting: RateLimit model (per-IP, attempts + lockout).
- Audit log: AuditLog model (LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT events).

---

## 3. Database

### Provider
- PostgreSQL via @neondatabase/serverless + @prisma/adapter-neon.
- Prisma v7.9.0 with prisma.config.ts at project root.
- Single migration: 20260726075048_initial_admin_cms.

### Models (Verified in schema.prisma)

**Admin and Security:**
- Admin — admin credentials
- AdminSession — session tokens
- RateLimit — per-IP brute-force protection
- AuditLog — admin action logs

**CMS:**
- Post, Category, Tag, Comment, Media, Setting, PageVisit

**Content:**
- Service, Project, Person, SocialProfile

**Automation Marketplace:**
- Automation — core product record
- AutomationMedia — product images/videos
- AutomationFile — downloadable product resources
- AutomationCategory — product taxonomy
- AutomationReview — one-per-user reviews with rating
- AutomationComment — threaded product comments

**Commerce:**
- Cart / CartItem — shopping cart (Clerk userId)
- Wishlist / WishlistItem — wishlist
- Order / OrderItem — orders with price snapshot
- Razorpay data: razorpayOrderId, razorpayPaymentId, razorpaySignature

**User Ownership and Execution:**
- UserAutomation — user-to-automation ownership record
- AutomationExecution — real execution history

**Enums:**
- AutomationStatus: DRAFT, PUBLISHED, ARCHIVED
- PricingType: ONE_TIME, SUBSCRIPTION, FREE
- UserAutomationStatus: NOT_CONFIGURED, ACTIVE, PAUSED, PENDING, DISABLED
- ExecutionStatus: QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
- OrderStatus: PENDING, CONFIRMED, CANCELLED, REFUNDED
- PaymentStatus: PENDING, PAID, FAILED, REFUNDED

---

## 4. Admin System — IMPLEMENTED

- Admin panel at /admin/*
- Sidebar nav: AdminSidebarClient.tsx
- Admin dashboard: /admin/page.tsx
- All admin server actions go through requireAdminSession() — no public access

---

## 5. Automation Marketplace — IMPLEMENTED

### Marketplace Page (/automations)
- server-side, fetches only status: "PUBLISHED" automations
- AutomationsClient.tsx — live filter/search by category, pricing, integrations
- AutomationCard.tsx — product card component

### Product Detail Page (/automations/[slug])
- server-side, verifies status: "PUBLISHED"
- Checks ownership: UserAutomation lookup by clerkUserId + automationId
- ProductClient.tsx — media carousel, features, requirements, reviews, comments, FAQs

---

## 6. Product Fields on Automation Model — IMPLEMENTED

- id, slug (unique), title, shortDesc, description
- features[], requirements[], integrations[]
- price (paise), originalPrice, discountPercent, currency, pricingType
- featured, categoryId, thumbnailUrl, status
- ratingSum, reviewCount (denormalized)
- seoTitle, seoDescription, ogImage, directAnswer, primaryTopic, searchIntent, faqs
- n8nWorkflowId (server-side execution reference)
- isExecutable (allow/disallow execution)
- configSchema (interface definition schema)

---

## 7. Payments — IMPLEMENTED

### Flow:
User → Product/Cart → POST /api/orders/create
  → Razorpay order created server-side
  → User completes payment
  → POST /api/orders/verify
  → HMAC-SHA256 signature verified
  → Order confirmed → UserAutomation records created

### Security:
- Amounts calculated server-side (DB price, never client input)
- Razorpay order ID matched against DB record
- HMAC-SHA256 timingSafeEqual verification
- Razorpay webhook with HMAC verification at /api/webhooks/razorpay

---

## 8. User Ownership — IMPLEMENTED

- UserAutomation.@@unique([clerkUserId, automationId]) — DB-level duplicate prevention
- Free: POST /api/user-automations → upsert directly
- Paid: orders/create → payment → orders/verify → upsert
- Unpublishing automation does NOT delete UserAutomation records

---

## 9. My Automations — IMPLEMENTED

- /my-automations/page.tsx — server-side, fetches only current user's records
- Unauthenticated users see prompt to sign in

---

## 10. Automation Workspace — IMPLEMENTED (Foundation)

- /my-automations/[id]/page.tsx — findFirst({ where: { id, clerkUserId: userId } })
- WorkspaceClient.tsx tabs:
  - Overview: product summary, integrations, downloadable files
  - Configuration: PLACEHOLDER — schema renderer not yet implemented
  - Activity: real execution history from AutomationExecution DB records
  - Usage: PLACEHOLDER
  - Settings: workspace status and engine connection status
- Run button shown only if isExecutable && n8nWorkflowId && status != DISABLED/PAUSED
- n8nWorkflowId is NEVER sent to client — only presence (truthy/falsy) used

---

## 11. Execution Architecture — IMPLEMENTED (awaiting real n8n)

### Pipeline:
Client POST /api/automation-executions
  → getCurrentUserId() [Clerk, server-side]
  → ExecutionService.triggerExecution()
    → authorizeAutomationExecution() — IDOR check, ownership, isExecutable
    → validateExecutionInput()        — configSchema field validation
    → Create AutomationExecution (QUEUED → RUNNING)
    → N8nClient.triggerWorkflow()     — n8n REST API call, server-side only
    → Update record (COMPLETED or RUNNING)
    → Return sanitized result to client

### Security:
- Client never provides workflowId — resolved from DB after ownership check
- externalExecutionId not exposed to client in list view
- Error messages sanitized before returning to browser
- n8n credentials never in API responses

---

## 12. n8n Integration — PARTIALLY IMPLEMENTED

What exists:
- N8nClient class in lib/automation/n8n-client.ts
- Calls POST /api/v1/workflows/{workflowId}/execute
- Auth via X-N8N-API-KEY header (server-side env only)
- N8nConfigurationError → sanitized 503 to client when env vars missing

What does NOT exist:
- No real n8n instance configured
- N8N_BASE_URL and N8N_API_KEY not set in .env
- No webhook from n8n back to platform for async status updates
- No real workflow JSON files

---

## 13. API Routes (Verified)

**Admin (require admin session):**
- /api/admin/login, /api/admin/logout
- /api/admin/upload, /api/admin/automations/files/upload
- /api/admin/analytics
- /api/admin/posts, /api/admin/posts/[id]
- /api/admin/categories, /api/admin/categories/[id]
- /api/admin/comments, /api/admin/comments/[id]
- /api/admin/tags, /api/admin/tags/[id]
- /api/admin/settings
- /api/admin/social-profiles, /api/admin/social-profiles/[id]

**User (require Clerk auth):**
- POST /api/automation-executions — trigger execution
- GET  /api/automation-executions — execution history (+ ownership check)
- GET  /api/automation-executions/[id] — execution detail (+ ownership check)
- GET/POST /api/user-automations — list/add user automations
- POST /api/orders/create — create Razorpay order
- POST /api/orders/verify — verify payment + grant ownership
- GET  /api/orders/[id] — order detail
- GET/POST /api/automations/[slug]/reviews
- GET/POST /api/automations/[slug]/comments
- GET/POST/DELETE /api/cart
- GET/POST/DELETE /api/wishlist

**Webhooks:**
- POST /api/webhooks/razorpay — HMAC signature verified

**Public:**
- POST /api/analytics/track

---

## 14. Security — IMPLEMENTED (Strong foundations)

### Verified Secure:
- Admin session HMAC-SHA256 timingSafeEqual
- Payment signature HMAC-SHA256 timingSafeEqual
- Webhook signature HMAC-SHA256 timingSafeEqual
- IDOR: workspace findFirst({ where: { id, clerkUserId } })
- IDOR: execution history ownership verification before returning records
- IDOR: authorizeAutomationExecution() with strict === comparison
- n8n credentials: no NEXT_PUBLIC_ prefix
- workflowId: never from client, only resolved from DB
- Payment amounts: never from client, always from DB
- Duplicate ownership: prevented by DB unique constraint
- Paid products: cannot be claimed free (explicit check in /api/user-automations)

### Genuine Gaps:
1. No server-side Zod validation on createAutomation/updateAutomation
2. Slug not sanitized/validated server-side
3. No publishing guardrail — incomplete automation can be PUBLISHED
4. Razorpay webhook does NOT create UserAutomation records
5. UserAutomation.config is plaintext — needs encryption for future API keys

---

## 15. Environment Variables

| Variable | Required | Side | Purpose |
|---|---|---|---|
| DATABASE_URL | Yes | Server | Neon PostgreSQL |
| SESSION_SECRET | Yes | Server | Admin session HMAC key |
| CLOUDINARY_CLOUD_NAME | Yes | Server | Cloudinary |
| CLOUDINARY_API_KEY | Yes | Server | Cloudinary |
| CLOUDINARY_API_SECRET | Yes | Server | Cloudinary |
| RAZORPAY_KEY_ID | Yes | Server | Razorpay API |
| RAZORPAY_KEY_SECRET | Yes | Server | Payment verification |
| RAZORPAY_WEBHOOK_SECRET | Yes | Server | Webhook verification |
| NEXT_PUBLIC_RAZORPAY_KEY_ID | Yes | Public | Razorpay checkout |
| CLERK_SECRET_KEY | Yes | Server | Clerk server auth |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Yes | Public | Clerk client |
| N8N_BASE_URL | No* | Server | n8n instance URL |
| N8N_API_KEY | No* | Server | n8n API auth |

*Optional until n8n is configured. Missing → safe 503 to clients.

---

## 16. Mobile/Responsive Architecture — IMPLEMENTED

- Navbar.tsx — responsive with hamburger trigger
- MobileMenu.tsx — full-screen mobile menu
- Admin automation list: dual view (desktop table + mobile card grid)
- AutomationForm.tsx — lg:grid-cols-3 responsive layout
- WorkspaceClient.tsx — overflow-x-auto scrollbar-none tabs
- All major pages: responsive grid layouts

---

## 17. Cloudinary Integration — IMPLEMENTED

- /api/admin/upload — automation media (images/videos)
- /api/admin/automations/files/upload — downloadable files
- AutomationMedia model: url, publicId, type, format, sortOrder, isPrimary
- AutomationFile model: title, fileName, fileUrl, publicId, fileSize, fileType
- Media model: CMS media library

---

## 18. WHAT IS COMPLETE

- Admin authentication (custom session, bcrypt, HMAC) — COMPLETE
- Admin rate limiting — COMPLETE
- Admin audit logging — COMPLETE
- Clerk user authentication integration — COMPLETE
- Prisma schema — all models — COMPLETE
- Automation CRUD (Admin) — COMPLETE
- Automation media upload (Cloudinary) — COMPLETE
- Downloadable file upload (Cloudinary) — COMPLETE
- Automation status lifecycle (DRAFT/PUBLISHED/ARCHIVED) — COMPLETE
- Marketplace page (public, published only) — COMPLETE
- Product detail page — COMPLETE
- Shopping cart — COMPLETE
- Wishlist — COMPLETE
- Razorpay order creation (server-side) — COMPLETE
- Razorpay payment verification (HMAC-SHA256) — COMPLETE
- Razorpay webhook — COMPLETE
- UserAutomation ownership record — COMPLETE
- Duplicate ownership prevention (DB unique constraint) — COMPLETE
- Free automation claim flow — COMPLETE
- My Automations page — COMPLETE
- Workspace page with IDOR protection — COMPLETE
- Execution authorization (ownership check) — COMPLETE
- configSchema input validation (server-side) — COMPLETE
- ExecutionService pipeline — COMPLETE
- AutomationExecution DB records — COMPLETE
- Execution history API (with IDOR protection) — COMPLETE
- N8nClient (server-side, awaiting real instance) — COMPLETE
- n8n credential isolation (no NEXT_PUBLIC_) — COMPLETE
- configSchema field definition on Automation model — COMPLETE
- UserAutomation.config for user-specific values — COMPLETE
- Lint: 0 errors — COMPLETE
- Build: 0 errors — COMPLETE
- Execution engine test suite (15/15) — COMPLETE

---

## 19. WHAT IS PARTIALLY IMPLEMENTED

- Server-side validation on automation creation: no Zod schema, raw FormData parsed
- Slug validation: not sanitized server-side, duplicate errors not surfaced cleanly
- Publishing guardrails: no check prevents publishing incomplete records
- Executable automation guardrail: isExecutable=true allowed without n8nWorkflowId
- Workspace Configuration tab: exists but shows placeholder only
- Dynamic automation interface renderer: not built yet
- Webhook UserAutomation creation: webhook updates order but does not create UserAutomation
- Sensitive config storage: UserAutomation.config is plaintext JSON
- n8n async status updates: only synchronous n8n responses handled
- Usage tab: placeholder
- Admin configSchema editor: field exists on model, not editable in admin UI

---

## 20. WHAT IS NOT IMPLEMENTED

- AutomationInterfaceRenderer component (reads configSchema, renders dynamic form)
- Admin configSchema builder UI
- Slug redirect history (slug changes break URLs, no redirect table)
- n8n async execution callbacks (no endpoint for n8n to POST completion status)
- Per-user execution rate limiting (TODO comment in ExecutionService)
- Encrypted secret storage for UserAutomation.config
- Subscription billing (enum exists, no billing logic)
- Usage metrics / quota tracking
- Formal automated test suite (no Jest/Vitest configured)
- Individual automation-specific UIs (by design — not built yet)

---

## 21. Automation Publishing Lifecycle

Admin Panel
  -> AutomationForm.tsx (client component)
  -> createAutomation() / updateAutomation() (server action)
     -> requireAdminSession()
     -> prisma.automation.create/update
     -> revalidatePath("/automations")
  -> status = DRAFT (default)
  -> Admin sets status = PUBLISHED
  -> /automations page — now visible
  -> /automations/[slug] — product page live
  -> Admin sets status = ARCHIVED
  -> Disappears from marketplace
     UserAutomation records are NOT deleted

---

## 22. User Ownership Lifecycle

User browses /automations
  -> /automations/[slug] (product page)
  ->
  FREE automation:
    POST /api/user-automations { automationId }
      -> Clerk auth required
      -> Verify automation PUBLISHED
      -> Verify price === 0 or pricingType === FREE
      -> prisma.userAutomation.upsert()
  ->
  PAID automation:
    POST /api/orders/create { automationId }
      -> Clerk auth required
      -> Verify PUBLISHED
      -> Fetch price from DB
      -> Create Order + Razorpay order
    -> User completes Razorpay checkout
    -> POST /api/orders/verify
      -> Clerk auth required
      -> Fetch Order from DB, verify clerkUserId matches
      -> Verify razorpayOrderId matches stored DB value
      -> HMAC-SHA256 signature verification (timingSafeEqual)
      -> Update Order: CONFIRMED + PAID
      -> prisma.userAutomation.upsert() for each OrderItem
      -> Clear Cart items
  ->
  UserAutomation created with status=NOT_CONFIGURED
  -> /my-automations — lists all UserAutomation records
  -> /my-automations/[id] — Workspace (findFirst with clerkUserId ownership check)

---

## 23. Custom Automation Interface Architecture (Current State)

Automation.configSchema (Json?) — global interface definition:
{
  "fields": [
    { "key": "tone", "label": "Tone", "type": "select", "required": true },
    { "key": "instructions", "label": "Instructions", "type": "textarea", "required": false }
  ]
}

UserAutomation.config (Json?) — user-specific values:
{
  "tone": "professional",
  "instructions": "Keep responses short"
}

What the validation layer does (already implemented):
- validateExecutionInput(configSchema, input) validates user input against schema
- Required fields checked, missing fields reported
- Called in ExecutionService.triggerExecution() before any n8n dispatch

What does NOT exist yet:
- AutomationInterfaceRenderer component
- Admin UI for setting configSchema
- Dynamic form rendering in workspace Configuration tab

---

## 24. Configuration Schema Architecture

Current schema format (validated in code):
{
  "fields": [
    {
      "key": string,
      "type": string,
      "required": boolean
    }
  ]
}

Planned extended format (to implement):
{
  "fields": [
    {
      "key": string,
      "label": string,
      "type": "text" | "email" | "textarea" | "number" | "select"
            | "multiselect" | "checkbox" | "toggle" | "url" | "date",
      "required": boolean,
      "placeholder": string (optional),
      "options": [{ "value": string, "label": string }] (optional),
      "defaultValue": unknown (optional),
      "helpText": string (optional),
      "sensitive": boolean (optional, future encrypted storage flag)
    }
  ]
}

---

## 25. Security Findings

VERIFIED SECURE:
- Admin session HMAC-SHA256 timingSafeEqual — timing-safe
- Payment signature timingSafeEqual — timing-safe
- Webhook signature timingSafeEqual — timing-safe
- IDOR workspace: findFirst({ where: { id, clerkUserId } })
- IDOR execution history: ownership verification before records returned
- IDOR execution trigger: authorizeAutomationExecution() strict === comparison
- n8n credentials: no NEXT_PUBLIC_ prefix — not in browser bundle
- workflowId: never accepted from client, only resolved from DB
- Payment amounts: never from client, always from DB
- Order ownership: verified before payment signature check
- Duplicate ownership: DB unique constraint
- Paid products: cannot be claimed free (explicit check in /api/user-automations)

GENUINE GAPS TO FIX:
1. No Zod validation on createAutomation/updateAutomation — malformed records can be written
2. Slug not sanitized server-side — malformed slugs can be saved
3. No publishing guardrail — incomplete automation can be set to PUBLISHED
4. Razorpay webhook does not create UserAutomation — browser close after payment = lost access
5. Plaintext config — UserAutomation.config needs encryption for future API key storage

---

## 26. Recommended Phase 5

Priority 1 — Production Hardening (before any real automation ships):
1. Add Zod validation to createAutomation and updateAutomation server actions
2. Add slug sanitization and duplicate-slug clean error handling
3. Add publishing guardrail (title + description + price required before PUBLISHED)
4. Add executable guardrail (n8nWorkflowId required if isExecutable=true and PUBLISHED)
5. Fix Razorpay webhook to also create UserAutomation records (idempotent upsert)

Priority 2 — Custom Interface Foundation:
1. Extend configSchema format with label, placeholder, options, helpText, sensitive
2. Build AutomationInterfaceRenderer component (reads configSchema, renders dynamic form)
3. Wire Configuration tab in WorkspaceClient to use AutomationInterfaceRenderer
4. Server-side: save user config against configSchema validation before updating UserAutomation.config
5. Add configSchema JSON editor to Admin automation form

Priority 3 — First Real Automation:
1. Configure n8n instance (N8N_BASE_URL + N8N_API_KEY)
2. Create first real n8n workflow
3. Create Automation product in admin with n8nWorkflowId and configSchema defined
4. Test full pipeline end-to-end

Priority 4 — Operational:
1. n8n async webhook callback endpoint for execution status updates
2. Per-user execution rate limiting in ExecutionService
3. Encrypted storage layer for sensitive UserAutomation.config fields

---

*Document generated from actual code inspection on 2026-09-09. Build: PASS. Lint: PASS. Tests: 15/15.*
