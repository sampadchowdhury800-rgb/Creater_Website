"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPerson, updatePerson } from "@/app/admin/actions";
import { toast } from "react-toastify";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

interface PersonFormProps {
  initialData?: any;
  isNew?: boolean;
}

export default function PersonForm({ initialData, isNew = false }: PersonFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    title: initialData?.title || "",
    shortBio: initialData?.shortBio || "",
    bio: initialData?.bio || "",
    avatarUrl: initialData?.avatarUrl || "",
    email: initialData?.email || "",
    location: initialData?.location || "India",
    linkedin: initialData?.linkedin || "",
    github: initialData?.github || "",
    youtube: initialData?.youtube || "",
    instagram: initialData?.instagram || "",
    website: initialData?.website || "",
    skills: initialData?.skills?.join(", ") || "",
    achievements: initialData?.achievements?.join("\n") || "",
    isFounder: initialData?.isFounder ?? true,
    sortOrder: initialData?.sortOrder || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        title: formData.title,
        shortBio: formData.shortBio,
        bio: formData.bio,
        avatarUrl: formData.avatarUrl,
        email: formData.email,
        location: formData.location,
        linkedin: formData.linkedin,
        github: formData.github,
        youtube: formData.youtube,
        instagram: formData.instagram,
        website: formData.website,
        skills: formData.skills
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        achievements: formData.achievements
          .split("\n")
          .map((a: string) => a.trim())
          .filter(Boolean),
        isFounder: Boolean(formData.isFounder),
        sortOrder: Number(formData.sortOrder) || 0,
        education: initialData?.education || [],
        experience: initialData?.experience || [],
      };

      if (isNew) {
        await createPerson(payload);
        toast.success("Person created successfully!");
        router.push("/admin/people");
      } else {
        await updatePerson(initialData.id, payload);
        toast.success("Person updated successfully!");
        router.push("/admin/people");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save person");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#111827] p-4 rounded-xl border border-white/10 sticky top-4 z-20 shadow-lg">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/people"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">
            {isNew ? "Add New Person" : `Edit Person: ${formData.name}`}
          </h1>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Person"}
        </button>
      </div>

      <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">
          Basic Identity
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Full Name *</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                if (isNew) {
                  const slug = name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)+/g, "");
                  setFormData({ ...formData, name, slug });
                } else {
                  setFormData({ ...formData, name });
                }
              }}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="e.g. Sampad Chowdhury"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Slug *</label>
            <input
              required
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 font-mono outline-none focus:border-cyan-400"
              placeholder="e.g. sampad-chowdhury"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-300 mb-1">Professional Title *</label>
          <input
            required
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            placeholder="e.g. Entrepreneur | Full Stack Developer | Automation Specialist"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-300 mb-1">Short Bio</label>
          <textarea
            rows={2}
            value={formData.shortBio}
            onChange={(e) => setFormData({ ...formData, shortBio: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            placeholder="One-paragraph summary for cards and meta descriptions"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-300 mb-1">Full Biography</label>
          <textarea
            rows={4}
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400 leading-relaxed"
            placeholder="Full career narrative and background"
          />
        </div>
      </div>

      {/* Social & Contact */}
      <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">
          Verified Profiles &amp; Contact
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Official LinkedIn URL</label>
            <input
              type="url"
              value={formData.linkedin}
              onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="https://www.linkedin.com/in/..."
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Official GitHub URL</label>
            <input
              type="url"
              value={formData.github}
              onChange={(e) => setFormData({ ...formData, github: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="https://github.com/..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Instagram URL</label>
            <input
              type="url"
              value={formData.instagram}
              onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="https://instagram.com/..."
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">YouTube URL</label>
            <input
              type="url"
              value={formData.youtube}
              onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-300 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Skills & Achievements */}
      <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">
          Skills &amp; Achievements
        </h2>

        <div>
          <label className="block text-xs font-mono text-gray-300 mb-1">Skills (Comma Separated)</label>
          <input
            type="text"
            value={formData.skills}
            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            placeholder="e.g. React, Next.js, TypeScript, Python, FastAPI, Docker"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-300 mb-1">Achievements (One Per Line)</label>
          <textarea
            rows={3}
            value={formData.achievements}
            onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
            placeholder="One achievement per line..."
          />
        </div>
      </div>
    </form>
  );
}
