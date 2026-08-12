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
