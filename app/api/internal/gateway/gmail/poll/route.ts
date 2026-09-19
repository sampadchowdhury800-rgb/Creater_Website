/**
 * app/api/internal/gateway/gmail/poll/route.ts
 *
 * Secure internal endpoint for scheduled polling of connected Gmail inboxes.
 * Replaces Google Cloud Pub/Sub push notification and Gmail API OAuth dependencies.
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Secured via CHOWDHURY_DUO_GATEWAY_SECRET (x-cron-secret / x-internal-service-key / Bearer header).
 * 2. Strict tenant isolation: processes each tenant's mailboxes independently.
 * 3. Never returns or logs Gmail App Passwords or plaintext credentials.
 * 4. Polling via Gmail IMAP (imap.gmail.com:993 with TLS) using customer's App Password.
 * 5. Deduplication & atomic claims via Supabase automation_executions / Prisma automationExecution.
 * 6. Full AI customer support pipeline:
 *    - Intent classification (dedicated GMAIL_SUPPORT_AI_API_KEY)
 *    - Business rules & knowledge base retrieval
 *    - Grounded AI reply generation
 *    - Outbound response via Gmail SMTP (smtp.gmail.com:465 with TLS)
 * 7. SERVER-SIDE ONLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateInternalServiceRequest } from "@/lib/security/internal-auth";
import { vaultDecrypt } from "@/lib/crypto/vault";
import {
  listUnreadImapMessages,
  fetchImapMessage,
  markImapMessageSeen,
} from "@/lib/integrations/providers/imap";
import { sendSmtpReply } from "@/lib/integrations/providers/smtp";
import {
  classifyEmailIntent,
  retrieveBusinessKnowledge,
  generateGroundedReply,
  sendSlackNotification,
} from "@/lib/ai/support-engine";
import { evaluateSupportDecision } from "@/lib/services/support-supervisor";
import { getBusinessHours } from "@/lib/services/business-hours";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handlePoll(req);
}

export async function GET(req: NextRequest) {
  return handlePoll(req);
}

interface ProcessEmailOptions {
  msg: { id: string; threadId?: string; uid: number; date: Date };
  creds: { email: string; appPassword: string };
  account: {
    id?: string;
    businessId: string;
    email: string;
    slug?: string;
    businessName?: string;
    timezone?: string;
    support_enabled?: boolean;
    auto_reply_enabled?: boolean;
  };
  rules: any;
  hours?: any[];
  supabase: any;
}

/**
 * Executes the complete AI customer support pipeline for a single inbound email.
 * Governed by the deterministic Support Supervisor layer.
 */
