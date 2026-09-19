/**
 * lib/ai/support-engine.ts
 *
 * Universal AI Customer Support Engine for Next.js / Vercel.
 * Performs email intent classification, knowledge retrieval (pgvector / full-text),
 * and grounded response generation.
 *
 * Compatible with OpenRouter, OpenAI, Google Gemini, Groq, and offline mock modes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailClassification =
  | "CUSTOMER_SUPPORT"
  | "SALES_INQUIRY"
  | "SPAM"
  | "NEWSLETTER"
  | "OTHER";

export interface ParsedEmailMessage {
  id: string;
  threadId: string;
  sender: string;
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  messageIdHeader?: string | null;
  inReplyToHeader?: string | null;
  referencesHeader?: string | null;
  date?: string;
  headers?: Record<string, string>;
}

export interface BusinessRulesRecord {
  id?: string;
  business_id?: string;
  company_description?: string | null;
  products_services?: string | null;
  support_policies?: string | null;
  refund_return_rules?: string | null;
  tone?: string;
  prohibited_responses?: string | null;
  escalation_rules?: string | null;
  contact_info?: string | null;
  working_hours?: string | null;
  custom_instructions?: string | null;
  auto_reply_enabled?: boolean;
  confidence_threshold?: number;
  slack_webhook_url?: string | null;
  slack_channel_id?: string | null;
  refund_policy?: string | null;
  return_policy?: string | null;
  cancellation_policy?: string | null;
  shipping_policy?: string | null;
  warranty_policy?: string | null;
  payment_policy?: string | null;
  product_service_info?: string | null;
  greeting_preference?: string | null;
  sign_off_preference?: string | null;
  mention_business_name?: boolean;
  mention_support_team?: boolean;
  custom_writing_instructions?: string | null;
  unknown_question_behavior?: "NO_REPLY" | "FALLBACK_RESPONSE" | "NOTIFY_TEAM" | "HUMAN_REVIEW";
  fallback_message?: string | null;
  after_hours_behavior?: "REPLY_NORMALLY" | "AFTER_HOURS_MESSAGE" | "DO_NOT_REPLY" | "ESCALATE";
  respond_outside_hours?: boolean;
  after_hours_message?: string | null;
  max_reply_length?: number;
  complaints_require_human?: boolean;
  refunds_require_human?: boolean;
}

export interface ClassificationResult {
  isSupport: boolean;
  classification: EmailClassification;
  categorySlug?: string;
  confidence: number;
  reasoning: string;
}

export interface KnowledgeDocumentMatch {
  id: string;
  title: string;
  content: string;
  category?: string;
  similarity?: number;
  rank?: number;
}

export interface GenerationResult {
  replyHtml: string;
  replyText: string;
  reasoning: string;
  confidence: number;
}

export interface SlackNotificationPayload {
  webhookUrl?: string | null;
  channelId?: string | null;
  botToken?: string | null;
  businessName: string;
  sender: string;
  subject: string;
  classification: string;
  confidence: number;
  actionTaken: "AUTO_REPLIED" | "ESCALATED" | "SKIPPED" | "FAILED";
  summaryOrReasoning?: string;
  threadUrl?: string;
}

/**
 * Error thrown when GMAIL_SUPPORT_AI_API_KEY is not configured.
 * Gmail Support must fail safely rather than falling back to the chatbot's credentials.
 */
export class GmailSupportAiNotConfiguredError extends Error {
  constructor() {
    super(
      "Gmail Support AI is not configured: GMAIL_SUPPORT_AI_API_KEY is missing or empty. " +
      "Set this variable in your environment. Do not reuse the website chatbot key."
    );
    this.name = "GmailSupportAiNotConfiguredError";
  }
}

function extractJsonFromText<T = any>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // continue
      }
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error(`Could not extract JSON from text: ${trimmed.slice(0, 120)}`);
  }
}

/**
 * Dedicated OpenAI-compatible chat completion caller for Gmail Customer Support.
 *
 * SECURITY CONTRACT:
 * - Reads ONLY GMAIL_SUPPORT_AI_API_KEY — never AI_SUPPORT_API_KEY or any other key.
 * - If GMAIL_SUPPORT_AI_API_KEY is absent, throws GmailSupportAiNotConfiguredError.
 * - The caller (classifyEmailIntent / generateGroundedReply) must catch this error
 *   and escalate safely rather than sending an AI response.
 * - NEVER falls back to: AI_API_KEY, AI_SUPPORT_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY.
 */
