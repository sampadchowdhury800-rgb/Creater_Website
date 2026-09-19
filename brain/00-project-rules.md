<!--
Last verified: 2026-09-16
Source of truth: Current repository/source
Purpose: Record core engineering rules, operational constraints, and knowledge base standards.
-->

# Project Engineering Rules & Operating Protocol

This document defines the authoritative operational protocol and behavioral rules for all engineering work on the Chowdhury Duo platform.

---

## 1. Decision Hierarchy

Every engineering decision must strictly adhere to the following priority order:

$$\text{Correctness} > \text{Requirements} > \text{Consistency} > \text{Security/Reliability} > \text{Maintainability} > \text{Token Efficiency} > \text{Minimal Output}$$

- Never sacrifice correctness or project understanding to save tokens.
- Never introduce speculative abstractions or unverified architecture.

---

## 2. Universal Token-Efficient AI Software Engineering Protocol

### A. Understand Before Building
- Inspect only the parts of the repository relevant to the active task.
- Treat existing project documentation, current source code, and explicit user requirements as the primary source of truth.
- Do not assume framework conventions, directory structures, or configurations without inspecting relevant files.
- Start with the smallest relevant context and expand only as needed.

### B. Minimal Safe Changes
- Modify only the files strictly required to implement the fix or feature.
- Prefer targeted edits and extensions over rewrites or refactoring.
- Preserve backward compatibility and existing patterns.
- Do not change architecture, database schemas, APIs, or dependencies unless explicitly requested.

### C. Implementation & Security Standards
- Maintain strict tenant isolation across all customer data and operations.
- The Next.js application backend is the sole authority for security, authorization, and business logic.
- Workflow automation (n8n) acts strictly as an orchestration layer, never as the security authority.
- Permanent credentials (OAuth refresh tokens, secret keys) must remain encrypted in the backend vault and never be transmitted to external orchestration tools.
- Constant-time secret verification (`timingSafeEqual`) must be enforced on all internal service-to-service endpoints.

### D. Verification Requirements
- Validate changes using existing test suites, TypeScript compilation, linting, or non-destructive probes.
- Never activate or execute automation against real customer inboxes or live accounts during verification unless in an explicitly authorized, controlled test harness.
- Ensure all endpoints, parameter contracts, and routing paths actually exist in the codebase.

---

## 3. Brain Knowledge Base Management Rules

- **Fast-Reference Layer:** The `brain/` directory serves as a lightweight, persistent engineering knowledge base for AI agents and developers.
- **Authority:** Current source code and explicit user requirements override any document in `brain/`.
- **Zero Secrets Policy:** **NEVER** write actual passwords, API keys, OAuth tokens, personal data, encryption keys, or secret values to `brain/`. Only document variable names and their architectural purpose.
- **Maintenance:** Update the corresponding `brain/` document whenever a significant architectural, integration, deployment, security, or workflow change occurs.
- **No Code Bloat:** Do not duplicate large code blocks or raw configuration dumps into `brain/`. Prefer concise tables, architectural bullet points, and exact file paths.
