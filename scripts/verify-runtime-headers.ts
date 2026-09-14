const PROD_URL = "https://chowdhuryduo.vercel.app";
const HTTP_PROD_URL = "http://chowdhuryduo.vercel.app";

type NormalizedHeaders = Record<string, string>;

interface FetchHeadersResult {
  status: number;
  statusText: string;
  headers: NormalizedHeaders;
}

async function fetchHeaders(
  url: string,
  options: RequestInit = {}
): Promise<FetchHeadersResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      ...options,
    });

    const headers: NormalizedHeaders = {};
    res.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    return {
      status: res.status,
      statusText: res.statusText,
      headers,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const emptyHeaders: NormalizedHeaders = {};
    return {
      status: 0,
      statusText: errorMessage,
      headers: emptyHeaders,
    };
  }
}

async function main(): Promise<void> {
  console.log("==================================================================");
  console.log("READ-ONLY RUNTIME HTTP HEADERS VERIFICATION");
  console.log("Target:", PROD_URL);
  console.log("Timestamp:", new Date().toISOString());
  console.log("==================================================================\n");

  // 1. Test HTTP to HTTPS redirect
  console.log("--- 1. HTTP -> HTTPS Redirect Check ---");
  const httpRes = await fetchHeaders(HTTP_PROD_URL);
  console.log(`GET ${HTTP_PROD_URL} -> Status: ${httpRes.status}`);
  console.log(`Location: ${httpRes.headers["location"] || "(none)"}`);
  console.log(`HSTS on HTTP?: ${httpRes.headers["strict-transport-security"] || "(none)"}\n`);

  // 2. Test Endpoints
  const endpoints = [
    "/",
    "/automations",
    "/cart",
    "/api/analytics/track",
    "/api/automations",
    "/api/admin/settings",
    "/api/automation-executions",
    "/api/orders/create",
    "/api/user-automations",
    "/api/my-automations",
  ];

  for (const ep of endpoints) {
    const fullUrl = `${PROD_URL}${ep}`;
    const res = await fetchHeaders(fullUrl);
    console.log(`==================================================================`);
    console.log(`ENDPOINT: ${ep} (Status: ${res.status} ${res.statusText})`);
    console.log(`------------------------------------------------------------------`);
    console.log(`x-content-type-options:            ${res.headers["x-content-type-options"] || "MISSING"}`);
    console.log(`x-frame-options:                   ${res.headers["x-frame-options"] || "MISSING"}`);
    console.log(`referrer-policy:                   ${res.headers["referrer-policy"] || "MISSING"}`);
    console.log(`permissions-policy:                ${res.headers["permissions-policy"] || "MISSING"}`);
    console.log(`strict-transport-security:         ${res.headers["strict-transport-security"] || "MISSING"}`);
    console.log(`content-security-policy-report-only: ${res.headers["content-security-policy-report-only"] ? "PRESENT (" + res.headers["content-security-policy-report-only"].substring(0, 60) + "...)" : "MISSING"}`);
    console.log(`content-security-policy (blocking): ${res.headers["content-security-policy"] || "NONE (correct)"}`);
    console.log(`x-powered-by:                      ${res.headers["x-powered-by"] || "NONE (correct)"}`);
    console.log(`cache-control:                     ${res.headers["cache-control"] || "DEFAULT"}`);
    console.log(`server:                            ${res.headers["server"] || "(none)"}`);
    console.log(`x-vercel-id:                       ${res.headers["x-vercel-id"] || "(none)"}`);
    console.log(`\nALL HEADERS RETURNED:`);
    console.log(JSON.stringify(res.headers, null, 2));
    console.log(`\n`);
  }
}

main().catch((err: unknown) => {
  console.error("Unhandled error in verification script:", err);
  process.exit(1);
});
