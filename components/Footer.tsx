"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) return;

    setState("submitting");
    try {
      const payload = new FormData();
      payload.append("email", trimmed);
      payload.append("_captcha", "false");
      payload.append("_template", "table");
      payload.append("_subject", "New Newsletter Subscriber");

      const res = await fetch(
        "https://formsubmit.co/ajax/sampadchowdhury777@gmail.com",
        { method: "POST", body: payload, headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error("error");
      setState("success");
      setEmail("");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }, [email]);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {state === "success" ? (
        <p className="text-sm text-primary-fixed-dim dark:text-primary font-medium py-3">
          ✓ Subscribed! Thank you.
        </p>
      ) : (
        <div className="relative flex items-center border-b border-black/10 dark:border-outline-variant focus-within:border-primary-fixed-dim transition-colors">
          <input
            className="w-full bg-transparent focus:ring-0 focus:outline-none text-on-tertiary-fixed dark:text-on-surface py-3 pr-24 pl-0 placeholder:text-on-tertiary-fixed-variant/40"
            placeholder="Your Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state === "submitting"}
            required
          />
          <div className="absolute right-0 flex items-center gap-2">
            <span className="font-label-caps text-label-caps text-[10px] text-primary-fixed-dim tracking-widest uppercase">
              {state === "error" ? "Retry" : "Subscribe"}
            </span>
            <button
              type="submit"
              disabled={state === "submitting"}
              className="text-primary-fixed-dim hover:text-primary transition-colors disabled:opacity-50"
              aria-label="Subscribe to newsletter"
            >
              <span className="material-symbols-outlined">
                {state === "submitting" ? "hourglass_empty" : "send"}
              </span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export default function Footer() {
  return (
    <footer className="bg-white/80 dark:bg-surface-container-lowest w-full py-12 px-gutter border-t border-black/10 dark:border-outline-variant shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-colors">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
        {/* Brand */}
        <div>
          <div className="font-display-lg-mobile text-display-lg-mobile text-on-tertiary-fixed dark:text-on-surface font-bold tracking-tighter mb-4">
            Chowdhury Duo
          </div>
          <p className="font-body-md text-body-md text-on-tertiary-fixed-variant dark:text-on-surface-variant mb-6 pr-8 text-sm leading-relaxed">
            Full-Stack Web Development, Intelligent Business Workflow Automations, SaaS Architectures, and Digital Media founded by Sampad Chowdhury.
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-cyan-400">
            <a
              href="mailto:sampadchowdhury777@gmail.com"
              className="flex items-center gap-1.5 hover:text-cyan-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                alternate_email
              </span>
              sampadchowdhury777@gmail.com
            </a>
            <span className="flex items-center gap-1 text-gray-400">
              <span className="material-symbols-outlined text-[16px]">
                location_on
              </span>
              India
            </span>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h5 className="font-label-caps text-label-caps text-primary-fixed-dim dark:text-primary-fixed mb-6 uppercase text-xs">
              Navigation
            </h5>
            <ul className="space-y-3 font-body-md text-sm text-on-tertiary-fixed-variant dark:text-on-surface-variant">
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/about"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/services"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/projects"
                >
                  Projects &amp; Case Studies
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/resume"
                >
                  Founder Resume
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/automations"
                >
                  Automations Store
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-label-caps text-label-caps text-primary-fixed-dim dark:text-primary-fixed mb-6 uppercase text-xs">
              Profiles
            </h5>
            <ul className="space-y-3 font-body-md text-sm text-on-tertiary-fixed-variant dark:text-on-surface-variant">
              <li>
                <a
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="https://www.linkedin.com/in/sampad-chowdhury-321812317"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sampad on LinkedIn
                </a>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/bharti-shaw"
                >
                  Bharti Shaw Portfolio
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/news"
                >
                  Latest Updates
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary-fixed-dim dark:hover:text-secondary-fixed transition-colors"
                  href="/achievements"
                >
                  Achievements
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div>
          <h5 className="font-label-caps text-label-caps text-primary-fixed-dim dark:text-primary-fixed mb-6 uppercase text-xs">
            Newsletter
          </h5>
          <p className="font-body-md text-body-md text-on-tertiary-fixed-variant dark:text-on-surface-variant mb-4 text-xs">
            Get the latest updates on engineering releases, open-source tools, and automated workflows.
          </p>
          <NewsletterForm />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1440px] mx-auto mt-16 pt-8 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="font-label-caps text-label-caps text-on-tertiary-fixed-variant dark:text-on-surface-variant text-[10px]">
          © {new Date().getFullYear()} Chowdhury Duo. All Rights Reserved.
        </span>
        <div className="flex gap-8 font-label-caps text-label-caps text-[10px] text-on-tertiary-fixed-variant dark:text-on-surface-variant">
          <span>AI • AUTOMATION • FULL STACK</span>
          <span>BASED IN INDIA</span>
        </div>
      </div>
    </footer>
  );
}

