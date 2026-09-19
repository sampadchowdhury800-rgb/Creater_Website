# PHASE 7 — Secure User Secrets / Credential Vault Foundation

**Status: COMPLETE — Production-Ready**

## Summary

Phase 7 implements AES-256-GCM authenticated encryption for sensitive user credentials
in the Automation platform. Plaintext secrets are never stored in the database, never
logged, and never returned to the browser.

## Architecture

### Separation of Concerns

- UserAutomation.config (Json) — non-sensitive fields + safe placeholders
  Sensitive field placeholder: { __isSecret: true, configured: true, lastUpdated: "..." }

- UserAutomationSecret (new table) — encrypted credentials only
  Fields: encryptedValue (base64 AES-256-GCM), iv (12-byte, base64), authTag (16-byte, base64), version

### Encryption Standard

- Algorithm: AES-256-GCM (authenticated encryption)
- Key: 32 bytes from AUTOMATION_VAULT_KEY env var (64 hex chars or 44 base64 chars)
- IV: 12-byte cryptographically random per encryption call (never reused)
- Auth tag: 16 bytes — any tampering causes immediate decryption failure
- Version: int field for future algorithm migration

### IDOR Protection

Every vault read/write verifies:
  clerkUserId -> UserAutomation.clerkUserId -> UserAutomationSecret.userAutomationId

## Files Added/Modified

| File | Change |
|---|---|
| prisma/schema.prisma | Added UserAutomationSecret model + secrets relation |
| lib/crypto/vault.ts | NEW — AES-256-GCM vault core |
| lib/automation/vault-service.ts | NEW — Vault CRUD with IDOR protection |
| lib/automation/execution-service.ts | Mask input, decrypt for n8n dispatch |
| app/my-automations/[id]/actions.ts | Route sensitive fields through vault |
| components/automations/AutomationInterfaceRenderer.tsx | Configured badge, keep-existing sentinel |
| lib/env.ts | Added AUTOMATION_VAULT_KEY getter |
| .env.example | Added AUTOMATION_VAULT_KEY with instructions |
| scripts/test-vault-security.ts | NEW — 15-test vault security suite |

## Environment Variable

AUTOMATION_VAULT_KEY — server-side only, NEVER use NEXT_PUBLIC_ prefix.
Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
- In production: required (throws if missing)
- In development: optional (insecure fallback + warning)

## Test Results

Vault security tests: 15/15 passed
Config schema tests:  24/24 passed
Marketplace lifecycle: 36/36 passed
ESLint:               Exit 0 (no warnings)
Production build:     Exit 0 (44/44 routes)

## Known Limitations

1. Existing plaintext config records are NOT auto-migrated.
   Users re-save config to encrypt their credentials.

2. Key rotation requires a dedicated migration script (not in scope).

3. Configured badge only shown for text/email/url sensitive field types in UI.
