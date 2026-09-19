/**
 * Debug: Check what's in automation_executions for vivecode999@gmail.com
 * and what messageIds are being returned by IMAP.
 */
import { prisma } from "../lib/prisma";
import { getSupabaseServerClient } from "../lib/supabase/server";

async function main() {
  const supabase = getSupabaseServerClient();

  // Check Supabase executions
  if (supabase) {
    const { data: execs, error } = await supabase
      .from("automation_executions")
      .select("id, gmail_message_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    console.log("Supabase automation_executions error:", error?.message);
    console.log("Supabase automation_executions:", JSON.stringify(execs, null, 2));

    // Check businesses
    const { data: bizs } = await supabase.from("businesses").select("id, slug, name").limit(5);
    console.log("Businesses:", JSON.stringify(bizs, null, 2));

    // Check gmail_accounts
    const { data: gmailAccts } = await supabase.from("gmail_accounts").select("id, email, business_id, status, last_polled_at").limit(5);
    console.log("Gmail accounts:", JSON.stringify(gmailAccts, null, 2));
  } else {
    console.log("Supabase client is NULL - service role key missing");
  }

  // Check Prisma automationExecution  
  try {
    const prismaExecs = await prisma.automationExecution.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, clerkUserId: true, status: true, input: true, createdAt: true },
    });
    console.log("Prisma automationExecutions:", JSON.stringify(prismaExecs, null, 2));
  } catch (e: any) {
    console.log("Prisma automationExecution error:", e.message);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
