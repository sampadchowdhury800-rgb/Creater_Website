"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Bot,
  ShieldAlert,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Settings,
  RefreshCw,
  Sliders,
  History,
  Info,
  Clock,
  Building,
  FileText,
  ListFilter,
  Users,
  Trash2,
} from "lucide-react";

export default function GmailSupportDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "profile" | "hours" | "policies" | "voice" | "categories" | "knowledge" | "accounts" | "executions" | "simulator"
  >("overview");

  // Profile state
  const [profile, setProfile] = useState({
    name: "",
    brand_name: "",
    business_type: "",
    description: "",
    website: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    timezone: "UTC",
    currency: "USD",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Rules state
  const [rules, setRules] = useState({
    company_description: "",
    products_services: "",
    support_policies: "",
    refund_return_rules: "",
    refund_policy: "",
    return_policy: "",
    cancellation_policy: "",
    warranty_policy: "",
    shipping_policy: "",
    order_policy: "",
    payment_policy: "",
    product_service_info: "",
    tone: "professional, empathetic, and concise",
    greeting_preference: "Friendly greeting with customer name if available",
    sign_off_preference: "Warm professional closing with team sign-off",
    mention_business_name: true,
    mention_support_team: true,
    custom_writing_instructions: "",
    unknown_question_behavior: "FALLBACK_RESPONSE",
    fallback_message: "Thank you for reaching out to us. We have received your message and our team will review it shortly.",
    after_hours_behavior: "REPLY_NORMALLY",
    after_hours_message: "Thank you for contacting us. Our office is currently closed. We will respond during our next business hours.",
    auto_reply_enabled: true,
    confidence_threshold: 0.65,
    max_reply_length: 600,
    complaints_require_human: false,
    refunds_require_human: false,
    slack_webhook_url: "",
  });
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSuccess, setRulesSuccess] = useState(false);

  // Business hours state
  const [hours, setHours] = useState<any[]>([]);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<any[]>([]);
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);

  // Knowledge state
  const [newDoc, setNewDoc] = useState({ title: "", content: "", category: "general" });
  const [savingDoc, setSavingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Simulator state
  const [simEmail, setSimEmail] = useState({
    sender: "customer@example.com",
    subject: "How do I request a refund?",
    bodyText: "Hello, I purchased your service 3 days ago and was wondering what your refund policy is and how I can submit a request?",
  });
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support-backend");
      const json = await res.json();
      setData(json);

      if (json.business) {
        setProfile({
          name: json.business.name || "",
          brand_name: json.business.brand_name || "",
          business_type: json.business.business_type || "",
          description: json.business.description || "",
          website: json.business.website || "",
          contact_email: json.business.contact_email || "",
          contact_phone: json.business.contact_phone || "",
          address: json.business.address || "",
          city: json.business.city || "",
          state: json.business.state || "",
          country: json.business.country || "",
          timezone: json.business.timezone || "UTC",
          currency: json.business.currency || "USD",
        });
      }

      if (json.rules) {
        setRules({
          company_description: json.rules.company_description || "",
          products_services: json.rules.products_services || "",
          support_policies: json.rules.support_policies || "",
          refund_return_rules: json.rules.refund_return_rules || "",
          refund_policy: json.rules.refund_policy || json.rules.refund_return_rules || "",
          return_policy: json.rules.return_policy || json.rules.refund_return_rules || "",
          cancellation_policy: json.rules.cancellation_policy || "",
          warranty_policy: json.rules.warranty_policy || "",
          shipping_policy: json.rules.shipping_policy || "",
          order_policy: json.rules.order_policy || "",
          payment_policy: json.rules.payment_policy || "",
          product_service_info: json.rules.product_service_info || json.rules.products_services || "",
          tone: json.rules.tone || "professional, empathetic, and concise",
          greeting_preference: json.rules.greeting_preference || "Friendly greeting with customer name if available",
          sign_off_preference: json.rules.sign_off_preference || "Warm professional closing with team sign-off",
          mention_business_name: json.rules.mention_business_name ?? true,
          mention_support_team: json.rules.mention_support_team ?? true,
          custom_writing_instructions: json.rules.custom_writing_instructions || json.rules.custom_instructions || "",
          unknown_question_behavior: json.rules.unknown_question_behavior || "FALLBACK_RESPONSE",
          fallback_message: json.rules.fallback_message || "Thank you for reaching out to us. We have received your message and our team will review it shortly.",
          after_hours_behavior: json.rules.after_hours_behavior || "REPLY_NORMALLY",
          after_hours_message: json.rules.after_hours_message || "Thank you for contacting us. Our office is currently closed. We will respond during our next business hours.",
          auto_reply_enabled: json.rules.auto_reply_enabled ?? true,
          confidence_threshold: json.rules.confidence_threshold ?? 0.65,
          max_reply_length: json.rules.max_reply_length ?? 600,
          complaints_require_human: json.rules.complaints_require_human ?? false,
          refunds_require_human: json.rules.refunds_require_human ?? false,
          slack_webhook_url: json.rules.slack_webhook_url || "",
        });
      }

      if (json.hours) {
        setHours(json.hours);
      }

      if (json.categories) {
        setCategories(json.categories);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_PROFILE", profile }),
      });
      const json = await res.json();
      if (json.success) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const res = await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_RULES", rules }),
      });
      const json = await res.json();
      if (json.success) {
        setRulesSuccess(true);
        setTimeout(() => setRulesSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRules(false);
    }
  };

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHours(true);
    try {
      const res = await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_HOURS", hours }),
      });
      const json = await res.json();
      if (json.success) {
        setHoursSuccess(true);
        setTimeout(() => setHoursSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingHours(false);
    }
  };

  const handleToggleCategory = async (catSlug: string, field: "enabled" | "requires_human_review" | "auto_reply", currentVal: boolean) => {
    setUpdatingCategory(catSlug);
    const updated = categories.map((c) => (c.category_slug === catSlug ? { ...c, [field]: !currentVal } : c));
    setCategories(updated);
    try {
      const target = updated.find((c) => c.category_slug === catSlug);
      await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_CATEGORY",
          category: {
            category_slug: catSlug,
            enabled: target.enabled,
            requires_human_review: target.requires_human_review,
            auto_reply: target.auto_reply,
          },
        }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingCategory(null);
    }
  };

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title || !newDoc.content) return;
    setSavingDoc(true);
    try {
      const res = await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADD_KNOWLEDGE", document: newDoc }),
      });
      const json = await res.json();
      if (json.success) {
        setNewDoc({ title: "", content: "", category: "general" });
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    setDeletingDocId(id);
    try {
      await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_KNOWLEDGE", docId: id }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await fetch("/api/support-backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_TEST", testEmail: simEmail }),
      });
      const json = await res.json();
      setSimResult(json.simulation);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-blue-500" />
        <span>Loading business support configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Gmail Customer Support Automation</h1>
              <p className="text-sm text-zinc-400">
                Tenant: {data?.business?.name} ({data?.business?.slug || "default"})
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="flex items-center space-x-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Production Active</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto space-x-1 pb-1">
        {[
          { id: "overview", label: "Overview", icon: Info },
          { id: "profile", label: "Business Profile", icon: Building },
          { id: "hours", label: "Business Hours", icon: Clock },
          { id: "policies", label: "Policies", icon: FileText },
          { id: "voice", label: "Brand Voice & AI", icon: Sliders },
          { id: "categories", label: "Support Scope", icon: ListFilter },
          { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
          { id: "accounts", label: "Gmail Mailboxes", icon: Users },
          { id: "executions", label: "Audit Executions", icon: History },
          { id: "simulator", label: "AI Simulator", icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-white border-b-2 border-blue-500"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Mailboxes</span>
              <p className="text-2xl font-bold text-white mt-1">{data?.accounts?.length || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">Connected IMAP/SMTP</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Support Scope</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {categories.filter((c) => c.enabled).length} / {categories.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Categories handled</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Knowledge Base</span>
              <p className="text-2xl font-bold text-white mt-1">{data?.knowledge?.length || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">Grounded articles</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Polling Cycle</span>
              <p className="text-2xl font-bold text-blue-400 mt-1">Every 1 min</p>
              <p className="text-xs text-zinc-500 mt-1">pg_cron + pg_net</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Active Configuration Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg space-y-2">
                <span className="text-xs font-medium text-zinc-400 uppercase">Brand Profile</span>
                <p className="text-white font-medium">{profile.brand_name || profile.name || "Default Brand"}</p>
                <p className="text-xs text-zinc-400">{profile.contact_email || "No contact email"}</p>
                <p className="text-xs text-zinc-500">Timezone: {profile.timezone} | Currency: {profile.currency}</p>
              </div>
              <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg space-y-2">
                <span className="text-xs font-medium text-zinc-400 uppercase">Supervisor Settings</span>
                <p className="text-white font-medium">Tone: {rules.tone}</p>
                <p className="text-xs text-zinc-400">Unknown Question: {rules.unknown_question_behavior}</p>
                <p className="text-xs text-zinc-500">Outside Hours: {rules.after_hours_behavior}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESS PROFILE */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Business Profile</h2>
              <p className="text-sm text-zinc-400">General business information provided to the AI for support grounding.</p>
            </div>
            {profileSuccess && (
              <span className="text-xs text-emerald-400 flex items-center bg-emerald-500/10 px-3 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Profile saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Business Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Brand Name</label>
              <input
                type="text"
                value={profile.brand_name}
                onChange={(e) => setProfile({ ...profile, brand_name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Business Type / Category</label>
              <input
                type="text"
                value={profile.business_type}
                onChange={(e) => setProfile({ ...profile, business_type: e.target.value })}
                placeholder="e.g. E-commerce, SaaS, Professional Services"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Website URL</label>
              <input
                type="text"
                value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Contact Email</label>
              <input
                type="email"
                value={profile.contact_email}
                onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Contact Phone</label>
              <input
                type="text"
                value={profile.contact_phone}
                onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Timezone</label>
              <input
                type="text"
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                placeholder="e.g. Asia/Kolkata, America/New_York, UTC"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Currency</label>
              <input
                type="text"
                value={profile.currency}
                onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                placeholder="e.g. USD, INR, EUR"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Business Description</label>
            <textarea
              rows={3}
              value={profile.description}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              placeholder="Brief description of what your business does..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Address</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">City / State</label>
              <input
                type="text"
                value={`${profile.city}${profile.state ? `, ${profile.state}` : ""}`}
                onChange={(e) => {
                  const [c, s] = e.target.value.split(",");
                  setProfile({ ...profile, city: (c || "").trim(), state: (s || "").trim() });
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Country</label>
              <input
                type="text"
                value={profile.country}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {savingProfile ? "Saving..." : "Save Business Profile"}
          </button>
        </form>
      )}

      {/* TAB 3: BUSINESS HOURS */}
      {activeTab === "hours" && (
        <form onSubmit={handleSaveHours} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Weekly Business Hours</h2>
              <p className="text-sm text-zinc-400">
                Operating hours per day in timezone: <span className="text-blue-400 font-medium">{profile.timezone}</span>
              </p>
            </div>
            {hoursSuccess && (
              <span className="text-xs text-emerald-400 flex items-center bg-emerald-500/10 px-3 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Hours saved
              </span>
            )}
          </div>

          <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
            {DAY_NAMES.map((dayName, idx) => {
              const dayRecord = hours.find((h) => h.day_of_week === idx) || {
                day_of_week: idx,
                open_time: "09:00",
                close_time: "18:00",
                is_closed: idx === 0 || idx === 6,
              };

              return (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950/60">
                  <div className="w-32">
                    <span className="font-medium text-white text-sm">{dayName}</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={dayRecord.is_closed}
                        onChange={(e) => {
                          const updated = [...hours];
                          const matchIdx = updated.findIndex((h) => h.day_of_week === idx);
                          if (matchIdx >= 0) {
                            updated[matchIdx].is_closed = e.target.checked;
                          } else {
                            updated.push({ ...dayRecord, is_closed: e.target.checked });
                          }
                          setHours(updated);
                        }}
                        className="rounded border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span>Closed</span>
                    </label>

                    {!dayRecord.is_closed ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={dayRecord.open_time}
                          onChange={(e) => {
                            const updated = [...hours];
                            const matchIdx = updated.findIndex((h) => h.day_of_week === idx);
                            if (matchIdx >= 0) updated[matchIdx].open_time = e.target.value;
                            else updated.push({ ...dayRecord, open_time: e.target.value });
                            setHours(updated);
                          }}
                          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                        />
                        <span className="text-zinc-500 text-xs">to</span>
                        <input
                          type="time"
                          value={dayRecord.close_time}
                          onChange={(e) => {
                            const updated = [...hours];
                            const matchIdx = updated.findIndex((h) => h.day_of_week === idx);
                            if (matchIdx >= 0) updated[matchIdx].close_time = e.target.value;
                            else updated.push({ ...dayRecord, close_time: e.target.value });
                            setHours(updated);
                          }}
                          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No business hours</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={savingHours}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {savingHours ? "Saving..." : "Save Business Hours"}
          </button>
        </form>
      )}

      {/* TAB 4: POLICIES */}
      {activeTab === "policies" && (
        <form onSubmit={handleSaveRules} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Business Policies & Rules</h2>
              <p className="text-sm text-zinc-400">
                The AI is strictly grounded on these policies and will never fabricate terms.
              </p>
            </div>
            {rulesSuccess && (
              <span className="text-xs text-emerald-400 flex items-center bg-emerald-500/10 px-3 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Policies saved
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Refund Policy</label>
              <textarea
                rows={3}
                value={rules.refund_policy}
                onChange={(e) => setRules({ ...rules, refund_policy: e.target.value })}
                placeholder="e.g. 14-day money-back guarantee for all digital orders..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Return Policy</label>
              <textarea
                rows={3}
                value={rules.return_policy}
                onChange={(e) => setRules({ ...rules, return_policy: e.target.value })}
                placeholder="e.g. Returns accepted within 30 days in original condition..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Cancellation Policy</label>
              <textarea
                rows={2}
                value={rules.cancellation_policy}
                onChange={(e) => setRules({ ...rules, cancellation_policy: e.target.value })}
                placeholder="e.g. Subscriptions can be cancelled at any time before next billing cycle..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Shipping & Delivery Policy</label>
              <textarea
                rows={3}
                value={rules.shipping_policy}
                onChange={(e) => setRules({ ...rules, shipping_policy: e.target.value })}
                placeholder="e.g. Standard delivery takes 3-5 business days. Free shipping over $50..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Warranty & Repairs</label>
              <textarea
                rows={2}
                value={rules.warranty_policy}
                onChange={(e) => setRules({ ...rules, warranty_policy: e.target.value })}
                placeholder="e.g. 1-year manufacturer warranty against hardware defects..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Payment Policy</label>
              <textarea
                rows={2}
                value={rules.payment_policy}
                onChange={(e) => setRules({ ...rules, payment_policy: e.target.value })}
                placeholder="e.g. Accepted payment methods: Visa, MasterCard, UPI, NetBanking..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Product & Service Information</label>
              <textarea
                rows={3}
                value={rules.product_service_info}
                onChange={(e) => setRules({ ...rules, product_service_info: e.target.value })}
                placeholder="List official product names, scopes, and documented feature tiers..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingRules}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {savingRules ? "Saving..." : "Save Policies"}
          </button>
        </form>
      )}

      {/* TAB 5: BRAND VOICE & AI */}
      {activeTab === "voice" && (
        <form onSubmit={handleSaveRules} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Brand Voice, Tone & AI Guardrails</h2>
              <p className="text-sm text-zinc-400">Configure how the AI communicates and responds to unknown queries.</p>
            </div>
            {rulesSuccess && (
              <span className="text-xs text-emerald-400 flex items-center bg-emerald-500/10 px-3 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Settings saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Tone of Voice</label>
              <input
                type="text"
                value={rules.tone}
                onChange={(e) => setRules({ ...rules, tone: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Unknown Question Behavior</label>
              <select
                value={rules.unknown_question_behavior}
                onChange={(e) => setRules({ ...rules, unknown_question_behavior: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="FALLBACK_RESPONSE">Send safe fallback response</option>
                <option value="HUMAN_REVIEW">Mark for human review (no auto-reply)</option>
                <option value="NO_REPLY">Do not reply automatically</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">After-Hours Behavior</label>
              <select
                value={rules.after_hours_behavior}
                onChange={(e) => setRules({ ...rules, after_hours_behavior: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="REPLY_NORMALLY">Reply normally using policies</option>
                <option value="AFTER_HOURS_MESSAGE">Send after-hours notice</option>
                <option value="DO_NOT_REPLY">Do not reply outside hours</option>
                <option value="ESCALATE">Mark for human review</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Confidence Threshold (0.0 to 1.0)</label>
              <input
                type="number"
                step="0.05"
                min="0.4"
                max="1.0"
                value={rules.confidence_threshold}
                onChange={(e) => setRules({ ...rules, confidence_threshold: parseFloat(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Safe Fallback Message</label>
            <textarea
              rows={2}
              value={rules.fallback_message}
              onChange={(e) => setRules({ ...rules, fallback_message: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">After-Hours Message</label>
            <textarea
              rows={2}
              value={rules.after_hours_message}
              onChange={(e) => setRules({ ...rules, after_hours_message: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Greeting Style</label>
              <input
                type="text"
                value={rules.greeting_preference}
                onChange={(e) => setRules({ ...rules, greeting_preference: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Sign-off Style</label>
              <input
                type="text"
                value={rules.sign_off_preference}
                onChange={(e) => setRules({ ...rules, sign_off_preference: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Human Escalation Triggers</h4>
            <div className="flex flex-col sm:flex-row gap-6 text-sm">
              <label className="flex items-center space-x-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={rules.complaints_require_human}
                  onChange={(e) => setRules({ ...rules, complaints_require_human: e.target.checked })}
                  className="rounded border-zinc-700 text-blue-600 focus:ring-0"
                />
                <span>Customer complaints always require human review</span>
              </label>
              <label className="flex items-center space-x-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={rules.refunds_require_human}
                  onChange={(e) => setRules({ ...rules, refunds_require_human: e.target.checked })}
                  className="rounded border-zinc-700 text-blue-600 focus:ring-0"
                />
                <span>Refund requests always require human review</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingRules}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {savingRules ? "Saving..." : "Save Brand Voice & AI Settings"}
          </button>
        </form>
      )}

      {/* TAB 6: SUPPORT CATEGORIES */}
      {activeTab === "categories" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Support Scope & Category Controls</h2>
            <p className="text-sm text-zinc-400">
              Control what customer email types the AI is allowed to handle automatically.
            </p>
          </div>

          <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
            <div className="grid grid-cols-12 px-4 py-3 bg-zinc-950 text-xs font-semibold text-zinc-400 uppercase">
              <div className="col-span-5">Category</div>
              <div className="col-span-3 text-center">Handle Automatically</div>
              <div className="col-span-2 text-center">Human Review</div>
              <div className="col-span-2 text-center">Auto-Reply</div>
            </div>

            {categories.map((cat) => (
              <div key={cat.category_slug} className="grid grid-cols-12 px-4 py-3 items-center text-sm bg-zinc-950/40">
                <div className="col-span-5">
                  <span className="font-medium text-white">{cat.category?.name || cat.category_slug}</span>
                  <p className="text-xs text-zinc-500">{cat.category?.description || ""}</p>
                </div>
                <div className="col-span-3 flex justify-center">
                  <input
                    type="checkbox"
                    checked={cat.enabled}
                    disabled={updatingCategory === cat.category_slug}
                    onChange={() => handleToggleCategory(cat.category_slug, "enabled", cat.enabled)}
                    className="rounded border-zinc-700 text-blue-600 focus:ring-0"
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <input
                    type="checkbox"
                    checked={cat.requires_human_review}
                    disabled={updatingCategory === cat.category_slug}
                    onChange={() => handleToggleCategory(cat.category_slug, "requires_human_review", cat.requires_human_review)}
                    className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <input
                    type="checkbox"
                    checked={cat.auto_reply}
                    disabled={updatingCategory === cat.category_slug}
                    onChange={() => handleToggleCategory(cat.category_slug, "auto_reply", cat.auto_reply)}
                    className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: KNOWLEDGE BASE */}
      {activeTab === "knowledge" && (
        <div className="space-y-6">
          <form onSubmit={handleAddKnowledge} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Add Knowledge Document</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Document Title</label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="e.g. Return Processing Steps"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
                <input
                  type="text"
                  value={newDoc.category}
                  onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Content / FAQ Body</label>
              <textarea
                rows={4}
                value={newDoc.content}
                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                placeholder="Full article content used by the AI to answer customer inquiries..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingDoc}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              {savingDoc ? "Saving..." : "Add to Knowledge Base"}
            </button>
          </form>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Tenant Knowledge Base Articles</h3>
            {data?.knowledge?.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">No custom knowledge documents added yet.</p>
            ) : (
              <div className="space-y-3">
                {data?.knowledge?.map((doc: any) => (
                  <div key={doc.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {doc.category || "general"}
                      </span>
                      <h4 className="font-medium text-white text-sm mt-1">{doc.title}</h4>
                      <p className="text-xs text-zinc-400 whitespace-pre-wrap">{doc.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteKnowledge(doc.id)}
                      disabled={deletingDocId === doc.id}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition ml-4"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: GMAIL MAILBOXES */}
      {activeTab === "accounts" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Connected Gmail Mailboxes</h2>
            <p className="text-sm text-zinc-400">
              Multiple connected Gmail accounts are isolated per business. App Passwords remain AES-256-GCM encrypted.
            </p>
          </div>

          <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
            {data?.accounts?.map((acc: any) => (
              <div key={acc.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-zinc-950">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white text-sm">{acc.email}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {acc.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Last Polled: {acc.last_polled_at ? new Date(acc.last_polled_at).toLocaleString() : "Never"}
                  </p>
                </div>

                <div className="flex items-center space-x-4 text-xs text-zinc-400">
                  <span className="flex items-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> IMAP/SMTP Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: EXECUTIONS */}
      {activeTab === "executions" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Audit Execution Logs</h2>
          <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
            {data?.executions?.map((exec: any) => (
              <div key={exec.id} className="p-4 flex justify-between items-center text-sm bg-zinc-950">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-zinc-400">{exec.gmail_message_id}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        exec.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : exec.status === "SKIPPED"
                          ? "bg-zinc-800 text-zinc-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {exec.status}
                    </span>
                  </div>
                  {exec.error_message && <p className="text-xs text-zinc-500">{exec.error_message}</p>}
                </div>
                <span className="text-xs text-zinc-500">{new Date(exec.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleSimulate} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Test Simulator (Dry Run)</h2>
            <p className="text-xs text-zinc-400">
              Evaluates incoming messages against your business hours, support categories, policies, and supervisor guardrails.
              Does NOT send real emails.
            </p>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Customer Email</label>
              <input
                type="email"
                value={simEmail.sender}
                onChange={(e) => setSimEmail({ ...simEmail, sender: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Subject</label>
              <input
                type="text"
                value={simEmail.subject}
                onChange={(e) => setSimEmail({ ...simEmail, subject: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Email Body</label>
              <textarea
                rows={5}
                value={simEmail.bodyText}
                onChange={(e) => setSimEmail({ ...simEmail, bodyText: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white"
              />
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{simulating ? "Evaluating..." : "Run Supervisor Simulation"}</span>
            </button>
          </form>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Supervisor Decision Result</h3>
            {!simResult ? (
              <p className="text-sm text-zinc-500 italic">Click &quot;Run Supervisor Simulation&quot; to test.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-400 uppercase font-semibold">Supervisor Action</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                        simResult.decision?.action === "AUTO_REPLY"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : simResult.decision?.action === "HUMAN_REVIEW"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {simResult.decision?.action}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono">Category: {simResult.decision?.category}</p>
                  <p className="text-xs text-zinc-400">Confidence: {(simResult.decision?.confidence * 100).toFixed(0)}%</p>
                  <p className="text-xs text-zinc-500 italic">{simResult.decision?.reasoning}</p>
                </div>

                {simResult.decision?.replyText && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase">Generated Outbound Reply</span>
                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 whitespace-pre-wrap">
                      {simResult.decision.replyText}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
