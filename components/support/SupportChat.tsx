"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  Trash2,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Mail,
  CheckCircle2,
  HelpCircle,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import SupportSuggestions from "./SupportSuggestions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTION_CHIPS = [
  { label: "Best automations", prompt: "What are the best automations available on Chowdhury Duo?" },
  { label: "Best for earning", prompt: "Which automation is best for business revenue and saving operational time?" },
  { label: "Pricing & Plans", prompt: "Explain your live pricing plans, trials, and maintenance terms." },
  { label: "How to get started", prompt: "How do I get started with buying and running an automation?" },
  { label: "Help me choose", prompt: "Help me choose the right automation for my specific business needs." },
  { label: "Troubleshoot", prompt: "My automation is having an issue or failing to run. How do I fix it?" },
];

const INITIAL_GREETING =
  "Hello! I am Chowdhury Duo's official AI customer support assistant. I can help you explore our automation marketplace, understand features and workflows, compare live pricing plans, and configure or troubleshoot your automations.\n\nWhat can I assist you with today?";

/**
 * Keywords that indicate technical troubleshooting or requests for human escalation.
 */
const ESCALATION_TRIGGER_KEYWORDS = [
  "fail",
  "failed",
  "failing",
  "error",
  "broken",
  "not working",
  "doesn't work",
  "bug",
  "issue",
  "troubleshoot",
  "trouble",
  "stuck",
  "developer",
  "human",
  "support team",
  "escalate",
  "contact human",
  "talk to someone",
  "agent",
];

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const content = isBullet ? trimmed.slice(2) : trimmed;
        const tokens = parseMarkdownLine(content);

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-primary text-xs mt-1 shrink-0">•</span>
              <span>{tokens}</span>
            </div>
          );
        }

        return <p key={idx}>{tokens}</p>;
      })}
    </div>
  );
}

