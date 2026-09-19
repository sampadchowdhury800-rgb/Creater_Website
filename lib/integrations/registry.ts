/**
 * lib/integrations/registry.ts
 *
 * Immutable server-side capability registry for third-party integrations.
 * SERVER-SIDE ONLY.
 *
 * SECURITY INVARIANTS:
 * - Admin and database records may declare capabilities by name, but NEVER raw OAuth scopes.
 * - Capabilities are the sole security authority for deriving OAuth consent scopes.
 * - Broad or dangerous scopes (such as https://mail.google.com/) are permanently prohibited.
 * - Unsupported capabilities must throw and fail closed immediately.
 */

import type { CapabilityDefinition, SupportedCapability, SupportedGoogleCapability } from "./types";

export const PROHIBITED_SCOPES: ReadonlySet<string> = new Set([
  "https://mail.google.com/", // Full unrestricted mailbox access — permanently prohibited
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
]);

export const GOOGLE_BASE_IDENTITY_SCOPES: readonly string[] = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export const GOOGLE_CAPABILITY_REGISTRY: Record<SupportedGoogleCapability, CapabilityDefinition> = {
  GMAIL_SEND: {
    capability: "GMAIL_SEND",
    provider: "GOOGLE",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.send"],
    description: "Send emails on behalf of the customer",
    allowedOperations: ["SEND"],
  },
  GMAIL_READ_LIST: {
    capability: "GMAIL_READ_LIST",
    provider: "GOOGLE",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    description: "Search and list email threads",
    allowedOperations: ["LIST_MESSAGES", "LIST_THREADS"],
  },
  GMAIL_GET_MESSAGE: {
    capability: "GMAIL_GET_MESSAGE",
    provider: "GOOGLE",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    description: "Read full body and headers of specific emails",
    allowedOperations: ["GET_MESSAGE"],
  },
  GMAIL_MODIFY: {
    capability: "GMAIL_MODIFY",
    provider: "GOOGLE",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
    description: "Apply labels, archive, or mark emails as read",
    allowedOperations: ["MODIFY_LABELS", "TRASH_MESSAGE"],
  },
  GMAIL_WATCH: {
    capability: "GMAIL_WATCH",
    provider: "GOOGLE",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    description: "Subscribe to real-time Gmail mailbox push notifications",
    allowedOperations: ["WATCH", "STOP_WATCH", "LIST_HISTORY"],
  },
} as const;

// Startup assertion: ensure no registered capability accidentally requests a prohibited scope
for (const [key, def] of Object.entries(GOOGLE_CAPABILITY_REGISTRY)) {
  for (const scope of def.requiredScopes) {
    if (PROHIBITED_SCOPES.has(scope)) {
      throw new Error(
        `[Security Violation] Capability "${key}" requests permanently prohibited scope: "${scope}"`
      );
    }
  }
}

/**
 * Validates whether a capability string is a supported Google capability.
 */
export function isSupportedGoogleCapability(cap: unknown): cap is SupportedGoogleCapability {
  return typeof cap === "string" && cap in GOOGLE_CAPABILITY_REGISTRY;
}

/**
 * Returns the immutable capability definition from the registry.
 * Throws if capability is unsupported.
 */
export function getCapabilityDefinition(cap: string): CapabilityDefinition {
  if (isSupportedGoogleCapability(cap)) {
    return GOOGLE_CAPABILITY_REGISTRY[cap];
  }
  throw new Error(`Unsupported or unrecognized capability: "${cap}"`);
}

/**
 * Derives the exact set of minimal OAuth scopes required for a list of capabilities.
 * Always includes base identity scopes (userinfo.email, userinfo.profile).
 *
 * Guarantees:
 * - Scope union is deduplicated.
 * - Prohibited scopes cannot enter the list.
 * - Scopes are strictly derived from the server registry, never from client inputs.
 */
export function deriveGoogleOAuthScopes(capabilities: readonly SupportedGoogleCapability[]): string[] {
  const scopeSet = new Set<string>(GOOGLE_BASE_IDENTITY_SCOPES);

  for (const cap of capabilities) {
    const def = getCapabilityDefinition(cap);
    for (const scope of def.requiredScopes) {
      if (PROHIBITED_SCOPES.has(scope)) {
        throw new Error(`Prohibited scope encountered during derivation: "${scope}"`);
      }
      scopeSet.add(scope);
    }
  }

  return Array.from(scopeSet);
}

/**
 * Checks whether a given OAuth scope is permitted (not in PROHIBITED_SCOPES).
 */
export function isScopePermitted(scope: string): boolean {
  return !PROHIBITED_SCOPES.has(scope);
}

/**
 * Checks whether granted scopes satisfy the required scopes.
 */
export function hasRequiredScopes(
  grantedScopes: readonly string[] | string[],
  requiredScopes: readonly string[] | string[]
): boolean {
  const grantedSet = new Set(grantedScopes);
  return requiredScopes.every((scope) => grantedSet.has(scope));
}
