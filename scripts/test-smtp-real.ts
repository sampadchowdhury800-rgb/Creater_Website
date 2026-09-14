/**
 * Real Brevo REST API integration test.
 * Dispatches one controlled developer escalation test email.
 * Run with: npx tsx --env-file=.env scripts/test-smtp-real.ts
 */

import { sendBrevoEmail } from "../lib/email/brevo";

async function run() {
  const hasKey = !!process.env.BREVO_API_KEY;
  const fromEmail = process.env.SUPPORT_FROM_EMAIL || "chowdhuryduo@gmail.com";
  const toEmail = "chowdhuryduo@gmail.com";

  if (!hasKey) {
    console.error("❌ BREVO_API_KEY is not configured in environment.");
    process.exit(1);
  }

  const referenceId = `CD-TEST-${Date.now()}`;

  const result = await sendBrevoEmail({
    toEmail,
    toName: "Chowdhury Duo Developers",
    fromEmail,
    fromName: "Chowdhury Duo Support System",
    subject: "[TEST] Chowdhury Duo AI Support Escalation",
    textContent: [
      "CHOWDHURY DUO — DEVELOPER ESCALATION VERIFICATION",
      "==================================================",
      "",
      "This is a controlled verification test sent via Brevo REST API.",
      "",
      `Reference ID : ${referenceId}`,
      `Timestamp    : ${new Date().toISOString()}`,
      `Transport    : Brevo REST API v3 (https://api.brevo.com/v3/smtp/email)`,
      "",
      "Verification complete.",
    ].join("\n"),
    htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Support Escalation Test</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#333;">
  <div style="background:#1a1a2e;color:#fff;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">🔧 Developer Escalation Verification</h1>
    <p style="margin:4px 0 0;opacity:0.7;font-size:13px;">Chowdhury Duo AI Support System</p>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p>This is a controlled verification test dispatched via the <strong>Brevo REST API</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:160px;">Reference ID</td>
          <td style="padding:8px;font-family:monospace;">${referenceId}</td></tr>
      <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Timestamp</td>
          <td style="padding:8px;font-family:monospace;">${new Date().toISOString()}</td></tr>
      <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Endpoint</td>
          <td style="padding:8px;">https://api.brevo.com/v3/smtp/email</td></tr>
    </table>
    <p style="color:#16a34a;font-weight:bold;">
      ✅ Brevo REST API email transport successfully verified.
    </p>
  </div>
</body>
</html>`,
  });

  if (result.success) {
    console.log("BREVO_API_REQUEST: PASS");
    console.log(`HTTP_STATUS: ${result.statusCode ?? 201}`);
    console.log(`MESSAGE_ID: ${result.messageId}`);
    console.log("REAL_EMAIL_ACCEPTED: PASS");
  } else {
    console.error("BREVO_API_REQUEST: FAIL");
    console.error(`HTTP_STATUS: ${result.statusCode ?? 500}`);
    console.error(`ERROR: ${result.error}`);
    console.error("REAL_EMAIL_ACCEPTED: FAIL");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("BREVO_API_REQUEST: FAIL");
  console.error("HTTP_STATUS: 500");
  console.error("REAL_EMAIL_ACCEPTED: FAIL");
  process.exit(1);
});
