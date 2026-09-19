import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-server";
import { checkInputGuardrails } from "@/lib/ai-support/guardrails";
import { buildKnowledgeContext } from "@/lib/ai-support/knowledge-builder";
import { buildSystemPrompt } from "@/lib/ai-support/system-prompt";
import { generateSupportResponse } from "@/lib/ai-support/provider";
import type { ChatMessage } from "@/lib/ai-support/types";
import { getClientIp } from "@/lib/security/ip-utils";

// In-memory sliding-window rate limiter per IP
// 30 requests per minute per IP with periodic memory eviction
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
let lastEvictionTime = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Periodic eviction of expired entries every 2 minutes
  if (now - lastEvictionTime > 120000) {
    lastEvictionTime = now;
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  // Bound map size to prevent DOS on memory
  if (rateLimitMap.size > 10000) {
    rateLimitMap.clear();
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }

  if (entry.count >= 30) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const ip = getClientIp(req);

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMITED",
          message:
            "You are sending requests too quickly. Please pause for a moment before asking another question.",
        },
        { status: 429 }
      );
    }

    // 2. Parse & Validate Body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_JSON", message: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "INVALID_MESSAGES", message: "Messages array is required." },
        { status: 400 }
      );
    }

    // Guard conversation length (max 20 messages)
    if (messages.length > 20) {
      return NextResponse.json(
        {
          success: false,
          error: "CONVERSATION_TOO_LONG",
          message:
            "Conversation history is too long. Please clear the chat and start a fresh session.",
        },
        { status: 400 }
      );
    }

    // Sanitize message items and track total character length
    let totalLength = 0;
    const sanitizedMessages: ChatMessage[] = [];
    for (const msg of messages) {
      if (
        !msg ||
        typeof msg !== "object" ||
        typeof msg.content !== "string" ||
        !["user", "assistant"].includes(msg.role)
      ) {
        continue;
      }

      // Check max individual message length (1,500 chars)
      const content = msg.content.trim().slice(0, 1500);
      if (content.length > 0) {
        totalLength += content.length;
        sanitizedMessages.push({
          role: msg.role as "user" | "assistant",
          content,
        });
      }
    }

    // Guard total payload character size (max 8,000 characters)
    if (totalLength > 8000) {
      return NextResponse.json(
        {
          success: false,
          error: "PAYLOAD_TOO_LARGE",
          message:
            "Total conversation content is too large. Please clear chat history to continue.",
        },
        { status: 400 }
      );
    }

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: "EMPTY_MESSAGES", message: "No valid messages provided." },
        { status: 400 }
      );
    }

    // 3. Pre-screen latest user message with Guardrails
    const lastUserMessage = [...sanitizedMessages]
      .reverse()
      .find((m) => m.role === "user");

    if (lastUserMessage) {
      const guardrailResult = checkInputGuardrails(lastUserMessage.content);
      if (guardrailResult.blocked && guardrailResult.message) {
        // Immediately return refusal without calling external LLM
        return NextResponse.json({
          success: true,
          message: guardrailResult.message,
        });
      }
    }

    // 4. Resolve authenticated user context (if logged in)
    const currentUserId = await getCurrentUserId();

    // 5. Gather live database knowledge context & system prompt
    const searchQuery = lastUserMessage?.content || undefined;
    const context = await buildKnowledgeContext(currentUserId, searchQuery);
    const systemPrompt = buildSystemPrompt(context);

    const fullMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizedMessages,
    ];

    // 6. Invoke server-side AI provider
    const providerResult = await generateSupportResponse(fullMessages);

    return NextResponse.json(
      {
        success: providerResult.success,
        message: providerResult.message,
        error: providerResult.error,
      },
      { status: providerResult.statusCode || (providerResult.success ? 200 : 500) }
    );
  } catch (error: any) {
    console.error("[POST /api/ai-support/chat] Unexpected server error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message:
          "An unexpected server error occurred. Our team has been notified. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
