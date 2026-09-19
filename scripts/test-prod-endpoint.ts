import * as dotenv from "dotenv";
dotenv.config();

const SECRET = process.env.CHOWDHURY_DUO_GATEWAY_SECRET || "";

async function testUrl(label: string, baseUrl: string) {
  console.log(`\n--- Testing ${label}: ${baseUrl} ---`);
  
  // 1. Without secret
  try {
    const resNoAuth = await fetch(`${baseUrl}/api/internal/gateway/gmail/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log(`[No Auth] Status: ${resNoAuth.status}`);
    const textNoAuth = await resNoAuth.text();
    console.log(`[No Auth] Response (first 200 chars): ${textNoAuth.slice(0, 200)}`);
  } catch (err: any) {
    console.log(`[No Auth] Request failed: ${err.message}`);
  }

  // 2. With x-cron-secret
  try {
    const resAuth = await fetch(`${baseUrl}/api/internal/gateway/gmail/poll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": SECRET,
      },
      body: JSON.stringify({}),
    });
    console.log(`[With x-cron-secret] Status: ${resAuth.status}`);
    const textAuth = await resAuth.text();
    console.log(`[With x-cron-secret] Response: ${textAuth}`);
  } catch (err: any) {
    console.log(`[With x-cron-secret] Request failed: ${err.message}`);
  }
}

async function main() {
  console.log("Secret is set:", Boolean(SECRET));
  await testUrl("New Canonical Domain", "https://chowdhuryduo.in");
  await testUrl("Old Vercel Domain", "https://chowdhuryduo.vercel.app");
}

main().catch(console.error);
