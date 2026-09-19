/**
 * scripts/deploy-supabase-migrations.ts
 *
 * Programmatic deployment script for Supabase migrations & scheduler.
 * Consumes SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL / SUPABASE_DB_PASSWORD.
 * Substitutes CHOWDHURY_DUO_GATEWAY_SECRET and production domain dynamically.
 * NEVER prints secret values.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const PROJECT_REF = 'udfqrlzsgkdbvungumto';
const VERCEL_DOMAIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://chowdhuryduo.in')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');
const GATEWAY_SECRET = process.env.CHOWDHURY_DUO_GATEWAY_SECRET;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function executeSqlViaManagementApi(sql: string, description: string) {
  if (!ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN is required for Management API deployment.');
  }

  console.log(`Executing ${description}...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to execute ${description}: [${res.status}] ${errText}`);
  }

  console.log(`✓ ${description} executed successfully.`);
  return await res.json();
}

async function verifyLiveTables() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const tables = [
    'businesses',
    'gmail_support_settings',
    'email_logs',
    'customer_conversations',
    'conversation_messages',
    'knowledge_articles',
    'execution_traces',
    'circuit_breaker_states',
  ];

  console.log('\n--- Verifying Live Supabase Tables ---');
  let allOk = true;
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`✗ Table [${t}]: ${error.message}`);
      allOk = false;
    } else {
      console.log(`✓ Table [${t}] is live (rows: ${data?.length ?? 0})`);
    }
  }

  return allOk;
}

async function main() {
  console.log(`Starting Supabase automated deployment for project: ${PROJECT_REF}`);

  if (!GATEWAY_SECRET) {
    console.error('ERROR: CHOWDHURY_DUO_GATEWAY_SECRET is not set in .env');
    process.exit(1);
  }

  if (!ACCESS_TOKEN) {
    console.error('ERROR: SUPABASE_ACCESS_TOKEN is not provided.');
    process.exit(1);
  }

  // 1. Read Migration 1
  const migration1Path = path.join(process.cwd(), 'supabase', 'migrations', '20260919000001_gmail_ai_support_schema.sql');
  const migration1Sql = fs.readFileSync(migration1Path, 'utf8');

  // 2. Read Migration 2 & inject domain and gateway secret
  const migration2Path = path.join(process.cwd(), 'supabase', 'migrations', '20260919000002_polling_scheduler_schema.sql');
  let migration2Sql = fs.readFileSync(migration2Path, 'utf8');

  migration2Sql = migration2Sql
    .replace(/<YOUR_VERCEL_DOMAIN>/g, VERCEL_DOMAIN)
    .replace(/<YOUR_CHOWDHURY_DUO_GATEWAY_SECRET>/g, GATEWAY_SECRET);

  // 3. Execute Migration 1 (Extensions & Schema)
  await executeSqlViaManagementApi(migration1Sql, 'Migration 1 (Schema & Extensions)');

  // 4. Execute Migration 2 (pg_cron scheduler)
  await executeSqlViaManagementApi(migration2Sql, 'Migration 2 (Polling Scheduler)');

  // 5. Verify tables
  const tablesOk = await verifyLiveTables();

  // 6. Verify cron job
  const cronCheck = await executeSqlViaManagementApi(
    `SELECT jobname, schedule, active, jobid FROM cron.job WHERE jobname = 'gmail-poll-gateway';`,
    'Cron Job Verification'
  );
  console.log('\n--- Cron Job Verification ---');
  console.log(JSON.stringify(cronCheck, null, 2));

  if (tablesOk) {
    console.log('\n All deployment tasks completed successfully!');
  } else {
    console.error('\n Some tables failed verification.');
  }
}

main().catch((err) => {
  console.error('Deployment error:', err.message);
  process.exit(1);
});
