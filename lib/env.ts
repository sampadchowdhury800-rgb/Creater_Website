// Centralized environment variable validation
// Ensures that the application fails fast if required configuration is missing.

export const env = {
  get DATABASE_URL() {
    const val = process.env.DATABASE_URL;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nDATABASE_URL\n\nPlease configure your .env file before starting the application.\n"
      );
    }
    return val;
  },

  get CLOUDINARY_CLOUD_NAME() {
    const val = process.env.CLOUDINARY_CLOUD_NAME;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nCLOUDINARY_CLOUD_NAME\n\nPlease configure your .env file before starting the application.\n"
      );
    }
    return val;
  },

  get CLOUDINARY_API_KEY() {
    const val = process.env.CLOUDINARY_API_KEY;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nCLOUDINARY_API_KEY\n\nPlease configure your .env file before starting the application.\n"
      );
    }
    return val;
  },

  get CLOUDINARY_API_SECRET() {
    const val = process.env.CLOUDINARY_API_SECRET;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nCLOUDINARY_API_SECRET\n\nPlease configure your .env file before starting the application.\n"
      );
    }
    return val;
  },

  get SESSION_SECRET() {
    const val = process.env.SESSION_SECRET;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nSESSION_SECRET\n\nPlease configure your .env file before starting the application.\n"
      );
    }
    return val;
  },


  // ─── Razorpay (server-side only) ───────────────────────────────────────────
  get RAZORPAY_KEY_ID() {
    const val = process.env.RAZORPAY_KEY_ID;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nRAZORPAY_KEY_ID\n\nGet it from Razorpay Dashboard → Settings → API Keys\n"
      );
    }
    return val;
  },

  get RAZORPAY_KEY_SECRET() {
    const val = process.env.RAZORPAY_KEY_SECRET;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nRAZORPAY_KEY_SECRET\n\nGet it from Razorpay Dashboard → Settings → API Keys\n"
      );
    }
    return val;
  },

  get RAZORPAY_WEBHOOK_SECRET() {
    const val = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!val) {
      throw new Error(
        "\nMissing required environment variable:\n\nRAZORPAY_WEBHOOK_SECRET\n\nSet it in Razorpay Dashboard → Webhooks\n"
      );
    }
    return val;
  },

  // ─── n8n Execution Engine (server-side only, optional until n8n instance is configured) ───
  get N8N_BASE_URL() {
    return process.env.N8N_BASE_URL || null;
  },

  get N8N_API_KEY() {
    return process.env.N8N_API_KEY || null;
  },

  // ─── Automation Credential Vault (server-side only) ──────────────────────────
  // Used by lib/crypto/vault.ts to encrypt/decrypt sensitive automation credentials.
  // NEVER use NEXT_PUBLIC_ prefix — this key must stay server-side only.
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Key format: 64 hex characters (32 bytes) or 44 base64 characters (32 bytes).
  // In production: required. In development: optional (uses insecure dev fallback + warning).
  get AUTOMATION_VAULT_KEY() {
    // The vault module itself handles the missing-key logic (dev fallback vs. prod throw).
    // Here we simply expose the raw value so callers can check it if needed.
    return process.env.AUTOMATION_VAULT_KEY ?? null;
  },

  // ─── AI Customer Support Assistant (server-side only) ───────────────────────
  // NEVER use NEXT_PUBLIC_ prefix — these keys must stay strictly server-side.
  get AI_SUPPORT_API_KEY() {
    return process.env.AI_SUPPORT_API_KEY ?? null;
  },

  // Default: OpenRouter free-tier model. Override via AI_SUPPORT_MODEL env var.
  get AI_SUPPORT_MODEL() {
    return process.env.AI_SUPPORT_MODEL || "openrouter/free";
  },

  get AI_SUPPORT_BASE_URL() {
    return process.env.AI_SUPPORT_BASE_URL ?? null;
  },

  /**
   * When true, the AI provider will REFUSE to make any inference request if
   * the configured model ID is not on the free-model allowlist.
   * Defaults to true in all environments — explicitly set to "false" to opt out.
   */
  get AI_SUPPORT_FREE_ONLY(): boolean {
    const val = process.env.AI_SUPPORT_FREE_ONLY;
    // Treat missing or anything other than explicit "false" as true (safe default).
    return val !== "false";
  },

  // ─── Developer Escalation Email (Brevo REST API, server-side only) ─────────
  // Used by lib/email/brevo.ts to deliver developer escalation support reports.
  // NEVER use NEXT_PUBLIC_ prefix — this key must stay strictly server-side.
  get BREVO_API_KEY() {
    return process.env.BREVO_API_KEY ?? null;
  },

  get SUPPORT_EMAIL() {
    return process.env.SUPPORT_EMAIL || "chowdhuryduo@gmail.com";
  },

  get SUPPORT_FROM_EMAIL() {
    return process.env.SUPPORT_FROM_EMAIL ?? null;
  },

  // ─── Secure Integration Gateway & Google OAuth (server-side only) ─────────
  get GOOGLE_CLIENT_ID() {
    return process.env.GOOGLE_CLIENT_ID ?? null;
  },

  get GOOGLE_CLIENT_SECRET() {
    return process.env.GOOGLE_CLIENT_SECRET ?? null;
  },

  get GOOGLE_OAUTH_REDIRECT_URI() {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/integrations/google/callback";
  },

  get CHOWDHURY_DUO_GATEWAY_SECRET() {
    return process.env.CHOWDHURY_DUO_GATEWAY_SECRET ?? null;
  },
};

/**
 * Call this explicitly in server startup code or API routes to validate all
 * required environment variables upfront.
 *
 * DO NOT call this at module-load time — it will break the Next.js build because
 * env vars like CLOUDINARY_* are not needed for session validation and calling
 * validateEnv() from session.ts causes it to throw during the admin layout check,
 * which triggers an infinite redirect loop to /admin/login.
 */
export function validateEnv() {
  void env.DATABASE_URL;
  void env.CLOUDINARY_CLOUD_NAME;
  void env.CLOUDINARY_API_KEY;
  void env.CLOUDINARY_API_SECRET;
  void env.SESSION_SECRET;
}