function parseMarkdownLine(line: string): React.ReactNode[] {
  const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`)/g;
  const parts = line.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const [, label, href] = match;
        const isInternal = href.startsWith("/");
        if (isInternal) {
          return (
            <Link
              key={i}
              href={href}
              className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5"
            >
              <span>{label}</span>
            </Link>
          );
        }
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5"
          >
            <span>{label}</span>
            <ExternalLink size={10} className="inline" />
          </a>
        );
      }
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 font-mono text-xs text-primary font-bold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "assistant",
      content: INITIAL_GREETING,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escalation state
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState<{
    success: boolean;
    referenceId?: string;
    message?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, messages, scrollToBottom, escalationResult]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Determine if the conversation warrants showing the Developer Escalation button
  const shouldShowEscalation = React.useMemo(() => {
    if (messages.length < 2) return false;
    const allUserText = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.toLowerCase())
      .join(" ");

    return ESCALATION_TRIGGER_KEYWORDS.some((kw) => allUserText.includes(kw));
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setError(null);
    setIsLoading(true);

    try {
      const conversationPayload = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai-support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationPayload }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to reach AI support.");
      }

      const assistantMessage: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalateToDeveloper = async () => {
    if (isEscalating) return;

    setIsEscalating(true);
    setEscalationResult(null);

    try {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user")?.content || "Technical inquiry";

      const payload = {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        originalQuestion: lastUserMessage,
      };

      const res = await fetch("/api/ai-support/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            "Sorry, we couldn't send the developer request right now. Please try again later."
        );
      }

      setEscalationResult({
        success: true,
        referenceId: data.referenceId,
        message: data.message,
      });
    } catch (err: any) {
      setEscalationResult({
        success: false,
        message:
          err.message ||
          "Sorry, we couldn't send the developer request right now. Please try again later.",
      });
    } finally {
      setIsEscalating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content: INITIAL_GREETING,
        timestamp: new Date(),
      },
    ]);
    setError(null);
    setEscalationResult(null);
  };

  const handleSuggestionPrompt = (prompt: string) => {
    setIsOpen(true);
    handleSendMessage(prompt);
  };

  return (
    <>
      {/* Smart Visitor Suggestions Popup (anchored near trigger button) */}
      <SupportSuggestions
        isChatOpen={isOpen}
        onSelectPrompt={handleSuggestionPrompt}
      />

      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Customer Support"
            className="group relative flex items-center gap-3 px-4 py-3.5 rounded-full bg-slate-900/90 dark:bg-black/90 text-white border border-primary/40 hover:border-primary shadow-[0_0_25px_rgba(0,219,238,0.3)] hover:shadow-[0_0_35px_rgba(0,219,238,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
          >
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary"></span>
            </span>

            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary">
              <Sparkles size={18} className="animate-pulse" />
            </div>

            <div className="text-left pr-1">
              <div className="text-xs font-bold tracking-wide uppercase text-primary">
                AI Support
              </div>
              <div className="text-[11px] text-gray-300 hidden sm:block">
                Ask about automations & pricing
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Expandable Support Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="AI Customer Support Window"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[430px] h-[600px] max-h-[88vh] rounded-2xl bg-white dark:bg-[#0c1017] text-slate-900 dark:text-gray-100 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-300 animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-100 dark:bg-[#111622] border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Chowdhury Duo Support
                  </h3>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  Authoritative AI • Live DB Knowledge
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Clear Chat History"
                aria-label="Clear chat history"
                className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Chat"
                aria-label="Close chat"
                className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm scroll-smooth">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                      <Bot size={14} />
                    </div>
                  )}

                  <div
                    className={`max-w-[84%] px-3.5 py-2.5 rounded-2xl shadow-sm ${
                      isUser
                        ? "bg-primary text-black font-medium rounded-tr-none shadow-[0_0_15px_rgba(0,219,238,0.2)]"
                        : "bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-gray-200 rounded-tl-none border border-slate-200/80 dark:border-white/10"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <FormattedMessage text={msg.content} />
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-white/10 text-slate-700 dark:text-gray-300 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 items-center text-slate-500 dark:text-gray-400 text-xs pl-1 py-1">
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <Loader2 size={14} className="animate-spin" />
                </div>
                <div className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 flex items-center gap-2">
                  <span>Checking authoritative database...</span>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>
                  <button
                    onClick={() => handleSendMessage()}
                    className="mt-1 font-bold underline hover:no-underline cursor-pointer"
                  >
                    Retry Question
                  </button>
                </div>
              </div>
            )}

            {/* Developer Escalation Action Banner (When troubleshooting or requested) */}
            {shouldShowEscalation && !escalationResult?.success && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-500/30 flex flex-col gap-2 transition-all animate-in fade-in">
                <div className="flex items-start gap-2 text-xs text-sky-800 dark:text-sky-300">
                  <Wrench size={15} className="shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  <div>
                    <span className="font-semibold">Need direct developer assistance?</span>
                    <p className="text-[11px] text-sky-600/90 dark:text-sky-400/90 mt-0.5">
                      Our engineering team can investigate your workspace configuration and logs directly.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleEscalateToDeveloper}
                  disabled={isEscalating}
                  aria-label="Send this query to the developer"
                  className="w-full mt-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isEscalating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sending report to developer...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={13} />
                      <span>Send this query to the developer</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Escalation Success or Error Card */}
            {escalationResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in ${
                  escalationResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                }`}
              >
                {escalationResult.success ? (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{escalationResult.message}</p>
                  {escalationResult.referenceId && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Reference ID:
                      </span>
                      <code className="px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 font-mono font-bold text-xs">
                        {escalationResult.referenceId}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Question Chips (Always visible or toggled for rapid access) */}
          <div className="px-3 py-2 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/70 dark:bg-black/20 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {QUICK_QUESTION_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(chip.prompt)}
                  disabled={isLoading}
                  className="whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-white/5 hover:bg-primary/15 hover:text-primary border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-50 dark:bg-[#111622] border-t border-slate-200 dark:border-white/10 shrink-0">
            <div className="relative flex items-end gap-2 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about automations, plans, setup, or troubleshooting..."
                rows={1}
                maxLength={1500}
                className="w-full bg-transparent resize-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 max-h-24 min-h-[24px]"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send message"
                className="p-1.5 rounded-lg bg-primary text-black disabled:opacity-30 disabled:bg-slate-300 dark:disabled:bg-white/10 dark:disabled:text-gray-500 transition-all cursor-pointer shrink-0"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
            <div className="mt-1.5 px-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500">
              <span>Domain-restricted to Chowdhury Duo. Off-topic questions will be refused.</span>
              <span>{inputValue.length}/1500</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
