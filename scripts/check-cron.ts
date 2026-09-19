import * as dotenv from "dotenv";
dotenv.config();

import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== CHECKING PG_CRON & PG_NET VIA PRISMA ===");
  try {
    // 1. Check cron jobs
    const cronJobs = await prisma.$queryRawUnsafe(`
      SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname 
      FROM cron.job;
    `);
    console.log("CRON JOBS:", JSON.stringify(cronJobs, null, 2));

    // 2. Check recent cron run details
    try {
      const runDetails = await prisma.$queryRawUnsafe(`
        SELECT jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time
        FROM cron.job_run_details
        ORDER BY start_time DESC
        LIMIT 10;
      `);
      console.log("CRON RUN DETAILS (last 10):", JSON.stringify(runDetails, null, 2));
    } catch (e: any) {
      console.log("cron.job_run_details query failed:", e.message);
    }

    // 3. Check pg_net requests/responses if net schema exists
    try {
      const netRequests = await prisma.$queryRawUnsafe(`
        SELECT id, method, url, headers, timeout_milliseconds, created
        FROM net._http_request
        ORDER BY created DESC
        LIMIT 10;
      `);
      console.log("PG_NET REQUESTS (last 10):", JSON.stringify(netRequests, null, 2));
    } catch (e: any) {
      console.log("net._http_request query failed:", e.message);
    }

    try {
      const netResponses = await prisma.$queryRawUnsafe(`
        SELECT id, status_code, content, error_msg, created
        FROM net._http_response
        ORDER BY created DESC
        LIMIT 10;
      `);
      console.log("PG_NET RESPONSES (last 10):", JSON.stringify(netResponses, null, 2));
    } catch (e: any) {
      console.log("net._http_response query failed:", e.message);
    }

  } catch (err: any) {
    console.error("Prisma query failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
