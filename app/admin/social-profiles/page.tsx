"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, Loader2, ExternalLink, Shield, ShieldOff } from "lucide-react";
import { toast } from "react-toastify";

interface SocialProfile {
  id: string;
  platform: string;
  label: string;
  url: string;
  icon: string | null;
  color: string | null;
  isOfficial: boolean;
  sortOrder: number;
}

export default function SocialProfilesPage() {
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/social-profiles");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {
      toast.error("Failed to load social profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this social profile?")) return;
    try {
      const res = await fetch(`/api/admin/social-profiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Profile deleted");
      fetchProfiles();
    } catch {
      toast.error("Failed to delete profile");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Social Profiles</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage official social links used in Organization/Person structured data (sameAs).
          </p>
        </div>
        <Link
          href="/admin/social-profiles/new"
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg transition-all text-sm"
        >
          <Plus size={18} />
          Add Profile
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 bg-[#111827] border border-white/10 rounded-xl">
          <p className="text-gray-400 mb-4">No social profiles yet.</p>
          <Link href="/admin/social-profiles/new" className="text-cyan-400 hover:underline text-sm">
            Add your first profile →
          </Link>
        </div>
      ) : (
        <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-gray-400">
            <thead className="text-xs uppercase bg-[#0A0D14] text-gray-500 border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left">Platform / Label</th>
                <th className="px-6 py-3 text-left">URL</th>
                <th className="px-6 py-3 text-center">Official</th>
                <th className="px-6 py-3 text-center">Order</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-6 py-4">
                    <div>
                      <span className="font-semibold text-white">{p.platform}</span>
                      <span className="ml-2 text-gray-400 text-xs">— {p.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-[240px]">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 truncate text-xs"
                    >
                      {p.url.replace(/^https?:\/\//, "").slice(0, 40)}{p.url.length > 50 ? "…" : ""}
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {p.isOfficial ? (
                      <Shield size={16} className="inline text-emerald-400" aria-label="Official" />
                    ) : (
                      <ShieldOff size={16} className="inline text-gray-600" aria-label="Not official" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-xs font-mono">{p.sortOrder}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link
                      href={`/admin/social-profiles/${p.id}`}
                      className="inline-flex text-blue-400 hover:text-blue-300 p-1"
                      aria-label={`Edit ${p.label}`}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-500 hover:text-red-400 p-1"
                      aria-label={`Delete ${p.label}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-200/70 leading-relaxed">
        <strong className="text-cyan-400">Note:</strong> Only profiles marked as{" "}
        <Shield size={12} className="inline" /> <strong>Official</strong> are included in{" "}
        <code>sameAs</code> fields of Organization and Person structured data (JSON-LD).
        This helps search engines and AI systems confirm the brand&apos;s official digital presence.
      </div>
    </div>
  );
}
