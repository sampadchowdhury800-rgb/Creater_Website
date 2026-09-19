/**
 * supabase/functions/_shared/ai-service.ts
 *
 * Universal AI service for email classification, tenant knowledge retrieval, and grounded response generation.
 * Compatible with OpenAI, Google Gemini, OpenRouter, Groq, and any OpenAI-compatible API.
 */

import {
  ParsedEmailMessage,
  BusinessRulesRecord,
  ClassificationResult,
  KnowledgeDocumentMatch,
  GenerationResult,
} from "./types.ts";

function getEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== "undefined" && process?.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Universal OpenAI-compatible chat completion caller.
 */
async function callChatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    responseFormatJson?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const apiKey =
    getEnv("AI_API_KEY") ||
    getEnv("AI_SUPPORT_API_KEY") ||
    getEnv("OPENAI_API_KEY") ||
    getEnv("GEMINI_API_KEY") ||
    "";
  const model = getEnv("AI_MODEL") || getEnv("AI_SUPPORT_MODEL") || "gpt-4o-mini";
  const baseUrl = getEnv("AI_BASE_URL") || getEnv("AI_SUPPORT_BASE_URL") || "https://api.openai.com/v1";

  // Mock / offline fallback if no API key is provided
  if (!apiKey || apiKey === "mock" || getEnv("AI_MOCK_MODE") === "true") {
    if (options.responseFormatJson) {
      return JSON.stringify({
        isSupport: true,
        classification: "CUSTOMER_SUPPORT",
        confidence: 0.95,
        reasoning: "Mock automated classification detected customer service inquiry.",
        replyHtml: "<p>Thank you for reaching out to our support team. We have received your request and will assist you shortly.</p>",
        replyText: "Thank you for reaching out to our support team. We have received your request and will assist you shortly.",
      });
    }
    return "Thank you for contacting our customer support team. We have received your request and are reviewing it in accordance with our support policies.";
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
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
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI completion failed (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0]?.message?.content;
  if (!choice) {
    throw new Error("Empty completion response from AI provider.");
  }

  return choice;
}

/**
 * Classifies an incoming email into customer support vs sales vs spam vs other.
 */
export async function classifyEmailIntent(
  email: ParsedEmailMessage,
  rules?: BusinessRulesRecord | null
): Promise<ClassificationResult> {
  const lowerSubj = email.subject.toLowerCase();
  const lowerBody = email.bodyText.toLowerCase();

  // Fast token-saving heuristic pre-filter for automated newsletters and spam
  if (
    lowerSubj.includes("unsubscribe") ||
    lowerSubj.includes("newsletter") ||
    lowerSubj.includes("weekly digest") ||
    lowerBody.includes("click here to unsubscribe")
  ) {
    return {
      isSupport: false,
      classification: "NEWSLETTER",
      confidence: 0.92,
      reasoning: "Pre-classification identified automated newsletter or broadcast digest.",
    };
  }

  const systemPrompt = `You are an enterprise email intent classifier for a multi-tenant customer support platform.
Your task is to analyze the incoming email and determine whether it requires automated or human customer support assistance.

Possible classifications:
- "CUSTOMER_SUPPORT": Inquiries about products/services, troubleshooting, order tracking, bugs, account issues, billing, cancellation, returns.
- "SALES_INQUIRY": Enterprise sales, partnership requests, bulk pricing quotes.
- "SPAM": Unsolicited bulk marketing, phishing, irrelevant advertisements.
- "NEWSLETTER": Automated digests, system notifications, noreply receipts.
- "OTHER": Personal emails, out-of-office autoreplies, miscellaneous correspondence.

${rules?.company_description ? `Company context: ${rules.company_description}` : ""}
${rules?.products_services ? `Products/services offered: ${rules.products_services}` : ""}

OUTPUT FORMAT:
Respond ONLY with a valid JSON object:
{
  "isSupport": boolean,
  "classification": "CUSTOMER_SUPPORT" | "SALES_INQUIRY" | "SPAM" | "NEWSLETTER" | "OTHER",
  "confidence": number between 0.0 and 1.0,
  "reasoning": "brief explanation"
}`;

  const userPrompt = `EMAIL DETAILS:
From: ${email.sender}
Subject: ${email.subject}
Body:
${email.bodyText.slice(0, 3000)}`;

  try {
    const raw = await callChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormatJson: true, temperature: 0.1 }
    );

    const parsed = JSON.parse(raw);
    return {
      isSupport: Boolean(parsed.isSupport),
      classification: parsed.classification || "CUSTOMER_SUPPORT",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      reasoning: parsed.reasoning || "Classified by AI model.",
    };
  } catch (err: any) {
    console.error("Classification error:", err);
    // Safe deterministic heuristic fallback
    const lowerSubj = email.subject.toLowerCase();
    const lowerBody = email.bodyText.toLowerCase();

    if (
      lowerSubj.includes("unsubscribe") ||
      lowerSubj.includes("newsletter") ||
      lowerSubj.includes("digest")
    ) {
      return {
        isSupport: false,
        classification: "NEWSLETTER",
        confidence: 0.7,
        reasoning: "Heuristic classification based on subject.",
      };
    }

    return {
      isSupport: true,
      classification: "CUSTOMER_SUPPORT",
      confidence: 0.6,
      reasoning: `Fallback classification due to: ${err.message}`,
    };
  }
}

