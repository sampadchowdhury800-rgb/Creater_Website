"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const PLATFORMS = [
  "LinkedIn", "GitHub", "YouTube", "Instagram", "Facebook",
  "Twitter / X", "TikTok", "Pinterest", "Medium", "Dev.to",
  "Upwork", "Fiverr", "Portfolio", "Other",
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SocialProfileEditPage({ params }: PageProps) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    platform: "LinkedIn",
    label: "",
    url: "",
    icon: "",
    color: "#0A66C2",
    isOfficial: true,
    sortOrder: "0",
  });

  const fetchProfile = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await fetch(`/api/admin/social-profiles/${id}`);
      if (!res.ok) { router.push("/admin/social-profiles"); return; }
      const data = await res.json();
      const p = data.profile;
      setFormData({
        platform: p.platform,
        label: p.label,
        url: p.url,
        icon: p.icon || "",
        color: p.color || "#0A66C2",
        isOfficial: p.isOfficial,
        sortOrder: String(p.sortOrder),
      });
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [id, isNew, router]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        sortOrder: parseInt(formData.sortOrder) || 0,
      };
      const url = isNew
        ? "/api/admin/social-profiles"
        : `/api/admin/social-profiles/${id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success(isNew ? "Profile created!" : "Profile updated!");
      router.push("/admin/social-profiles");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#111827] p-4 rounded-xl border border-white/10 sticky top-4 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/social-profiles"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Back to Social Profiles"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">
            {isNew ? "Add Social Profile" : "Edit Social Profile"}
          </h1>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">Profile Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Platform *</label>
            <select
              required
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Display Label *</label>
            <input
              required
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="e.g. Sampad Chowdhury"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-300 mb-1">Profile URL *</label>
          <input
            required
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400 font-mono"
            placeholder="https://www.linkedin.com/in/..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Icon Name (Material Symbol)</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="e.g. work, link, photo_camera"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-9 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400 font-mono"
                placeholder="#0A66C2"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Sort Order</label>
            <input
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOfficial}
                onChange={(e) => setFormData({ ...formData, isOfficial: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 text-cyan-400"
              />
              <span className="text-sm text-gray-300">Official profile (include in sameAs JSON-LD)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#111827] border border-white/10 text-xs text-gray-400 leading-relaxed">
        <strong className="text-gray-300">Official profiles</strong> are automatically included in the{" "}
        <code className="text-cyan-400">sameAs</code> arrays of Organization and Person structured data.
        This is a key signal for search engines and AI systems to confirm brand identity.
      </div>
    </form>
  );
}
