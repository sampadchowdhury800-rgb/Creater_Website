import * as dotenv from "dotenv";
dotenv.config();

import { POST } from "../app/api/internal/gateway/gmail/poll/route";
import { NextRequest } from "next/server";

async function main() {
  console.log("=== RUNNING LOCAL POLL WITH UPDATED ROUTE ===");
  const secret = process.env.CHOWDHURY_DUO_GATEWAY_SECRET || "";

  const req = new NextRequest("http://localhost:3000/api/internal/gateway/gmail/poll", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": secret,
    },
    body: JSON.stringify({ maxResults: 15 }),
  });

  const res = await POST(req);
  console.log("Poll HTTP Status:", res.status);
  const data = await res.json();
  console.log("Poll Result:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
