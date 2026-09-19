<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document environment variable registry, purposes, hosting scopes, and security tiers.
-->

# Environment Variable Registry & Configuration Scopes

This document provides a safe, authoritative reference for all environment variables utilized across the Chowdhury Duo web backend, database, and n8n orchestration layers.

> [!CAUTION]
> **Strict Zero-Secrets Policy:** This registry documents configuration keys and their architectural purpose only. **No plaintext secrets, passwords, encryption keys, or private tokens are stored in this document.**

---

## 1. Backend Environment Variables (Vercel & Local `.env`)

| Variable Name | Purpose | Target Environment | Secret? | Required for Gmail Flow? |
|---|---|---|:---:|:---:|
| `DATABASE_URL` | PostgreSQL connection string with SSL configuration | Local, Vercel | Yes | **Yes** |
| `AUTOMATION_VAULT_KEY` | 256-bit AES-GCM master key for encrypting OAuth tokens at rest | Local, Vercel | Yes | **Yes** |
| `CHOWDHURY_DUO_GATEWAY_SECRET` | Shared secret for internal service-to-service authentication | Local, Vercel | Yes | **Yes** |
| `N8N_SUPPORT_WEBHOOK_URL` | Destination webhook URL on Railway n8n for inbound Gmail events | Local, Vercel | No | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Application client identifier | Local, Vercel | No | **Yes** |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret for token exchanges | Local, Vercel | Yes | **Yes** |
| `GOOGLE_OAUTH_REDIRECT_URI` | Authorized OAuth redirect callback URL | Local, Vercel | No | **Yes** |
| `AI_SUPPORT_API_KEY` | OpenRouter API key for LLM policy and drafting | Local, Vercel | Yes | **Yes** |
| `AI_SUPPORT_MODEL` | Target OpenRouter model identifier (default: `openrouter/free`) | Local, Vercel | No | **Yes** |
| `AI_SUPPORT_BASE_URL` | Custom OpenAI-compatible base URL (default: OpenRouter v1) | Local, Vercel | No | Optional |
| `AI_SUPPORT_FREE_ONLY` | Safety toggle enforcing free-tier model allowlist | Local, Vercel | No | Recommended |
| `NEXT_PUBLIC_SITE_URL` | Public origin URL (e.g., `https://chowdhuryduo.in`) | Local, Vercel | No | **Yes** |
| `CHOWDHURY_DUO_API_BASE_URL` | Local dev backend host reference (e.g., `http://localhost:3000`) | Local | No | Dev Only |
| `BREVO_API_KEY` | Brevo REST API key for developer escalation emails | Local, Vercel | Yes | No |
| `SUPPORT_EMAIL` | Destination mailbox for customer escalation reports | Local, Vercel | No | No |
| `SUPPORT_FROM_EMAIL` | Verified sender email for outbound escalation notices | Local, Vercel | No | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key | Local, Vercel | No | No |
| `CLERK_SECRET_KEY` | Clerk backend secret key | Local, Vercel | Yes | No |
| `RAZORPAY_KEY_ID` | Razorpay public key ID | Local, Vercel | No | No |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay client-side key ID | Local, Vercel | No | No |
| `RAZORPAY_KEY_SECRET` | Razorpay server-side API secret | Local, Vercel | Yes | No |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for HMAC signature verification of payment webhooks | Local, Vercel | Yes | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier | Local, Vercel | No | No |
| `CLOUDINARY_API_KEY` | Cloudinary API access key | Local, Vercel | Yes | No |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Local, Vercel | Yes | No |
| `SESSION_SECRET` | Cryptographic secret for signing admin session cookies | Local, Vercel | Yes | No |
| `ADMIN_EMAIL` | Root administrator login identifier | Local, Vercel | No | No |
| `ADMIN_PASSWORD` | Initial/fallback admin password hash input | Local, Vercel | Yes | No |

---

## 2. Orchestration Environment Variables (Railway n8n Container)

| Variable Name | Purpose | Target Environment | Secret? | Required for Gmail Flow? |
|---|---|---|:---:|:---:|
| `CHOWDHURY_DUO_API_BASE_URL` | Base URL of Next.js backend (`https://chowdhuryduo.in`) | Railway n8n | No | **Yes** |
| `N8N_PORT` | Listening port inside container (default: `5678`) | Railway n8n | No | **Yes** |
| `N8N_PROTOCOL` | Edge protocol (`https`) | Railway n8n | No | **Yes** |
| `N8N_SECURE_COOKIE` | Enforces Secure flag on authentication cookies (`true`) | Railway n8n | No | **Yes** |
| `N8N_ENCRYPTION_KEY` | Master key used by n8n to encrypt saved credentials in SQLite | Railway n8n | Yes | **Yes** |
| `GENERIC_TIMEZONE` | Container timezone setting (e.g., `Asia/Kolkata`) | Railway n8n | No | Recommended |
| `N8N_WEBHOOK_URL` | Explicit public webhook base URL if behind reverse proxy | Railway n8n | No | Optional |

---

## 3. Deprecated & Obsolete Variables

The following variables associated with Google Cloud Pub/Sub push notifications are **no longer required** under the active polling architecture:

- `GOOGLE_CLOUD_PROJECT_ID` (Obsolete)
- `GOOGLE_PUBSUB_TOPIC` (Obsolete)
- `GOOGLE_PUBSUB_SUBSCRIPTION` (Obsolete)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (Obsolete)
- `GMAIL_PUSH_VERIFICATION_TOKEN` (Obsolete)
