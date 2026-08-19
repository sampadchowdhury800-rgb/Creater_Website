"use client";

import React, { useState, useEffect, useRef } from "react";

export default function ConnectSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Reset form errors when modal closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
        setErrors({});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const message = formData.get("message") as string;
    const instagram = formData.get("instagram") as string;

    const newErrors: typeof errors = {};
    if (!name?.trim()) newErrors.name = "Name is required";
    if (!email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) newErrors.email = "Valid email is required";
    if (!message?.trim()) newErrors.message = "Message is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("name", name.trim());
      payload.append("email", email.trim());
      payload.append("message", message.trim());
      if (instagram?.trim()) payload.append("instagram", instagram.trim());
      payload.append("_captcha", "false");
      payload.append("_template", "table");
      payload.append("_subject", "New Contact Form Submission");
      payload.append("_next", "");

      const res = await fetch(
        "https://formsubmit.co/ajax/sampadchowdhury777@gmail.com",
        { method: "POST", body: payload, headers: { Accept: "application/json" } }
      );

      if (!res.ok) throw new Error("Server error");

      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => setIsOpen(false), 3000);
    } catch {
      setIsSubmitting(false);
      setErrors({ message: "Failed to send. Please try again." });
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  return (
    <div className="min-w-0 flex flex-col justify-center h-full items-start">
      <span className="font-label-caps text-[11px] font-bold tracking-widest text-[#33D6FF] uppercase mb-4 block">
        Connect
      </span>
      <h2 className="font-display-lg-mobile text-display-lg-mobile text-white mb-6">
        Connect With Me
      </h2>
      <p className="font-body-lg text-body-lg text-[#9BA6B2] mb-10 leading-relaxed max-w-lg">
        Have a question, business inquiry, collaboration idea, or just want to say
        hello? Send me a message and I&apos;ll get back to you as soon as possible.
      </p>

      <div>
        <button
          onClick={() => setIsOpen(true)}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-transparent rounded-2xl overflow-hidden hover:-translate-y-1"
          style={{ boxShadow: "0 10px 30px -10px rgba(51, 214, 255, 0.4)" }}
        >
          {/* Button Background Gradient & Glow */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-[#171B24] to-[#171B24] border border-[#33D6FF]/30 rounded-2xl transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-[#0f2d3d] group-hover:to-[#171B24] group-hover:border-[#33D6FF]/60" />
          <div className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(51,214,255,0.2)_0%,transparent_70%)] blur-md" />
          
          <span className="relative z-10 flex items-center gap-2 font-label-caps tracking-widest text-sm">
            Connect With Me
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </button>
      </div>

      {/* Modal Backdrop */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        style={{
          backgroundColor: "rgba(15, 17, 23, 0.85)",
          backdropFilter: isOpen ? "blur(8px)" : "blur(0px)",
        }}
        onClick={handleBackdropClick}
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          className={`relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[#171B24] border border-[#00FFFF]/12 rounded-[20px] shadow-[0_0_40px_rgba(51,214,255,0.1)] transition-all duration-300 ${
            isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-5 right-5 p-2 text-[#9BA6B2] hover:text-white hover:bg-white/5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#33D6FF]"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="p-8 sm:p-10">
            <div className="mb-8">
              <h3 id="modal-title" className="text-2xl sm:text-3xl font-bold text-[#F5F7FA] mb-2">
                Connect With Me
              </h3>
              <p className="text-sm text-[#9BA6B2]">
                Feel free to ask anything, discuss collaborations, report issues, or simply say hello.
              </p>
            </div>

            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-[#33D6FF]/10 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-[#33D6FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Message Sent!</h4>
                <p className="text-[#9BA6B2]">Thank you for reaching out. I&apos;ll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-[#F5F7FA] mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Your Name"
                    disabled={isSubmitting}
                    className={`w-full bg-[#0F1117] border ${
                      errors.name ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-[#33D6FF]"
                    } rounded-xl px-4 py-3 text-[#F5F7FA] placeholder-[#9BA6B2]/50 focus:outline-none focus:ring-1 focus:ring-${errors.name ? "red-500" : "[#33D6FF]"} transition-colors disabled:opacity-50`}
                  />
                  {errors.name && <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="instagram" className="block text-sm font-medium text-[#F5F7FA] mb-1.5">
                    Instagram Handle <span className="text-[#9BA6B2] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="instagram"
                    name="instagram"
                    placeholder="@yourhandle"
                    disabled={isSubmitting}
                    className="w-full bg-[#0F1117] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] placeholder-[#9BA6B2]/50 focus:outline-none focus:border-[#33D6FF] focus:ring-1 focus:ring-[#33D6FF] transition-colors disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#F5F7FA] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                    className={`w-full bg-[#0F1117] border ${
                      errors.email ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-[#33D6FF]"
                    } rounded-xl px-4 py-3 text-[#F5F7FA] placeholder-[#9BA6B2]/50 focus:outline-none focus:ring-1 focus:ring-${errors.email ? "red-500" : "[#33D6FF]"} transition-colors disabled:opacity-50`}
                  />
                  {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-[#F5F7FA] mb-1.5">
                    What would you like to ask?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Write your question, business inquiry, collaboration idea, feedback, or message here..."
                    disabled={isSubmitting}
                    className={`w-full bg-[#0F1117] border ${
                      errors.message ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-[#33D6FF]"
                    } rounded-xl px-4 py-3 text-[#F5F7FA] placeholder-[#9BA6B2]/50 focus:outline-none focus:ring-1 focus:ring-${errors.message ? "red-500" : "[#33D6FF]"} transition-colors resize-y min-h-[120px] disabled:opacity-50`}
                  />
                  {errors.message && <p className="mt-1.5 text-xs text-red-400">{errors.message}</p>}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#33D6FF] to-[#5B8CFF] px-6 py-4 text-sm font-bold text-[#0F1117] transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(51,214,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#33D6FF] focus:ring-offset-2 focus:ring-offset-[#171B24] disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed group"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <>
                          <svg className="w-5 h-5 animate-spin text-[#0F1117]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        "Send Message"
                      )}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
