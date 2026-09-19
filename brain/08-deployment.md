<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Document platform deployment topology, container specifications, and hosting boundaries.
-->

# Deployment Topology & Infrastructure

This document outlines the multi-cloud deployment topology across Vercel, Railway, and Neon, detailing container configurations and persistence models.

Key source paths:
- `deployments/n8n/` (Production workflow JSONs)
- `lib/env.ts` (Runtime configuration contract)

---

## 1. Hosting Topology

| Component | Provider | Public Hostname | Deployment Method | Role |
|---|---|---|---|---|
| **Web & Backend** | Vercel | `https://chowdhuryduo.in` | Automated GitHub CI/CD (`origin/main`) | Next.js App Router, public pages, internal gateway API, admin UI |
| **Workflow Engine** | Railway | `https://n8n-production-a20f.up.railway.app` | Railway Docker Deployment | Production n8n workflow execution and scheduled coordination |
| **Relational DB** | Neon DB | Managed Endpoint | Serverless Connection Pooling | PostgreSQL database storing relational models and vault-encrypted tokens |
| **Media Assets** | Cloudinary | Cloudinary CDN | API Uploads | Image hosting and media transformations |
| **Local Dev** | Local Machine | `localhost:3000` / `localhost:5678` | Local Node / n8n CLI | Offline development, testing, and workflow validation |

> **Note on Cloudflare:** Cloudflare is not actively configured as a reverse proxy for the internal gateway or n8n webhook pipelines; traffic connects directly to Vercel and Railway edge endpoints.

---

## 2. Railway n8n Container Architecture

The production n8n environment is hosted on Railway using standard containerized infrastructure:

- **Image:** Official Docker image `n8nio/n8n:latest`.
- **Persistence:** A persistent Railway volume mounted at:
  ```
  /home/node/.n8n
  ```
  **CRITICAL:** Under no circumstances should this volume be deleted or reset. It persists the internal SQLite execution database, encryption key, and saved workflow credentials.
- **Port & Networking:**
  - Container Port: `5678`
  - Public Networking: TLS termination managed by Railway edge (`https://`).
- **Access Control:** Production root account is protected by an administrative password and multi-factor authentication (2FA).

---

## 3. Vercel Backend Deployment Model

- **Source Integration:** Connected to the GitHub repository on branch `main`.
- **Automatic Builds:** Every push to `main` triggers a production build and deployment.
- **Environment Parity:** All server-side environment variables defined in `.env` (excluding localhost development flags) must be synchronized in the Vercel Project Settings under the **Production** environment.
- **Change Management:** Per project rules, automated agents must never push, commit, or trigger deployments directly unless explicitly commanded by the project owner.
