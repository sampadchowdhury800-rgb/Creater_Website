"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createService, updateService } from "@/app/admin/actions";
import { toast } from "react-toastify";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import FaqEditor, { FaqItem } from "@/components/editor/FaqEditor";

interface ServiceFormProps {
  initialData?: any;
  isNew?: boolean;
}

export default function ServiceForm({ initialData, isNew = false }: ServiceFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    category: initialData?.category || "Automation",
    icon: initialData?.icon || "smart_toy",
    shortDesc: initialData?.shortDesc || "",
    fullDesc: initialData?.fullDesc || "",
    features: initialData?.features || [""],
    technologies: initialData?.technologies?.join(", ") || "",
    useCases: initialData?.useCases || [""],
    status: initialData?.status || "PUBLISHED",
    sortOrder: initialData?.sortOrder || 0,
    directAnswer: initialData?.directAnswer || "",
    seoTitle: initialData?.seoTitle || "",
    seoDescription: initialData?.seoDescription || "",
    ogImage: initialData?.ogImage || "",
    faqs: (initialData?.faqs as FaqItem[]) || [],
  });

  const handleFeatureChange = (index: number, val: string) => {
    const updated = [...formData.features];
    updated[index] = val;
    setFormData({ ...formData, features: updated });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ""] });
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_: any, i: number) => i !== index),
    });
  };

  const handleUseCaseChange = (index: number, val: string) => {
    const updated = [...formData.useCases];
    updated[index] = val;
    setFormData({ ...formData, useCases: updated });
  };

  const addUseCase = () => {
    setFormData({ ...formData, useCases: [...formData.useCases, ""] });
  };

  const removeUseCase = (index: number) => {
    setFormData({
      ...formData,
      useCases: formData.useCases.filter((_: any, i: number) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        category: formData.category,
        icon: formData.icon,
        shortDesc: formData.shortDesc,
        fullDesc: formData.fullDesc,
        features: formData.features.filter(Boolean),
        technologies: formData.technologies
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean),
        useCases: formData.useCases.filter(Boolean),
        status: formData.status as "DRAFT" | "PUBLISHED",
        sortOrder: Number(formData.sortOrder) || 0,
        directAnswer: formData.directAnswer,
        seoTitle: formData.seoTitle,
        seoDescription: formData.seoDescription,
        ogImage: formData.ogImage,
        faqs: formData.faqs.filter((f) => f.question && f.answer),
      };

      if (isNew) {
        await createService(payload);
        toast.success("Service created successfully!");
        router.push("/admin/services");
      } else {
        await updateService(initialData.id, payload);
        toast.success("Service updated successfully!");
        router.push("/admin/services");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save service");
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
            href="/admin/services"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">
            {isNew ? "Create New Service" : `Edit Service: ${formData.name}`}
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
            {saving ? "Saving..." : "Save Service"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-2">
              Service Details
            </h2>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Service Name *</label>
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
                placeholder="e.g. Full-Stack Web Application Development"
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
                  placeholder="e.g. full-stack-web-application-development"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                  placeholder="e.g. Development, Automation, Cloud"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Short Description (Excerpt)</label>
              <textarea
                rows={2}
                value={formData.shortDesc}
                onChange={(e) => setFormData({ ...formData, shortDesc: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="Brief summary used in cards and search snippets"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Full Architectural Overview</label>
              <textarea
                rows={6}
                value={formData.fullDesc}
                onChange={(e) => setFormData({ ...formData, fullDesc: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-sm px-3 py-2 outline-none focus:border-cyan-400 leading-relaxed"
                placeholder="In-depth explanation of scope, methodology, and deliverables"
              />
            </div>
          </div>

          {/* Features & Deliverables */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h2 className="text-base font-bold text-white">Features &amp; Deliverables</h2>
              <button
                type="button"
                onClick={addFeature}
                className="px-2.5 py-1 rounded bg-white/5 text-cyan-400 text-xs font-mono flex items-center gap-1 hover:bg-white/10"
              >
                <Plus size={14} /> Add Feature
              </button>
            </div>

            <div className="space-y-2">
              {formData.features.map((feature: string, idx: number) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(idx, e.target.value)}
                    placeholder="e.g. Automated cold email outreach pipelines"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeFeature(idx)}
                    className="p-2 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Real-World Use Cases */}
          <div className="bg-[#111622] p-6 rounded-xl border border-white/10 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h2 className="text-base font-bold text-white">Typical Use Cases</h2>
              <button
                type="button"
                onClick={addUseCase}
                className="px-2.5 py-1 rounded bg-white/5 text-cyan-400 text-xs font-mono flex items-center gap-1 hover:bg-white/10"
              >
                <Plus size={14} /> Add Use Case
              </button>
            </div>

            <div className="space-y-2">
              {formData.useCases.map((uc: string, idx: number) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={uc}
                    onChange={(e) => handleUseCaseChange(idx, e.target.value)}
                    placeholder="e.g. B2B cold outreach with automated reply classification"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeUseCase(idx)}
                    className="p-2 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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

        {/* Sidebar Column (SEO & AEO) */}
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
              Concise direct answer to: &quot;What does this service provide?&quot; Displayed prominently for AI and search answer engines.
            </p>
            <textarea
              rows={4}
              value={formData.directAnswer}
              onChange={(e) => setFormData({ ...formData, directAnswer: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
              placeholder="e.g. Business Automation by Chowdhury Duo connects CRMs, emails, and payment gateways into autonomous workflows..."
            />
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
                placeholder="Defaults to: Service Name | Chowdhury Duo Services"
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

          {/* Tech Stack & Settings */}
          <div className="bg-[#111827] p-6 rounded-xl border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
              Configuration
            </h2>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Technologies (Comma Separated)</label>
              <input
                type="text"
                value={formData.technologies}
                onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="e.g. Next.js, TypeScript, PostgreSQL, n8n"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-300 mb-1">Material Symbol Icon</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0A0D14] text-white text-xs px-3 py-2 font-mono outline-none focus:border-cyan-400"
                placeholder="e.g. smart_toy, code, cloud, database, dns"
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
        </div>
      </div>
    </form>
  );
}