async function callGmailSupportAI(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    responseFormatJson?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  // ── Mock mode for offline testing and CI ─────────────────────────────────
  if (process.env.GMAIL_SUPPORT_AI_MOCK_MODE === "true") {
    if (options.responseFormatJson) {
      const userText = messages.find((m) => m.role === "user")?.content?.toLowerCase() || "";
      let mockCat = "customer_support";
      if (userText.includes("refund") || userText.includes("money back")) mockCat = "refunds";
      else if (userText.includes("complaint") || userText.includes("terrible") || userText.includes("horrible")) mockCat = "complaints";
      else if (userText.includes("return")) mockCat = "returns";
      else if (userText.includes("cancel")) mockCat = "cancellations";
      else if (userText.includes("hour") || userText.includes("timing") || userText.includes("schedule")) mockCat = "business_hours";
      else if (userText.includes("ship") || userText.includes("delivery") || userText.includes("tracking")) mockCat = "shipping_questions";
      else if (userText.includes("price") || userText.includes("cost") || userText.includes("fee")) mockCat = "pricing_questions";

      return JSON.stringify({
        isSupport: true,
        classification: "CUSTOMER_SUPPORT",
        categorySlug: mockCat,
        confidence: 0.95,
        reasoning: `Mock automated classification detected ${mockCat} inquiry.`,
        replyHtml:
          "<p>Thank you for reaching out to our support team. We have received your request and will assist you shortly.</p>",
        replyText:
          "Thank you for reaching out to our support team. We have received your request and will assist you shortly.",
      });
    }
    return "Thank you for contacting our customer support team. We have received your request and are reviewing it in accordance with our support policies.";
  }

  // ── Dedicated key — NO fallback to chatbot or generic keys ───────────────
  const apiKey = process.env.GMAIL_SUPPORT_AI_API_KEY ?? "";
  if (!apiKey || apiKey.trim() === "" || apiKey === "PASTE_GMAIL_SUPPORT_AI_API_KEY_HERE") {
    throw new GmailSupportAiNotConfiguredError();
  }

  const model = process.env.GMAIL_SUPPORT_AI_MODEL || "openrouter/free";
  const baseUrl = (process.env.GMAIL_SUPPORT_AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://chowdhuryduo.in";

  const bodyPayload: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1000,
  };

  if (options.responseFormatJson) {
    bodyPayload.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
      "HTTP-Referer": siteOrigin,
      "X-Title": "Chowdhury Duo Gmail Support",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail Support AI completion failed (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const message = json.choices?.[0]?.message;
  let choice = message?.content;
  if (!choice && message?.reasoning) {
    choice = message.reasoning;
  }
  if (!choice && json.choices?.[0]?.text) {
    choice = json.choices[0].text;
  }

  if (!choice || typeof choice !== "string" || choice.trim() === "") {
    if (options.responseFormatJson) {
      return callGmailSupportAI(messages, { ...options, responseFormatJson: false });
    }
    throw new Error("Empty completion response from Gmail Support AI provider.");
  }

  return choice;
}

/**
 * Classifies an incoming email into customer support vs sales vs spam vs other,
 * and extracts the fine-grained support category slug.
 */
export async function classifyEmailIntent(
  email: ParsedEmailMessage,
  rules?: BusinessRulesRecord | null
): Promise<ClassificationResult> {
  const lowerSubject = (email.subject || "").toLowerCase();
  const lowerSender = (email.sender || "").toLowerCase();
  const lowerBody = (email.bodyText || "").toLowerCase();
  const fullContent = `${lowerSubject} ${lowerBody}`;

  // Heuristic category extraction
  let detectedCategory = "customer_support";
  if (fullContent.includes("refund") || fullContent.includes("money back") || fullContent.includes("chargeback")) {
    detectedCategory = "refunds";
  } else if (fullContent.includes("return") || fullContent.includes("send back") || fullContent.includes("return label")) {
    detectedCategory = "returns";
  } else if (fullContent.includes("cancel") || fullContent.includes("stop subscription")) {
    detectedCategory = "cancellations";
  } else if (fullContent.includes("ship") || fullContent.includes("delivery") || fullContent.includes("tracking") || fullContent.includes("transit") || fullContent.includes("courier")) {
    detectedCategory = fullContent.includes("tracking") || fullContent.includes("delivered") ? "delivery_questions" : "shipping_questions";
  } else if (fullContent.includes("hour") || fullContent.includes("timing") || fullContent.includes("schedule") || fullContent.includes("open") || fullContent.includes("close")) {
    detectedCategory = "business_hours";
  } else if (fullContent.includes("price") || fullContent.includes("pricing") || fullContent.includes("cost") || fullContent.includes("quote") || fullContent.includes("discount")) {
    detectedCategory = "pricing_questions";
  } else if (fullContent.includes("warranty") || fullContent.includes("guarantee") || fullContent.includes("repair")) {
    detectedCategory = "warranty";
  } else if (fullContent.includes("complaint") || fullContent.includes("terrible") || fullContent.includes("unacceptable") || fullContent.includes("horrible") || fullContent.includes("disappointed")) {
    detectedCategory = "complaints";
  } else if (fullContent.includes("order") || fullContent.includes("invoice") || fullContent.includes("receipt")) {
    detectedCategory = "order_questions";
  }

  // Fast heuristic detection for obvious automated messages
  if (
    lowerSender.includes("no-reply") ||
    lowerSender.includes("noreply") ||
    lowerSender.includes("donotreply") ||
    lowerSubject.includes("unsubscribe") ||
    lowerBody.includes("click here to unsubscribe")
  ) {
    return {
      isSupport: false,
      classification: "NEWSLETTER",
      categorySlug: "newsletter",
      confidence: 0.98,
      reasoning: "Automated newsletter or no-reply notification headers detected.",
    };
  }

  const systemPrompt = `You are an accurate email triage supervisor for customer support.
Analyze the incoming email and categorize it into:
- classification: CUSTOMER_SUPPORT | SALES_INQUIRY | NEWSLETTER | SPAM | OTHER
- categorySlug: choose the most accurate slug from:
  [customer_support, general_questions, business_hours, product_questions, service_questions, pricing_questions, order_questions, shipping_questions, delivery_questions, returns, refunds, cancellations, warranty, complaints, product_availability, appointment_questions, booking_questions, account_questions, other]

Note: Any inquiry or message sent by an individual customer or prospect (including greetings, questions about working hours, services, or test messages to support) MUST be classified as CUSTOMER_SUPPORT with isSupport: true.

Respond strictly in JSON:
{
  "isSupport": boolean,
  "classification": "CUSTOMER_SUPPORT" | "SALES_INQUIRY" | "NEWSLETTER" | "SPAM" | "OTHER",
  "categorySlug": string,
  "confidence": number between 0.0 and 1.0,
  "reasoning": "brief 1-sentence rationale"
}`;

  const userContent = `Subject: ${email.subject}
From: ${email.sender}
Body:
${email.bodyText?.slice(0, 2000) || "(empty body)"}`;

  try {
    const raw = await callGmailSupportAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { responseFormatJson: true, temperature: 0.1 }
    );

    const parsed = extractJsonFromText<{
      isSupport?: boolean;
      classification?: "CUSTOMER_SUPPORT" | "SALES_INQUIRY" | "NEWSLETTER" | "SPAM" | "OTHER";
      categorySlug?: string;
      confidence?: number;
      reasoning?: string;
    }>(raw);

    const isSupport =
      Boolean(parsed.isSupport) ||
      parsed.classification === "CUSTOMER_SUPPORT" ||
      parsed.classification === "SALES_INQUIRY";

    const effectiveCategory =
      detectedCategory !== "customer_support"
        ? detectedCategory
        : (parsed.categorySlug || "customer_support");

    return {
      isSupport,
      classification: parsed.classification || (isSupport ? "CUSTOMER_SUPPORT" : "OTHER"),
      categorySlug: effectiveCategory,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
      reasoning: parsed.reasoning || "Triage classification complete.",
    };
  } catch (err: any) {
    // Propagate configuration errors — do not silently fall back
    if (err?.name === "GmailSupportAiNotConfiguredError") {
      throw err;
    }
    console.warn("AI classification fallback triggered:", err?.message);
    return {
      isSupport: true,
      classification: "CUSTOMER_SUPPORT",
      categorySlug: detectedCategory,
      confidence: 0.7,
      reasoning: "Fallback rule-based classification due to model response parse.",
    };
  }
}

/**
 * Retrieves relevant company policies, FAQs, and product knowledge from Supabase.
 */
export async function retrieveBusinessKnowledge(
  email: ParsedEmailMessage,
  businessId: string,
  supabase?: SupabaseClient | null
): Promise<KnowledgeDocumentMatch[]> {
  if (!supabase || !businessId) {
    return [];
  }

  const queryText = `${email.subject} ${email.bodyText.slice(0, 300)}`.trim();

  try {
    // 1. Full-text search via RPC
    const { data: textMatches, error: rpcErr } = await supabase.rpc(
      "search_knowledge_text",
      {
        p_business_id: businessId,
        p_query: queryText,
        p_limit: 3,
      }
    );

    if (!rpcErr && textMatches && textMatches.length > 0) {
      return textMatches.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        rank: doc.rank,
      }));
    }

    // 2. Direct fallback query
    const { data: directDocs } = await supabase
      .from("knowledge_documents")
      .select("id, title, content, category")
      .eq("business_id", businessId)
      .limit(3);

    return (directDocs || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
    }));
  } catch (e: any) {
    console.warn("Knowledge retrieval failed (non-fatal):", e?.message);
    return [];
  }
}

