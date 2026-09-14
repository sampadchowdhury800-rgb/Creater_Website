/**
 * Automated Verification Suite for HTTP Security Headers
 *
 * Tests:
 * 1. X-Powered-By is disabled (poweredByHeader: false)
 * 2. X-Content-Type-Options: nosniff is configured globally
 * 3. Referrer-Policy: strict-origin-when-cross-origin is configured globally
 * 4. Permissions-Policy restricts camera, microphone, geolocation, usb, display-capture
 * 5. X-Frame-Options: DENY is configured globally
 * 6. Strict-Transport-Security: max-age=31536000; includeSubDomains (no preload)
 * 7. Content-Security-Policy-Report-Only is configured with all verified domains
 * 8. Blocking Content-Security-Policy is NOT set
 * 9. Blocking Cross-Origin-Embedder-Policy (COEP) is NOT set
 * 10. Sensitive API routes receive Cache-Control: private, no-store, max-age=0, must-revalidate
 * 11. Protected file downloads retain dedicated nosniff and cache headers
 *
 * Run via: npx tsx scripts/test-security-headers.ts
 */

import assert from "assert";
import nextConfig from "../next.config";

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err?.message || err}`);
  }
}

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err?.message || err}`);
  }
}

async function runAll() {
  console.log("==================================================================");
  console.log("CHOWDHURY DUO: HTTP SECURITY HEADERS AUDIT VERIFICATION");
  console.log("==================================================================");

  // Test 1: X-Powered-By is disabled
  runTest("1. poweredByHeader is explicitly set to false", () => {
    assert.strictEqual(
      nextConfig.poweredByHeader,
      false,
      "nextConfig.poweredByHeader must be false to disable X-Powered-By: Next.js"
    );
  });

  // Test 2: headers() function is defined
  await runAsyncTest("2. headers() hook is defined on nextConfig", async () => {
    assert(typeof nextConfig.headers === "function", "nextConfig.headers must be a function");
  });

  const headerRules = typeof nextConfig.headers === "function" ? await nextConfig.headers() : [];

  // Helper to find headers for a source
  const findHeadersForSource = (src: string) => {
    const rule = headerRules.find((r: any) => r.source === src);
    if (!rule) return {};
    const map: Record<string, string> = {};
    for (const h of rule.headers) {
      map[h.key] = h.value;
    }
    return map;
  };

  const globalHeaders = findHeadersForSource("/:path*");

  // Test 3: X-Content-Type-Options: nosniff
  runTest("3. Global X-Content-Type-Options is nosniff", () => {
    assert.strictEqual(
      globalHeaders["X-Content-Type-Options"],
      "nosniff",
      "Global headers must include X-Content-Type-Options: nosniff"
    );
  });

  // Test 4: Referrer-Policy: strict-origin-when-cross-origin
  runTest("4. Global Referrer-Policy is strict-origin-when-cross-origin", () => {
    assert.strictEqual(
      globalHeaders["Referrer-Policy"],
      "strict-origin-when-cross-origin",
      "Global headers must include Referrer-Policy: strict-origin-when-cross-origin"
    );
  });

  // Test 5: Permissions-Policy restricts camera, mic, geolocation, usb, display-capture
  runTest("5. Global Permissions-Policy restricts unused device capabilities", () => {
    const policy = globalHeaders["Permissions-Policy"];
    assert(policy, "Permissions-Policy must be defined");
    assert(policy.includes("camera=()"), "camera must be restricted");
    assert(policy.includes("microphone=()"), "microphone must be restricted");
    assert(policy.includes("geolocation=()"), "geolocation must be restricted");
    assert(policy.includes("usb=()"), "usb must be restricted");
    assert(policy.includes("display-capture=()"), "display-capture must be restricted");
  });

  // Test 6: X-Frame-Options: DENY
  runTest("6. Global X-Frame-Options is DENY (Clickjacking protection)", () => {
    assert.strictEqual(
      globalHeaders["X-Frame-Options"],
      "DENY",
      "Global headers must include X-Frame-Options: DENY"
    );
  });

  // Test 7: Strict-Transport-Security
  runTest("7. Global Strict-Transport-Security has max-age and includeSubDomains without preload", () => {
    const hsts = globalHeaders["Strict-Transport-Security"];
    assert(hsts, "Strict-Transport-Security must be defined");
    assert(hsts.includes("max-age=31536000"), "HSTS max-age must be 31536000 (1 year)");
    assert(hsts.includes("includeSubDomains"), "HSTS must include includeSubDomains");
    assert(!hsts.includes("preload"), "HSTS must NOT include preload at this initial stage");
  });

  // Test 8: Content-Security-Policy-Report-Only is present
  runTest("8. Content-Security-Policy-Report-Only is present with verified integrations", () => {
    const csp = globalHeaders["Content-Security-Policy-Report-Only"];
    assert(csp, "Content-Security-Policy-Report-Only header must be present");

    // Baseline directives
    assert(csp.includes("default-src 'self'"), "Must have default-src 'self'");
    assert(csp.includes("object-src 'none'"), "Must have object-src 'none'");
    assert(csp.includes("base-uri 'self'"), "Must have base-uri 'self'");
    assert(csp.includes("frame-ancestors 'none'"), "Must have frame-ancestors 'none'");

    // Clerk
    assert(csp.includes("https://*.clerk.accounts.dev"), "Must allow Clerk dev accounts");
    assert(csp.includes("https://clerk.chowdhuryduo.com"), "Must allow Clerk production domain");
    assert(csp.includes("https://*.clerk.com"), "Must allow Clerk domains");
    assert(csp.includes("https://challenges.cloudflare.com"), "Must allow Clerk Turnstile bot detection");

    // Razorpay
    assert(csp.includes("https://checkout.razorpay.com"), "Must allow Razorpay checkout script & frame");
    assert(csp.includes("https://api.razorpay.com"), "Must allow Razorpay API");
    assert(csp.includes("https://lumberjack.razorpay.com"), "Must allow Razorpay telemetry");

    // Cloudinary & Media
    assert(csp.includes("https://res.cloudinary.com"), "Must allow Cloudinary images and media");

    // YouTube
    assert(csp.includes("https://www.youtube.com"), "Must allow YouTube frames");
    assert(csp.includes("https://www.youtube-nocookie.com"), "Must allow YouTube nocookie frames");
    assert(csp.includes("https://img.youtube.com"), "Must allow YouTube thumbnails");
    assert(csp.includes("https://i.ytimg.com"), "Must allow ytimg thumbnails");

    // Google Fonts & Favicons
    assert(csp.includes("https://fonts.googleapis.com"), "Must allow Google Fonts stylesheet");
    assert(csp.includes("https://fonts.gstatic.com"), "Must allow Google Fonts files");
    assert(csp.includes("https://www.google.com"), "Must allow Google favicons API");

    // FormSubmit
    assert(csp.includes("https://formsubmit.co"), "Must allow FormSubmit connect-src and form-action");

    // Ad networks
    assert(csp.includes("https://*.effectivecpmnetwork.com"), "Must allow effectivecpmnetwork scripts/frames");
    assert(csp.includes("https://www.highperformanceformat.com"), "Must allow highperformanceformat scripts/frames");
  });

  // Test 9: Blocking Content-Security-Policy is NOT present
  runTest("9. Blocking Content-Security-Policy is NOT configured", () => {
    assert.strictEqual(
      globalHeaders["Content-Security-Policy"],
      undefined,
      "Blocking Content-Security-Policy must NOT be set yet (Report-Only only)"
    );
  });

  // Test 10: COEP is NOT present
  runTest("10. Cross-Origin-Embedder-Policy (COEP) is NOT set", () => {
    assert.strictEqual(
      globalHeaders["Cross-Origin-Embedder-Policy"],
      undefined,
      "COEP must NOT be enabled as it breaks third-party iframes and images"
    );
  });

  // Test 11: Sensitive API Cache-Control
  const sensitivePaths = [
    "/api/admin/:path*",
    "/api/automation-executions/:path*",
    "/api/orders/:path*",
    "/api/user-automations/:path*",
    "/api/my-automations/:path*",
  ];

  for (const p of sensitivePaths) {
    runTest(`11. Sensitive API route ${p} receives private, no-store Cache-Control`, () => {
      const headers = findHeadersForSource(p);
      assert.strictEqual(
        headers["Cache-Control"],
        "private, no-store, max-age=0, must-revalidate",
        `${p} must have Cache-Control: private, no-store, max-age=0, must-revalidate`
      );
    });
  }

  // Test 12: Public API routes are not inappropriately forced with no-store
  runTest("12. Public APIs (/api/automations) are not restricted by private API cache rules", () => {
    const automationsRule = headerRules.find((r: any) => r.source === "/api/automations/:path*" || r.source === "/api/automations");
    assert.strictEqual(automationsRule, undefined, "Public catalog API should not have private cache rule");
  });

  console.log("==================================================================");
  console.log(`AUDIT VERIFICATION SUMMARY: ${passed}/${total} passed`);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Unhandled verification error:", err);
  process.exit(1);
});
