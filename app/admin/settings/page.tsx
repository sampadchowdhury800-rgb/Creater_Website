"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, AlertTriangle, Shield } from "lucide-react";
import { toast } from "react-toastify";

interface SettingsData {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  instagramUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  commentsEnabled: string;
  autoApproveComments: string;
  analyticsId: string;
  supportEmail: string;
  emergencyNotice: string;
  supportNotes: string;
  ownerTestEmail?: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    siteName: "Chowdhury Duo",
    siteDescription: "Professional Portfolio",
    contactEmail: "",
    instagramUrl: "",
    youtubeUrl: "",
    twitterUrl: "",
    commentsEnabled: "true",
    autoApproveComments: "false",
    analyticsId: "",
    supportEmail: "",
    emergencyNotice: "",
    supportNotes: "",
    ownerTestEmail: "",
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/settings`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      setSettings(prev => ({
        ...prev,
        ...data.settings
      }));
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation for Owner Test Account email if entered
    if (settings.ownerTestEmail && settings.ownerTestEmail.trim()) {
      const email = settings.ownerTestEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error("Please enter a valid email address for Owner Test Account.");
        return;
      }
    }

    setSaving(true);
    
    try {
      const res = await fetch(`/api/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }
      
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure your site preferences and globals</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">General</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => setSettings({...settings, siteName: e.target.value})}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Description</label>
            <textarea
              value={settings.siteDescription}
              onChange={(e) => setSettings({...settings, siteDescription: e.target.value})}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Social Links</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instagram URL</label>
              <input
                type="url"
                value={settings.instagramUrl}
                onChange={(e) => setSettings({...settings, instagramUrl: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTube URL</label>
              <input
                type="url"
                value={settings.youtubeUrl}
                onChange={(e) => setSettings({...settings, youtubeUrl: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Discussion</h2>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="commentsEnabled"
                checked={settings.commentsEnabled === "true"}
                onChange={(e) => setSettings({...settings, commentsEnabled: e.target.checked ? "true" : "false"})}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="commentsEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Comments Globally
              </label>
            </div>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="autoApprove"
                checked={settings.autoApproveComments === "true"}
                onChange={(e) => setSettings({...settings, autoApproveComments: e.target.checked ? "true" : "false"})}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="autoApprove" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto-approve comments (No moderation)
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center justify-between">
              <span>AI Support Assistant</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">Live Grounding</span>
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Support Contact Email
              </label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                placeholder="sampadchowdhury777@gmail.com"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Given to customers when human escalation or direct contact is needed.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Support Notice / Offline Message
              </label>
              <input
                type="text"
                value={settings.emergencyNotice}
                onChange={(e) => setSettings({ ...settings, emergencyNotice: e.target.value })}
                placeholder="AI Customer Support is live 24/7."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Support Knowledge & Troubleshooting Notes
              </label>
              <textarea
                value={settings.supportNotes}
                onChange={(e) => setSettings({ ...settings, supportNotes: e.target.value })}
                rows={4}
                placeholder="Enter custom business rules, common troubleshooting tips, or special instructions. Each line is dynamically injected into the AI context."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Owner Test Account
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold border border-emerald-500/20">
                  Universal Testing Access
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Dedicated customer account used for testing all automations without purchasing them. This account is separate from the administrator account.
              </p>
            </div>

            {/* Visible Safety Warning */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  This must be a separate customer account from the Admin account.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  The Owner Test Account logs in as a regular customer via Clerk to verify store experiences, test run workflows, and manage automations without checkout.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Owner Test Account Email
              </label>
              <input
                type="email"
                value={settings.ownerTestEmail || ""}
                onChange={(e) => setSettings({ ...settings, ownerTestEmail: e.target.value })}
                placeholder="test-automation@yourdomain.com"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use a dedicated customer account. Do not use the Admin login email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