async function processSingleEmail({
  msg,
  creds,
  account,
  rules,
  hours = [],
  supabase,
}: ProcessEmailOptions): Promise<{ processed: boolean; replied: boolean; error?: string }> {
  if (!msg?.id) return { processed: false, replied: false };
  const messageId = String(msg.id);
  const threadId = String(msg.threadId || msg.id);

  // 1. Deduplication check: Supabase
  let existingExecutionId: string | undefined;
  if (supabase && account.businessId) {
    try {
      const { data: existingExecution } = await supabase
        .from("automation_executions")
        .select("id, status, created_at")
        .eq("business_id", account.businessId)
        .eq("gmail_message_id", messageId)
        .maybeSingle();

      if (existingExecution) {
        const status = existingExecution.status;
        if (status === "COMPLETED" || status === "SKIPPED") {
          return { processed: false, replied: false };
        }
        if (status === "PROCESSING") {
          const createdAt = new Date(existingExecution.created_at).getTime();
          const ageMs = Date.now() - createdAt;
          if (ageMs < 3 * 60 * 1000) {
            return { processed: false, replied: false };
          }
          existingExecutionId = existingExecution.id;
        }
      }
    } catch (e: any) {
      console.warn("[Poll] Supabase deduplication check warning:", e?.message);
    }
  }

  // 2. Deduplication check: Prisma
  try {
    const clerkUid = account.slug;
    if (clerkUid) {
      const existingPrisma = await prisma.automationExecution.findFirst({
        where: {
          clerkUserId: clerkUid,
          status: "COMPLETED",
          input: {
            path: ["gmailMessageId"],
            equals: messageId,
          },
        },
        select: { id: true },
      });
      if (existingPrisma) {
        return { processed: false, replied: false };
      }
    }
  } catch (pCheckErr: any) {
    // Non-blocking
  }

  // 3. Atomic claim via Supabase unique constraint
  let executionId: string | undefined = existingExecutionId;
  if (supabase && account.businessId) {
    try {
      if (existingExecutionId) {
        await supabase
          .from("automation_executions")
          .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
          .eq("id", existingExecutionId);
        executionId = existingExecutionId;
      } else {
        const { data: claimRecord, error: claimErr } = await supabase
          .from("automation_executions")
          .insert({
            business_id: account.businessId,
            gmail_account_id: account.id || null,
            gmail_message_id: messageId,
            gmail_thread_id: threadId,
            status: "PROCESSING",
            trigger_type: "SCHEDULED_POLL",
          })
          .select("id")
          .single();

        if (claimErr) {
          return { processed: false, replied: false };
        }
        executionId = claimRecord?.id;
      }
    } catch {
      // Continue if insert/update threw
    }
  }

  try {
    // 4. Fetch full message body via IMAP
    const fetchResult = await fetchImapMessage(creds, messageId, "full");
    if (!fetchResult.success || !fetchResult.message) {
      if (supabase && executionId) {
        await supabase
          .from("automation_executions")
          .update({
            status: "FAILED",
            error_message: fetchResult.errorMessage || "Could not fetch message body.",
          })
          .eq("id", executionId);
      }
      return { processed: false, replied: false, error: fetchResult.errorMessage };
    }

    const emailMsg = fetchResult.message;
    const sender = emailMsg.from || "unknown";
    const subject = emailMsg.subject || "(no subject)";
    const bodyText = emailMsg.bodyText || "";
    const bodyHtml = emailMsg.bodyHtml || `<p>${bodyText}</p>`;

    // 5. Filter self-sent emails (outbound sent by the mailbox itself)
    if (sender.toLowerCase().includes(account.email.toLowerCase())) {
      if (supabase && executionId) {
        await supabase
          .from("automation_executions")
          .update({
            status: "SKIPPED",
            error_message: "Ignored self-sent email.",
          })
          .eq("id", executionId);
      }
      return { processed: false, replied: false };
    }

    // 6. Identify or create Customer & Conversation in Supabase
    const senderMatch = sender.match(/<([^>]+)>/) || [null, sender];
    const cleanSenderEmail = (senderMatch[1] || sender).trim().toLowerCase();
    const senderName = sender.replace(/<[^>]+>/, "").trim() || cleanSenderEmail;

    let customerId: string | null = null;
    let conversationId: string | null = null;

    if (supabase && account.businessId) {
      try {
        const { data: customer } = await supabase
          .from("customers")
          .upsert(
            {
              business_id: account.businessId,
              email: cleanSenderEmail,
              name: senderName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "business_id,email" }
          )
          .select("id")
          .single();
        customerId = customer?.id || null;

        const { data: conversation } = await supabase
          .from("conversations")
          .upsert(
            {
              business_id: account.businessId,
              customer_id: customerId,
              gmail_thread_id: threadId,
              subject,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "business_id,gmail_thread_id" }
          )
          .select("id")
          .single();
        conversationId = conversation?.id || null;

        await supabase.from("messages").insert({
          business_id: account.businessId,
          conversation_id: conversationId,
          gmail_message_id: messageId,
          role: "CUSTOMER",
          sender,
          recipient: account.email,
          subject,
          body_text: bodyText,
          body_html: bodyHtml,
          status: "RECEIVED",
          sent_at: emailMsg.date || new Date().toISOString(),
        });
      } catch (sbInsertErr: any) {
        console.warn("[Poll] Supabase records creation warning:", sbInsertErr?.message);
      }
    }

    // 7. Support Supervisor Decision Layer
    const parsedEmail = {
      id: messageId,
      threadId,
      sender,
      recipient: account.email,
      subject,
      bodyText,
      bodyHtml,
      date: emailMsg.date,
    };

    const decision = await evaluateSupportDecision({
      email: parsedEmail,
      business: {
        id: account.businessId,
        name: account.businessName || "Business",
        slug: account.slug || "",
        contact_email: account.email,
        timezone: account.timezone || "UTC",
      },
      rules,
      hours,
      account: {
        id: account.id,
        business_id: account.businessId,
        email: account.email,
        support_enabled: account.support_enabled ?? true,
        auto_reply_enabled: account.auto_reply_enabled ?? true,
      },
      supabaseClient: supabase,
    });

    // ── Decision: SKIP ──────────────────────────────────────────────────────────
    if (decision.action === "SKIP") {
      if (supabase && executionId) {
        await supabase
          .from("automation_executions")
          .update({
            status: "SKIPPED",
            error_message: decision.reasoning,
          })
          .eq("id", executionId);
      }
      return { processed: true, replied: false };
    }

    // ── Decision: HUMAN_REVIEW / ESCALATE ───────────────────────────────────────
    if (decision.action === "HUMAN_REVIEW") {
      if (supabase) {
        if (conversationId) {
          await supabase
            .from("conversations")
            .update({
              status: "PENDING_APPROVAL",
              confidence_score: decision.confidence,
              category: decision.category,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        }
        if (rules?.slack_webhook_url || rules?.slack_channel_id) {
          await sendSlackNotification({
            webhookUrl: rules.slack_webhook_url,
            channelId: rules.slack_channel_id,
            businessName: account.businessName || "Business",
            sender,
            subject,
            classification: decision.category,
            confidence: decision.confidence,
            actionTaken: "ESCALATED",
            summaryOrReasoning: decision.reasoning,
          });
        }
        if (executionId) {
          await supabase
            .from("automation_executions")
            .update({
              status: "COMPLETED",
              conversation_id: conversationId,
            })
            .eq("id", executionId);
        }
      }

      // Mirror to Prisma
      try {
        const clerkUid = account.slug;
        if (clerkUid) {
          const userAuto = await prisma.userAutomation.findFirst({
            where: { clerkUserId: clerkUid },
            select: { id: true, clerkUserId: true },
          });
          if (userAuto) {
            await prisma.automationExecution.create({
              data: {
                userAutomationId: userAuto.id,
                clerkUserId: userAuto.clerkUserId,
                status: "COMPLETED",
                startedAt: new Date(),
                completedAt: new Date(),
                input: { sender, recipient: account.email, subject, gmailMessageId: messageId },
                output: {
                  classification: decision.category,
                  confidence: decision.confidence,
                  actionTaken: "ESCALATED",
                  reasoning: decision.reasoning,
                },
              },
            });
          }
        }
      } catch (mirrorErr: any) {
        console.warn("[Poll] Prisma execution mirror warning:", mirrorErr?.message);
      }

      return { processed: true, replied: false };
    }

    // ── Decision: AUTO_REPLY / FALLBACK / AFTER_HOURS ───────────────────────────
    const replyHtml = decision.replyHtml || `<p>${decision.replyText || "Thank you for contacting us."}</p>`;
    const replyText = decision.replyText || "Thank you for contacting us.";

    // Send Outbound Reply via Gmail SMTP
    const smtpRes = await sendSmtpReply(creds, {
      from: account.email,
      to: cleanSenderEmail,
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      bodyHtml: replyHtml,
      bodyText: replyText,
      inReplyTo: messageId,
      references: messageId,
    });

    if (smtpRes.success) {
      if (supabase) {
        try {
          await supabase.from("messages").insert({
            business_id: account.businessId,
            conversation_id: conversationId,
            role: "AI_DRAFT",
            sender: account.email,
            recipient: cleanSenderEmail,
            subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
            body_text: replyText,
            body_html: replyHtml,
            status: "SENT",
            sent_at: new Date().toISOString(),
          });

          if (conversationId) {
            await supabase
              .from("conversations")
              .update({
                status: "AUTO_REPLIED",
                confidence_score: decision.confidence,
                category: decision.category,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversationId);
          }

          if (rules?.slack_webhook_url || rules?.slack_channel_id) {
            await sendSlackNotification({
              webhookUrl: rules.slack_webhook_url,
              channelId: rules.slack_channel_id,
              businessName: account.businessName || "Business",
              sender,
              subject,
              classification: decision.category,
              confidence: decision.confidence,
              actionTaken: "AUTO_REPLIED",
              summaryOrReasoning: decision.reasoning,
            });
          }

          if (executionId) {
            await supabase
              .from("automation_executions")
              .update({
                status: "COMPLETED",
                conversation_id: conversationId,
              })
              .eq("id", executionId);
          }
        } catch (sbUpdateErr: any) {
          console.warn("[Poll] Supabase post-send update warning:", sbUpdateErr?.message);
        }
      }

      // Mark IMAP message as seen / read
      await markImapMessageSeen(creds, messageId);

      // Mirror execution to Prisma Activity UI
      try {
        const clerkUid = account.slug;
        if (clerkUid) {
          const userAuto = await prisma.userAutomation.findFirst({
            where: { clerkUserId: clerkUid },
            select: { id: true, clerkUserId: true },
          });
          if (userAuto) {
            await prisma.automationExecution.create({
              data: {
                userAutomationId: userAuto.id,
                clerkUserId: userAuto.clerkUserId,
                status: "COMPLETED",
                startedAt: new Date(),
                completedAt: new Date(),
                input: { sender, recipient: account.email, subject, gmailMessageId: messageId },
                output: {
                  classification: decision.category,
                  confidence: decision.confidence,
                  actionTaken: decision.action,
                  replySubject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
                  replySnippet: replyText.slice(0, 200),
                },
              },
            });
          }
        }
      } catch (mirrorErr: any) {
        console.warn("[Poll] Prisma execution mirror warning:", mirrorErr?.message);
      }

      return { processed: true, replied: true };
    } else {
      // SMTP send failed
      if (supabase && executionId) {
        await supabase
          .from("automation_executions")
          .update({
            status: "FAILED",
            error_message: smtpRes.errorMessage || "SMTP reply failed.",
          })
          .eq("id", executionId);
      }
      return { processed: true, replied: false, error: smtpRes.errorMessage };
    }
  } catch (msgErr: any) {
    console.error(`[Poll] Error processing message ${messageId}:`, msgErr);
    if (supabase && executionId) {
      await supabase
        .from("automation_executions")
        .update({
          status: "FAILED",
          error_message: msgErr?.message || "Unknown error processing message.",
        })
        .eq("id", executionId);
    }
    return { processed: false, replied: false, error: msgErr?.message };
  }
}

async function handlePoll(req: NextRequest) {
  // ─── Step 1: Internal Service Authentication ────────────────────────────────
  const authCheck = validateInternalServiceRequest(req);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      {
        success: false,
        errorCode: authCheck.errorCode || "UNAUTHORIZED",
        errorMessage: authCheck.errorMessage || "Invalid or missing service authentication.",
      },
      { status: 401 }
    );
  }

  // ─── Step 2: Parse Safe Filter Parameters ───────────────────────────────────
  let body: { tenantId?: string; businessId?: string; maxResults?: number } = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }
  }

  const businessFilter = body.businessId || req.nextUrl.searchParams.get("businessId") || undefined;
  const tenantFilter = body.tenantId || req.nextUrl.searchParams.get("tenantId") || undefined;
  const parsedMax = Number(body.maxResults || req.nextUrl.searchParams.get("maxResults") || 10);
  const maxResults = Number.isFinite(parsedMax) && parsedMax > 0 && parsedMax <= 50 ? parsedMax : 10;

  const summary = {
    accountsChecked: 0,
    accountsSkipped: 0,
    messagesFound: 0,
    messagesProcessed: 0,
    repliesSent: 0,
    executionsCreated: 0,
  };

  const accountDetails: Array<{
    email: string;
    businessId: string;
    status: string;
    messagesFound?: number;
    processedCount?: number;
    error?: string;
  }> = [];

  const supabase = getSupabaseServerClient();

  // ─── Step 3: Poll Supabase Multi-Tenant Gmail Accounts ───────────────────────
  if (supabase) {
    try {
      let query = supabase
        .from("gmail_accounts")
        .select(`
          id,
          business_id,
          email,
          app_password_enc,
          app_password_iv,
          app_password_tag,
          vault_version,
          status,
          business:businesses (
            id,
            name,
            slug,
            rules:business_rules (
              tone,
              support_policies,
              refund_return_rules,
              prohibited_responses,
              working_hours,
              custom_instructions,
              auto_reply_enabled,
              confidence_threshold,
              slack_webhook_url,
              slack_channel_id
            )
          )
        `)
        .eq("status", "CONNECTED");

      if (businessFilter) {
        query = query.eq("business_id", businessFilter);
      }

      const { data: accounts, error: accErr } = await query;

      if (!accErr && Array.isArray(accounts)) {
        for (const account of accounts) {
          summary.accountsChecked++;
          const business = Array.isArray(account.business)
            ? account.business[0]
            : account.business;
          const rules = business?.rules
            ? Array.isArray(business.rules)
              ? business.rules[0]
              : business.rules
            : null;

          let appPassword = "";
          try {
            appPassword = vaultDecrypt({
              version: account.vault_version || 1,
              iv: account.app_password_iv,
              authTag: account.app_password_tag,
              encryptedValue: account.app_password_enc,
            });
          } catch (decErr: any) {
            console.error(`[Poll] Vault decryption failed for ${account.email}:`, decErr?.message);
            summary.accountsSkipped++;
            accountDetails.push({
              email: account.email,
              businessId: account.business_id,
              status: "DECRYPTION_FAILED",
              error: "Stored credential decryption failed.",
            });
            await supabase
              .from("gmail_accounts")
              .update({ status: "ERROR", error_message: "Vault credential decryption failed." })
              .eq("id", account.id);
            continue;
          }

          const creds = { email: account.email, appPassword };

          let listResult;
          try {
            listResult = await listUnreadImapMessages(creds, { maxResults });
          } catch (imapErr: any) {
            console.warn(`[Poll] IMAP connection failed for ${account.email}:`, imapErr?.message);
            summary.accountsSkipped++;
            accountDetails.push({
              email: account.email,
              businessId: account.business_id,
              status: "IMAP_ERROR",
              error: imapErr?.message || "IMAP connection failure.",
            });
            await supabase
              .from("gmail_accounts")
              .update({ last_error: imapErr?.message || "IMAP connection failed." })
              .eq("id", account.id);
            continue;
          }

          if (!listResult.success || !Array.isArray(listResult.messages)) {
            summary.accountsSkipped++;
            accountDetails.push({
              email: account.email,
              businessId: account.business_id,
              status: "IMAP_ERROR",
              error: listResult.errorMessage || "Failed to list messages.",
            });
            continue;
          }

          const messages = listResult.messages;
          summary.messagesFound += messages.length;
          let processedForAccount = 0;

          const hours = await getBusinessHours(account.business_id);

          for (const msg of messages) {
            const result = await processSingleEmail({
              msg,
              creds,
              account: {
                id: account.id,
                businessId: account.business_id,
                email: account.email,
                slug: business?.slug,
                businessName: business?.name,
                timezone: (business as any)?.timezone || "UTC",
                support_enabled: (account as any).support_enabled ?? true,
                auto_reply_enabled: (account as any).auto_reply_enabled ?? true,
              },
              rules,
              hours,
              supabase,
            });

            if (result.processed) {
              processedForAccount++;
              summary.messagesProcessed++;
              if (result.replied) {
                summary.repliesSent++;
              }
            }
          }

          // Update last_polled_at for account
          await supabase
            .from("gmail_accounts")
            .update({
              last_polled_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", account.id);

          accountDetails.push({
            email: account.email,
            businessId: account.business_id,
            status: "SUCCESS",
            messagesFound: messages.length,
            processedCount: processedForAccount,
          });
        }
      }
    } catch (sbQueryErr: any) {
      console.error("[Poll] Supabase query exception:", sbQueryErr?.message);
    }
  }

  // ─── Step 4: Fallback / Prisma Integration Connections ────────────────────────
  try {
    const whereClause: Record<string, unknown> = {
      provider: "GOOGLE",
      status: "CONNECTED",
    };
    if (tenantFilter) {
      whereClause.clerkUserId = tenantFilter;
    }

    const legacyConns = await prisma.integrationConnection.findMany({
      where: whereClause as any,
    });

    for (const conn of legacyConns) {
      if (!conn.accountEmail || !conn.accessTokenEncrypted) continue;
      // If already processed via Supabase accounts, skip duplicate
      if (accountDetails.some((a) => a.email.toLowerCase() === conn.accountEmail?.toLowerCase())) {
        continue;
      }

      try {
        const appPassword = vaultDecrypt({
          version: conn.vaultVersion || 1,
          iv: conn.accessTokenIv,
          authTag: conn.accessTokenAuthTag,
          encryptedValue: conn.accessTokenEncrypted,
        });

        const creds = { email: conn.accountEmail, appPassword };
        const listRes = await listUnreadImapMessages(creds, { maxResults });
        summary.accountsChecked++;

        // Auto-sync to Supabase if Supabase is connected
        let businessId = conn.clerkUserId;
        let rules: any = {
          company_description: "Customer Support Service",
          support_policies: "We provide prompt and helpful customer support for all inquiries. Our business hours are Monday to Friday from 9:00 AM to 6:00 PM IST.",
          refund_return_rules: "Full refund within 14 days of purchase upon request.",
          tone: "friendly, professional, and clear",
          working_hours: "Monday - Friday, 9:00 AM - 6:00 PM IST",
          auto_reply_enabled: true,
          confidence_threshold: 0.65,
        };

        if (supabase) {
          try {
            const { data: biz } = await supabase.from("businesses").upsert(
              { slug: conn.clerkUserId, name: `Tenant ${conn.clerkUserId.slice(-6)}`, contact_email: conn.accountEmail },
              { onConflict: "slug" }
            ).select("id").single();

            if (biz?.id) {
              businessId = biz.id;
              await supabase.from("business_rules").upsert(
                {
                  business_id: biz.id,
                  ...rules,
                },
                { onConflict: "business_id" }
              );

              const { data: fetchedRules } = await supabase
                .from("business_rules")
                .select("*")
                .eq("business_id", biz.id)
                .maybeSingle();
              if (fetchedRules) rules = fetchedRules;

              await supabase.from("gmail_accounts").upsert(
                {
                  business_id: biz.id,
                  email: conn.accountEmail,
                  app_password_enc: conn.accessTokenEncrypted,
                  app_password_iv: conn.accessTokenIv,
                  app_password_tag: conn.accessTokenAuthTag,
                  vault_version: conn.vaultVersion || 1,
                  status: "CONNECTED",
                  last_polled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "business_id,email" }
              );
            }
          } catch (autoSyncErr: any) {
            console.warn("[Poll] Auto-sync to Supabase warning:", autoSyncErr?.message);
          }
        }

        let processedForConn = 0;
        if (listRes.success && Array.isArray(listRes.messages)) {
          summary.messagesFound += listRes.messages.length;

          // FULL END-TO-END PROCESSING FOR PRISMA INTEGRATION CONNECTIONS
          const hours = await getBusinessHours(businessId);
          for (const msg of listRes.messages) {
            const result = await processSingleEmail({
              msg,
              creds,
              account: {
                businessId,
                email: conn.accountEmail,
                slug: conn.clerkUserId,
                businessName: `Tenant ${conn.clerkUserId.slice(-6)}`,
                timezone: "UTC",
                support_enabled: true,
                auto_reply_enabled: true,
              },
              rules,
              hours,
              supabase,
            });

            if (result.processed) {
              processedForConn++;
              summary.messagesProcessed++;
              if (result.replied) {
                summary.repliesSent++;
              }
            }
          }

          accountDetails.push({
            email: conn.accountEmail,
            businessId: conn.clerkUserId,
            status: "SUCCESS",
            messagesFound: listRes.messages.length,
            processedCount: processedForConn,
          });
        }
      } catch (connErr: any) {
        console.warn(`[Poll] Connection poll error for ${conn.accountEmail}:`, connErr?.message);
      }
    }
  } catch (prismaErr: any) {
    console.warn("[Poll] Prisma query skipped:", prismaErr?.message);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    summary,
    accounts: accountDetails,
  });
}
