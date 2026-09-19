/**
 * app/api/support-backend/route.ts
 *
 * Full-featured server-side API endpoint for the Gmail AI Support dashboard.
 * Provides multi-tenant business profile, structured business hours, policies,
 * configurable support categories, multi-account Gmail settings, knowledge base,
 * and deterministic test simulation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultBusiness, getAutomationExecutions } from "@/lib/supabase/service";
import { getBusinessProfile, updateBusinessProfile } from "@/lib/services/business-profile";
import { getBusinessRules, updateBusinessRules } from "@/lib/services/business-rules";
import { getBusinessHours, updateBusinessHours } from "@/lib/services/business-hours";
import {
  getBusinessSupportCategories,
  updateBusinessSupportCategory,
} from "@/lib/services/support-categories";
import {
  getBusinessKnowledge,
  addBusinessKnowledge,
  deleteBusinessKnowledge,
} from "@/lib/services/business-knowledge";
import {
  getGmailAccountsForBusiness,
  updateGmailAccountSupportConfig,
} from "@/lib/services/gmail-account-config";
import { evaluateSupportDecision } from "@/lib/services/support-supervisor";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug") || "default-business";
    const defaultBiz = await getOrCreateDefaultBusiness(slug);

    if (!defaultBiz) {
      return NextResponse.json(
        {
          configured: false,
          message: "Supabase connection not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 200 }
      );
    }

    const businessId = defaultBiz.id;

    const [profile, rules, hours, categories, accounts, executions, knowledge] = await Promise.all([
      getBusinessProfile(businessId),
      getBusinessRules(businessId),
      getBusinessHours(businessId),
      getBusinessSupportCategories(businessId),
      getGmailAccountsForBusiness(businessId),
      getAutomationExecutions(businessId, 15),
      getBusinessKnowledge(businessId),
    ]);

    return NextResponse.json({
      configured: true,
      business: profile || defaultBiz,
      rules: rules || {},
      hours,
      categories,
      accounts,
      executions,
      knowledge,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load support backend status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, businessId, profile, rules, hours, category, accountConfig, document, docId, testEmail } = body;

    const targetBizId = businessId || (await getOrCreateDefaultBusiness())?.id;
    if (!targetBizId) {
      return NextResponse.json(
        { error: "Supabase not configured or business not found." },
        { status: 400 }
      );
    }

    // ── Update Business Profile ───────────────────────────────────────────────
    if (action === "UPDATE_PROFILE") {
      const result = await updateBusinessProfile(targetBizId, profile || {});
      return NextResponse.json(result);
    }

    // ── Update Business Rules & Policies ──────────────────────────────────────
    if (action === "UPDATE_RULES") {
      const result = await updateBusinessRules(targetBizId, rules || {});
      return NextResponse.json(result);
    }

    // ── Update Business Hours ─────────────────────────────────────────────────
    if (action === "UPDATE_HOURS") {
      if (!Array.isArray(hours)) {
        return NextResponse.json({ error: "Hours array is required" }, { status: 400 });
      }
      const result = await updateBusinessHours(targetBizId, hours);
      return NextResponse.json(result);
    }

    // ── Update Support Category Scope ─────────────────────────────────────────
    if (action === "UPDATE_CATEGORY") {
      if (!category?.category_slug) {
        return NextResponse.json({ error: "category_slug is required" }, { status: 400 });
      }
      const result = await updateBusinessSupportCategory(targetBizId, category.category_slug, {
        enabled: category.enabled,
        requires_human_review: category.requires_human_review,
        auto_reply: category.auto_reply,
      });
      return NextResponse.json(result);
    }

    // ── Update Gmail Account Config ───────────────────────────────────────────
    if (action === "UPDATE_GMAIL_ACCOUNT") {
      if (!accountConfig?.accountId) {
        return NextResponse.json({ error: "accountId is required" }, { status: 400 });
      }
      const result = await updateGmailAccountSupportConfig(accountConfig.accountId, targetBizId, {
        support_enabled: accountConfig.support_enabled,
        auto_reply_enabled: accountConfig.auto_reply_enabled,
        custom_instructions: accountConfig.custom_instructions,
        signature: accountConfig.signature,
      });
      return NextResponse.json(result);
    }

    // ── Add Knowledge Document ────────────────────────────────────────────────
    if (action === "ADD_KNOWLEDGE") {
      if (!document?.title || !document?.content) {
        return NextResponse.json(
          { error: "Title and content are required for knowledge document" },
          { status: 400 }
        );
      }
      const result = await addBusinessKnowledge(targetBizId, document);
      return NextResponse.json(result);
    }

    // ── Delete Knowledge Document ─────────────────────────────────────────────
    if (action === "DELETE_KNOWLEDGE") {
      if (!docId) {
        return NextResponse.json({ error: "docId is required" }, { status: 400 });
      }
      const result = await deleteBusinessKnowledge(targetBizId, docId);
      return NextResponse.json(result);
    }

    // ── Simulate Test Email ───────────────────────────────────────────────────
    if (action === "SIMULATE_TEST") {
      const activeBiz = (await getBusinessProfile(targetBizId)) || { id: targetBizId, name: "Business", slug: "default", contact_email: "support@example.com" };
      const activeRules = await getBusinessRules(targetBizId);
      const activeHours = await getBusinessHours(targetBizId);

      const testMsg = {
        id: `sim_${Date.now()}`,
        threadId: `thread_${Date.now()}`,
        sender: testEmail?.sender || "customer@example.com",
        recipient: testEmail?.recipient || "support@example.com",
        subject: testEmail?.subject || "Question about refund policy",
        bodyText: testEmail?.bodyText || "Hi, I purchased your software yesterday and I would like to know how refunds work?",
        bodyHtml: `<p>${testEmail?.bodyText || "Hi, I purchased your software yesterday and I would like to know how refunds work?"}</p>`,
        date: new Date().toISOString(),
      };

      const decision = await evaluateSupportDecision({
        email: testMsg,
        business: activeBiz as any,
        rules: activeRules,
        hours: activeHours,
        supabaseClient: getSupabaseServerClient(),
      });

      return NextResponse.json({
        success: true,
        simulation: {
          testEmail: testMsg,
          decision,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