/**
 * Generates an empathetic, accurate, grounded email response adhering strictly to business policies.
 * Never invents prices, policies, or commitments.
 */
export async function generateGroundedReply(
  email: ParsedEmailMessage,
  rules: BusinessRulesRecord | null | undefined,
  knowledge: KnowledgeDocumentMatch[]
): Promise<GenerationResult> {
  const tone = rules?.tone || "professional, empathetic, and concise";
  const generalPolicies = rules?.support_policies || "Standard customer support terms apply.";
  const refundPolicy = rules?.refund_policy || rules?.refund_return_rules || "Contact support team for refund eligibility.";
  const returnPolicy = rules?.return_policy || rules?.refund_return_rules || "Contact support team for returns.";
  const cancellationPolicy = rules?.cancellation_policy || "Contact support team for cancellations.";
  const shippingPolicy = rules?.shipping_policy || "Contact support team for shipping information.";
  const warrantyPolicy = rules?.warranty_policy || "Standard warranty applies where specified.";
  const paymentPolicy = rules?.payment_policy || "Accepted standard payment methods.";
  const productServiceInfo = rules?.product_service_info || rules?.products_services || "";
  const workingHours = rules?.working_hours || "Monday to Friday 9:00 AM - 6:00 PM IST";
  const prohibitions = rules?.prohibited_responses || "Do not promise unreleased features or fabricate policies.";
  const customInstructions = rules?.custom_instructions || rules?.custom_writing_instructions || "";
  const greetingPref = rules?.greeting_preference || "Friendly greeting with customer name if available";
  const signOffPref = rules?.sign_off_preference || "Warm professional closing with team sign-off";

  const knowledgeContext =
    knowledge.length > 0
      ? knowledge.map((k) => `[Document: ${k.title}]\n${k.content}`).join("\n\n")
      : "No specific knowledge base articles found for this topic.";

  const systemPrompt = `You are an elite customer support representative responding to customer emails.

STRICT SOURCE OF TRUTH HIERARCHY:
1. Business Policies & Rules (HIGHEST PRIORITY - ALWAYS WINS)
2. Approved Knowledge Base Documents
3. Email Context
4. Model General Knowledge (LOWEST PRIORITY - NEVER OVERRIDE BUSINESS POLICIES)

BUSINESS POLICIES & INFORMATION:
- Tone: ${tone}
- Greeting Style: ${greetingPref}
- Sign-off Style: ${signOffPref}
- Business Hours: ${workingHours}
- General Support Policies: ${generalPolicies}
- Refund Policy: ${refundPolicy}
- Return Policy: ${returnPolicy}
- Cancellation Policy: ${cancellationPolicy}
- Shipping & Delivery: ${shippingPolicy}
- Warranty Policy: ${warrantyPolicy}
- Payment Methods & Policies: ${paymentPolicy}
${productServiceInfo ? `- Products & Services: ${productServiceInfo}` : ""}
${prohibitions ? `- Prohibitions: ${prohibitions}` : ""}
${customInstructions ? `- Custom Instructions: ${customInstructions}` : ""}

GROUNDING RULES:
- Answer ONLY using the documented policies and knowledge context above.
- NEVER fabricate prices, delivery dates, refund approval, or policy terms not stated above.
- NEVER claim you processed a refund, transaction, or shipped a package yourself.
- If the customer asks for information that is NOT covered above, do NOT invent an answer. Clearly explain that you have forwarded the request to a specialist who will follow up directly.

Provide your response in JSON:
{
  "replyHtml": "<p>Formatted HTML response body to be sent to the customer</p>",
  "replyText": "Plaintext version of the response",
  "reasoning": "Brief rationale behind the response and sources used",
  "confidence": number between 0.0 and 1.0
}`;

  const userMessage = `Customer Name / Email: ${email.sender}
Subject: ${email.subject}
Message:
${email.bodyText}

Relevant Knowledge Base Context:
${knowledgeContext}`;

  try {
    const raw = await callGmailSupportAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { responseFormatJson: true, temperature: 0.3 }
    );

    const parsed = extractJsonFromText<{
      replyHtml?: string;
      replyText?: string;
      reasoning?: string;
      confidence?: number;
    }>(raw);
    return {
      replyHtml: parsed.replyHtml || `<p>${parsed.replyText || "Thank you for contacting support."}</p>`,
      replyText: parsed.replyText || "Thank you for contacting support.",
      reasoning: parsed.reasoning || "Generated grounded customer support reply.",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
    };
  } catch (err: any) {
    // Propagate configuration errors — do not silently fall back to chatbot credentials
    if (err?.name === "GmailSupportAiNotConfiguredError") {
      throw err;
    }
    console.error("AI reply generation failed:", err);
    return {
      replyHtml:
        "<p>Thank you for reaching out to us. We have received your message and our support team is reviewing it. We will reply shortly.</p>",
      replyText:
        "Thank you for reaching out to us. We have received your message and our support team is reviewing it. We will reply shortly.",
      reasoning: "Fallback response due to completion service failure.",
      confidence: 0.5,
    };
  }
}

