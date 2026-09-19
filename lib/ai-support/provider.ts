/**
 * Server-side AI Provider Client for Chowdhury Duo.
 *
 * Implements a universal, dependency-free HTTP client that communicates with
 * OpenAI-compatible chat completion APIs (OpenAI, Gemini OpenAI endpoint, Groq,
 * OpenRouter, Ollama, DeepSeek, etc.).
 *
 * All API calls are executed strictly server-side. Credentials never enter
 * client-side bundles.
 *
 * Free-Only Mode (AI_SUPPORT_FREE_ONLY):
 *   When enabled (the default), the provider validates the configured model
 *   against a known-free allowlist before making any API call. If the model
 *   is not guaranteed free, the request is rejected immediately — ensuring the
 *   system can never accidentally incur paid inference costs.
 */

import { env } from "@/lib/env";
import { siteConfig } from "@/lib/siteConfig";
import { sanitizeOutput } from "./guardrails";
import type { ChatMessage, AIProviderResponse } from "./types";

// ---------------------------------------------------------------------------
// Free-model enforcement
// ---------------------------------------------------------------------------

/**
 * Patterns that match model IDs guaranteed to be free on OpenRouter.
 * Rules (intentionally minimal — do not expand without careful review):
 *   1. Exact match for "openrouter/free" — OpenRouter's free-routing alias.
 *   2. Any model ending in ":free" — OpenRouter's convention for pinned free-tier models.
 *
 * The list is intentionally open on ":free" so new free models are accepted
 * without code changes, while still blocking every known paid model ID.
 * There is deliberately NO paid-model fallback; a rejection is always hard.
 */
const KNOWN_FREE_PATTERNS: RegExp[] = [
  /^openrouter\/free$/i,   // "openrouter/free" — the canonical free-routing alias
  /:free$/i,               // e.g. meta-llama/llama-3.1-8b-instruct:free
];

/**
 * Returns true when the model ID is recognised as a free-tier OpenRouter model.
 * Exported so that the test suite can verify the allowlist directly.
 *
 * SECURITY: when this returns false and AI_SUPPORT_FREE_ONLY=true the provider
 * MUST hard-reject the request. It MUST NOT fall back to another model.
 */
export function validateFreeModel(model: string): boolean {
  const trimmed = model.trim().toLowerCase();
  if (trimmed.includes("/auto:") || trimmed.startsWith("auto:")) return false;
  return KNOWN_FREE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// ---------------------------------------------------------------------------

export interface ProviderOptions {
  mockResponse?: string;
}

export async function generateSupportResponse(
  messages: ChatMessage[],
  options?: ProviderOptions
): Promise<AIProviderResponse> {
  // Deterministic Mock mode for offline testing and CI
  if (options?.mockResponse || process.env.AI_SUPPORT_MOCK_MODE === "true") {
    const mockText =
      options?.mockResponse ||
      "This is a verified test response from the Chowdhury Duo support engine.";
    return {
      success: true,
      message: sanitizeOutput(mockText),
      statusCode: 200,
    };
  }

  const apiKey = env.AI_SUPPORT_API_KEY;
  const model = env.AI_SUPPORT_MODEL;
  const customBaseUrl = env.AI_SUPPORT_BASE_URL;
  const freeOnly = env.AI_SUPPORT_FREE_ONLY;

  // ── Free-only enforcement ────────────────────────────────────────────────
  // This guard runs BEFORE the API key check so that a misconfigured paid model
  // is caught even when no key is present, making configuration errors obvious.
  if (freeOnly && !validateFreeModel(model)) {
    console.error(
      `[AI Support Provider] FREE_ONLY violation: model "${model}" is not on the free-tier allowlist. ` +
      `Set AI_SUPPORT_FREE_ONLY=false to override, or choose a :free-suffixed OpenRouter model.`
    );
    return {
      success: false,
      error: "FREE_ONLY_VIOLATION",
      message:
        "The AI Support Assistant is configured to use free-tier models only. " +
        `Please contact ${siteConfig.email} if you believe this is an error.`,
      statusCode: 500,
    };
  }

  // Graceful offline fallback if key is not configured
  if (!apiKey || apiKey.trim() === "") {
    return {
      success: true,
      message: `Our AI Support Assistant is currently offline while maintenance is underway. Please contact our support team directly at ${siteConfig.email} for immediate assistance.`,
      statusCode: 200,
    };
  }

  // ── Determine completions endpoint ────────────────────────────────────────
  // Priority: AI_SUPPORT_BASE_URL > OpenRouter (default) > Gemini special-case
  let endpoint: string;
  if (customBaseUrl && customBaseUrl.trim() !== "") {
    const cleanBase = customBaseUrl.trim().replace(/\/+$/, "");
    endpoint = cleanBase.endsWith("/chat/completions")
      ? cleanBase
      : `${cleanBase}/chat/completions`;
  } else if (model.toLowerCase().includes("gemini")) {
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  } else {
    // Default to OpenRouter — the canonical provider for this assistant
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
  }

  // ── Build request headers ────────────────────────────────────────────────
  // OpenRouter requires HTTP-Referer + X-Title for responsible-use attribution.
  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://chowdhuryduo.in";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        "HTTP-Referer": siteOrigin,
        "X-Title": "Chowdhury Duo AI Support",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2, // Low temperature for factual precision
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[AI Support Provider] API call failed with HTTP status ${response.status}`
      );
      // Sanitize: Do not expose raw vendor error to user
      return {
        success: false,
        error: "AI_PROVIDER_ERROR",
        message:
          "I'm having a brief communication hiccup reaching our support engine. Please try your question again in a moment, or reach out to us at " +
          siteConfig.email,
        statusCode: response.status,
      };
    }

    const data = await response.json();
    const assistantContent =
      data?.choices?.[0]?.message?.content ||
      "I was unable to generate a response. Please rephrase your question.";

    // Run through security sanitization
    const sanitized = sanitizeOutput(assistantContent);

    return {
      success: true,
      message: sanitized,
      statusCode: 200,
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return {
        success: false,
        error: "TIMEOUT",
        message:
          "The support assistant request timed out. Please try again with a shorter question.",
        statusCode: 504,
      };
    }

    console.error("[AI Support Provider] Unexpected network/fetch error:", error.message || error);

    return {
      success: false,
      error: "INTERNAL_ERROR",
      message:
        "An unexpected error occurred while processing your request. Please try again shortly.",
      statusCode: 500,
    };
  }
}
