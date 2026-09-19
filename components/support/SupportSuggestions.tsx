"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X, HelpCircle, ArrowRight } from "lucide-react";

interface SupportSuggestionsProps {
  isChatOpen: boolean;
  onSelectPrompt: (prompt: string) => void;
}

const ALL_VISITOR_QUESTIONS = [
  "What are the best automations?",
  "Which automation can help me earn more money?",
  "Which automation is best for my business?",
  "What automation should I buy?",
  "How much do the automations cost?",
  "How do I get started?",
  "Show me the most useful automations.",
  "Which automation is best for generating leads?",
  "Which automation can save me the most time?",
  "What can Chowdhury Duo automate for me?",
];

const DISMISS_STORAGE_KEY = "cd_support_suggestions_dismissed_at";
const COOLDOWN_HOURS = 12;

export default function SupportSuggestions({
  isChatOpen,
  onSelectPrompt,
}: SupportSuggestionsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  useEffect(() => {
    // Check if dismissed within cooldown period
    try {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const elapsedHours =
          (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
        if (elapsedHours < COOLDOWN_HOURS) {
          return;
        }
      }
    } catch {
      // LocalStorage unavailable (e.g. private mode)
    }

    // Pick 3 rotating questions pseudo-randomly based on current hour/day
    const seed = Math.floor(Date.now() / (1000 * 60 * 60)); // shifts each hour
    const shuffled = [...ALL_VISITOR_QUESTIONS].sort((a, b) => {
      const hashA = (a.length + seed) % 7;
      const hashB = (b.length + seed) % 7;
      return hashA - hashB;
    });

    setSelectedQuestions(shuffled.slice(0, 3));

    // Delay popup slightly after page mount so it feels polite, not spammy
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  };

  const handlePromptClick = (prompt: string) => {
    setIsVisible(false);
    onSelectPrompt(prompt);
  };

  // If chat is open or popup not visible or no questions, hide completely
  if (isChatOpen || !isVisible || selectedQuestions.length === 0) {
    return null;
  }

  return (
    <div
      role="complementary"
      aria-label="Visitor Support Suggestions"
      className="fixed bottom-24 right-6 z-40 w-[300px] sm:w-[340px] rounded-2xl bg-white/95 dark:bg-[#0c1017]/95 border border-slate-200 dark:border-primary/25 shadow-2xl backdrop-blur-xl p-3.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
            <Sparkles size={13} className="text-primary" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-gray-200 tracking-tight">
            How can we help you today?
          </span>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss suggestions"
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Suggested Questions List */}
      <div className="space-y-1.5">
        {selectedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handlePromptClick(q)}
            className="group w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-primary/10 dark:hover:bg-primary/15 border border-slate-200/70 dark:border-white/5 hover:border-primary/30 transition-all flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary cursor-pointer"
          >
            <span className="flex items-center gap-1.5 line-clamp-2">
              <HelpCircle size={13} className="shrink-0 text-slate-400 group-hover:text-primary" />
              <span>{q}</span>
            </span>
            <ArrowRight
              size={12}
              className="shrink-0 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-primary"
            />
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div className="mt-2.5 pt-2 text-[10px] text-slate-400 dark:text-gray-500 flex items-center justify-between border-t border-slate-100 dark:border-white/5">
        <span>Chowdhury Duo Support AI</span>
        <span>Click to ask instantly</span>
      </div>
    </div>
  );
}