/**
 * Sends a Slack notification for team awareness.
 */
export async function sendSlackNotification(payload: SlackNotificationPayload): Promise<boolean> {
  const webhookUrl =
    payload.webhookUrl ||
    process.env["SLACK_WEBHOOK_URL"] ||
    process.env["SLACK_SUPPORT_WEBHOOK_URL"];

  const botToken = payload.botToken || process.env["SLACK_BOT_TOKEN"];
  const channelId = payload.channelId || process.env["SLACK_CHANNEL_ID"];

  const actionEmoji =
    payload.actionTaken === "AUTO_REPLIED"
      ? "🤖 ✅"
      : payload.actionTaken === "ESCALATED"
        ? "⚠️ 🙋"
        : payload.actionTaken === "FAILED"
          ? "❌"
          : "ℹ️";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${actionEmoji} Gmail Support: ${payload.actionTaken}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Business:*\n${payload.businessName}` },
        { type: "mrkdwn", text: `*Customer:*\n${payload.sender}` },
        { type: "mrkdwn", text: `*Subject:*\n${payload.subject}` },
        {
          type: "mrkdwn",
          text: `*Intent:*\n${payload.classification} (${Math.round(payload.confidence * 100)}%)`,
        },
      ],
    },
  ];

  if (payload.summaryOrReasoning) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Details:*\n>${payload.summaryOrReasoning.replace(/\n/g, "\n>")}`,
      },
    } as any);
  }

  try {
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      return res.ok;
    }

    if (botToken && channelId) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: channelId, blocks }),
      });
      return res.ok;
    }

    return true;
  } catch (err) {
    console.error("Failed to send Slack notification:", err);
    return false;
  }
}
