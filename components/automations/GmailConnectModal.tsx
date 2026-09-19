"use client";

/**
 * components/automations/GmailConnectModal.tsx
 *
 * Modal for connecting customer's Gmail account via Gmail App Password + IMAP/SMTP.
 *
 * SECURITY INVARIANTS:
 * - The App Password exists ONLY in local React component state while entering.
 * - The App Password is NEVER saved in localStorage, sessionStorage, cookies, or URL params.
 * - The App Password is NEVER logged with console.* or included in error messages.
 * - The App Password state is cleared immediately on submit, close, cancel, or error.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

export interface GmailConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAutomationId: string;
  onSuccess: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GmailConnectModal({
  isOpen,
  onClose,
  userAutomationId,
  onSuccess,
}: GmailConnectModalProps) {
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Clean state helper (ensures App Password never remains in memory)
  const resetForm = useCallback(() => {
    setEmail("");
    setAppPassword("");
    setShowPassword(false);
    setErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, resetForm, onClose]);

  // Focus input and lock scroll on open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const cleanedPassword = appPassword.replace(/\s+/g, "");

    // Validation
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid Gmail address.");
      return;
    }

    if (!cleanedPassword || cleanedPassword.length < 8) {
      setErrorMessage(
        "Please enter your 16-character Gmail App Password (spaces will be automatically removed)."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/integrations/gmail/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          appPassword: cleanedPassword,
          userAutomationId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        // Clear password immediately on failure
        setAppPassword("");
        setErrorMessage(
          data.errorMessage ||
            data.error ||
            "Could not authenticate with Gmail. Verify your email and 16-character App Password."
        );
        setIsSubmitting(false);
        return;
      }

      // Success: clear password from state and notify parent
      resetForm();
      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch {
      // Clear password immediately on network failure
      setAppPassword("");
      setErrorMessage("Network error connecting to Gmail. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-connect-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-surface-container">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl border border-red-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="gmail-connect-modal-title"
                className="font-bold text-base text-slate-900 dark:text-white"
              >
                Connect Gmail Account
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct IMAP &amp; SMTP connection via Gmail App Password
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-container-high transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Instructions Banner */}
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-500/20 rounded-xl space-y-2 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-start gap-2 font-semibold">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>How to generate a Gmail App Password:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
              <li>Ensure <strong>2-Step Verification</strong> is enabled on your Google Account.</li>
              <li>Go to your Google Account App Passwords page.</li>
              <li>Create an app name (e.g. <em>&quot;Chowdhury Duo Support&quot;</em>).</li>
              <li>Copy the generated <strong>16-character code</strong> and paste it below.</li>
            </ol>
            <div className="pt-1">
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-[11px] text-blue-600 dark:text-cyan-400 hover:underline"
              >
                Open Google App Passwords
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="gmail-email-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Gmail Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="gmail-email-input"
                ref={emailInputRef}
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-container text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40 disabled:opacity-60 transition-all"
                autoComplete="email"
              />
            </div>
          </div>

          {/* App Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="gmail-password-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                16-Character App Password
              </label>
              <span className="text-[10px] text-slate-400">Never shared or displayed</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="gmail-password-input"
                type={showPassword ? "text" : "password"}
                required
                disabled={isSubmitting}
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="abcd efgh ijkl mnop"
                className="w-full pl-10 pr-10 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-container text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40 disabled:opacity-60 transition-all tracking-wider"
                autoComplete="new-password"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting || !appPassword}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Security Assurance Footer */}
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Encrypted at rest using AES-256-GCM vault security.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:text-black dark:hover:bg-primary/90 rounded-xl shadow-xs transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying connection with Gmail...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Connect Gmail</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
