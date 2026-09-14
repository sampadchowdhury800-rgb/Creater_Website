"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject } from "@/app/admin/actions";
import { toast } from "react-toastify";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import FaqEditor, { FaqItem } from "@/components/editor/FaqEditor";

interface ProjectFormProps {
  initialData?: any;
  isNew?: boolean;
}

export default function ProjectForm({ initialData, isNew = false }: ProjectFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    client: initialData?.client || "",
    role: initialData?.role || "Lead Full-Stack Developer",
    shortDesc: initialData?.shortDesc || "",
    fullDesc: initialData?.fullDesc || "",
    problem: initialData?.problem || "",
    solution: initialData?.solution || "",
    result: initialData?.result || "",
    technologies: initialData?.technologies?.join(", ") || "",
    demoUrl: initialData?.demoUrl || "",
    githubUrl: initialData?.githubUrl || "",
    status: initialData?.status || "PUBLISHED",
    sortOrder: initialData?.sortOrder || 0,
    directAnswer: initialData?.directAnswer || "",
    seoTitle: initialData?.seoTitle || "",
    seoDescription: initialData?.seoDescription || "",
    ogImage: initialData?.ogImage || "",
    faqs: (initialData?.faqs as FaqItem[]) || [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: formData.title,
        slug: formData.slug,
        client: formData.client,
        role: formData.role,
        shortDesc: formData.shortDesc,
        fullDesc: formData.fullDesc,
        problem: formData.problem,
        solution: formData.solution,
        result: formData.result,
        technologies: formData.technologies
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean),
        demoUrl: formData.demoUrl,
        githubUrl: formData.githubUrl,
        status: formData.status as "DRAFT" | "PUBLISHED",
        sortOrder: Number(formData.sortOrder) || 0,
        directAnswer: formData.directAnswer,
        seoTitle: formData.seoTitle,
        seoDescription: formData.seoDescription,
        ogImage: formData.ogImage,
        faqs: formData.faqs.filter((f) => f.question && f.answer),
      };

      if (isNew) {
        await createProject(payload);
        toast.success("Project created successfully!");
        router.push("/admin/projects");
      } else {
        await updateProject(initialData.id, payload);
        toast.success("Project updated successfully!");
        router.push("/admin/projects");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-[#111827] p-4 rounded-xl border border-white/10 sticky top-4 z-20 shadow-lg">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/projects"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">
            {isNew ? "Create Project Case Study" : `Edit: ${formData.title}`}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="rounded-lg border border-white/10 bg-[#0A0D14] text-white px-3 py-2 text-sm font-medium outline-none"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save Project"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">
              Case Study Overview
            </h2>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Project Title *</label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) => {
                  const title = e.target.value;
                  if (isNew) {
                    const slug = title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)+/g, "");
                    setFormData({ ...formData, title, slug });
                  } else {
                    setFormData({ ...formData, title });
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="e.g. Safety Chiraag — Women's Safety Mobile App"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">Slug *</label>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 font-mono outline-none focus:border-cyan-400"
                  placeholder="e.g. safety-chiraag-app"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">Your Role</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                  placeholder="e.g. Lead Full-Stack Architect"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Client / Category</label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="e.g. Public Safety Project, FinTech, Internal Venture"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Short Description (Excerpt)</label>
              <textarea
                rows={2}
                value={formData.shortDesc}
                onChange={(e) => setFormData({ ...formData, shortDesc: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="Brief summary used in listings and card previews"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Full Project Narrative</label>
              <textarea
                rows={4}
                value={formData.fullDesc}
                onChange={(e) => setFormData({ ...formData, fullDesc: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400 leading-relaxed"
                placeholder="Comprehensive background and engineering scope"
              />
            </div>
          </div>

          {/* Problem, Solution, Result Framework */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">
              Case Study Methodology (Problem / Solution / Result)
            </h2>

            <div>
              <label className="block text-xs font-mono text-amber-300 mb-1">The Problem / Challenge</label>
              <textarea
                rows={3}
                value={formData.problem}
                onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-amber-400"
                placeholder="What critical challenges did this project address?"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-cyan-300 mb-1">The Engineering Solution</label>
              <textarea
                rows={3}
                value={formData.solution}
                onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="How was the system architected and built?"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-emerald-300 mb-1">Results &amp; Impact</label>
              <textarea
                rows={3}
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-emerald-400"
                placeholder="What quantifiable outcomes or performance metrics were achieved?"
              />
            </div>
          </div>

          {/* FAQs Editor */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10">
            <FaqEditor
              faqs={formData.faqs}
              onChange={(faqs) => setFormData({ ...formData, faqs })}
            />
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* AEO Direct Answer */}
          <div className="bg-[#111827] p-6 rounded-xl border border-cyan-500/30 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="material-symbols-outlined text-cyan-400 text-[18px]">
                verified
              </span>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                AEO Direct Answer
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              Concise direct answer to: &quot;What is this project and what did it accomplish?&quot;
            </p>
            <textarea
              rows={3}
              value={formData.directAnswer}
              onChange={(e) => setFormData({ ...formData, directAnswer: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="e.g. Safety Chiraag is an emergency response app providing instant GPS location broadcasting..."
            />
          </div>

          {/* Links & Tech Stack */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
              Links &amp; Tech Stack
            </h2>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Technologies (Comma Separated)</label>
              <input
                type="text"
                value={formData.technologies}
                onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="e.g. Flutter, Dart, Firebase, Node.js"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Live Demo URL (Optional)</label>
              <input
                type="url"
                value={formData.demoUrl}
                onChange={(e) => setFormData({ ...formData, demoUrl: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">GitHub / Code URL (Optional)</label>
              <input
                type="url"
                value={formData.githubUrl}
                onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="https://github.com/..."
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* SEO Metadata */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
              SEO Metadata
            </h2>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">SEO Title (Optional Override)</label>
              <input
                type="text"
                value={formData.seoTitle}
                onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="Defaults to: Title — Case Study | Chowdhury Duo"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">SEO Description (Optional Override)</label>
              <textarea
                rows={3}
                value={formData.seoDescription}
                onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="Defaults to: Short Description"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">OG Image URL</label>
              <input
                type="text"
                value={formData.ogImage}
                onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