/**
 * Retrieves relevant business knowledge documents from Supabase.
 */
export async function retrieveBusinessKnowledge(
  supabase: any,
  businessId: string,
  queryText: string
): Promise<KnowledgeDocumentMatch[]> {
  try {
    // 1. Try full-text search RPC first
    const { data: textMatches, error: textErr } = await supabase.rpc(
      "search_knowledge_text",
      {
        query_text: queryText,
        match_count: 5,
        filter_business_id: businessId,
      }
    );

    if (!textErr && textMatches && textMatches.length > 0) {
      return textMatches;
    }

    // 2. Direct query fallback
    const { data: directDocs } = await supabase
      .from("knowledge_documents")
      .select("id, title, content, category")
      .eq("business_id", businessId)
      .eq("status", "READY")
      .limit(5);

    return directDocs || [];
  } catch (err) {
    console.error("Knowledge retrieval error:", err);
    return [];
  }
}

/**
 * Generates an intelligent, grounded customer support response.
 */
export async function generateGroundedReply(options: {
  email: ParsedEmailMessage;
  rules?: BusinessRulesRecord | null;
  knowledgeDocs: KnowledgeDocumentMatch[];
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<GenerationResult> {
  const { email, rules, knowledgeDocs, conversationHistory = [] } = options;

  const knowledgeContext = knowledgeDocs.length > 0
    ? knowledgeDocs.map((doc, idx) => `[Doc ${idx + 1}: ${doc.title}]\n${doc.content}`).join("\n\n")
    : "No custom knowledge documents available.";

  const systemPrompt = `You are the official AI Customer Support Agent for this business.
You are communicating directly with a customer over email.

=== BUSINESS RULES & IDENTITY ===
Tone: ${rules?.tone || "professional, polite, and helpful"}
${rules?.company_description ? `About the Company: ${rules.company_description}` : ""}
${rules?.products_services ? `Products & Services: ${rules.products_services}` : ""}
${rules?.support_policies ? `Support Policies: ${rules.support_policies}` : ""}
${rules?.refund_return_rules ? `Refund & Return Rules: ${rules.refund_return_rules}` : ""}
${rules?.contact_info ? `Contact Info / Escalation: ${rules.contact_info}` : ""}
${rules?.working_hours ? `Working Hours: ${rules.working_hours}` : ""}
${rules?.custom_instructions ? `Special Instructions: ${rules.custom_instructions}` : ""}
${rules?.prohibited_responses ? `PROHIBITED STATEMENTS (NEVER SAY THESE): ${rules.prohibited_responses}` : ""}

=== VERIFIED KNOWLEDGE BASE ===
${knowledgeContext}

=== INSTRUCTIONS & CONSTRAINTS ===
1. Be direct, clear, and empathetic.
2. Rely strictly on the verified knowledge base and business policies above.
3. NEVER fabricate prices, policy exceptions, coupons, or features not mentioned above.
4. If you do not know the answer or the query requires manual intervention, politely inform the customer that their request has been escalated to a team member (${rules?.contact_info || "support"}).
5. Generate an email reply formatted cleanly in HTML with paragraph (<p>) tags, clean bullet points (<ul><li>) if relevant, and a polite sign-off.
6. Do NOT include placeholder tokens like [Your Name] or [Company Name] — use the actual company details provided or sign off as "Customer Support Team".

OUTPUT FORMAT:
Respond ONLY with a JSON object:
{
  "replyHtml": "HTML string of the email body",
  "replyText": "Plaintext version of the reply",
  "reasoning": "Explanation of how the rules and knowledge were applied",
  "confidence": number between 0.0 and 1.0
}`;

  const userPrompt = `CUSTOMER EMAIL:
From: ${email.sender}
Subject: ${email.subject}
Message Body:
${email.bodyText}

${conversationHistory.length > 0 ? `\nPREVIOUS MESSAGES IN THREAD:\n` + conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n") : ""}`;

  try {
    const raw = await callChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormatJson: true, temperature: 0.3 }
    );

    const parsed = JSON.parse(raw);
    return {
      replyHtml: parsed.replyHtml || `<p>${parsed.replyText}</p>`,
      replyText: parsed.replyText || "Thank you for contacting us. We have received your message.",
      reasoning: parsed.reasoning || "Generated by AI support engine.",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
    };
  } catch (err: any) {
    console.error("Response generation failed:", err);
    return {
      replyHtml: `<p>Hello,</p><p>Thank you for reaching out to us. We have received your inquiry regarding <strong>${email.subject}</strong>.</p><p>Our customer support team is reviewing your request and will follow up with you directly.</p><p>Best regards,<br>Customer Support Team</p>`,
      replyText: `Hello,\n\nThank you for reaching out to us. We have received your inquiry regarding "${email.subject}". Our customer support team is reviewing your request and will follow up with you directly.\n\nBest regards,\nCustomer Support Team`,
      reasoning: `Deterministic fallback triggered: ${err.message}`,
      confidence: 0.5,
    };
  }
}
