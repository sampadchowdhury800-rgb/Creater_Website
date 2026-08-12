"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { createAutomation, updateAutomation } from "./actions";
import { ArrowLeft, Save, Loader2, Image as ImageIcon, Plus, Trash2, Video } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface MediaItem {
  url: string;
  publicId: string;
  type: "IMAGE" | "VIDEO";
  isPrimary: boolean;
}

interface AutomationFormProps {
  initialData?: any;
  categories: any[];
}

export default function AutomationForm({ initialData, categories }: AutomationFormProps) {
  const router = useRouter();
  const isNew = !initialData;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    shortDesc: initialData?.shortDesc || "",
    description: initialData?.description || "",
    price: initialData ? (initialData.price / 100).toString() : "",
    originalPrice: initialData?.originalPrice ? (initialData.originalPrice / 100).toString() : "",
    status: initialData?.status || "DRAFT",
    categoryId: initialData?.categoryId || "",
    features: initialData?.features?.join("\n") || "",
    requirements: initialData?.requirements?.join("\n") || "",
  });

  const [mediaItems, setMediaItems] = useState<MediaItem[]>(
    initialData?.media?.map((m: any) => ({
      url: m.url,
      publicId: m.publicId,
      type: m.type,
      isPrimary: m.isPrimary
    })) || []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Auto-generate slug from title if new and slug hasn't been manually edited
      ...(name === "title" && isNew && prev.slug === prev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
        ? { slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') }
        : {}),
    }));
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "IMAGE" | "VIDEO") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    toast.info(`Uploading ${type.toLowerCase()}...`);
    
    try {
      const newItems: MediaItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadData = new FormData();
        uploadData.append("file", file);
        
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: uploadData,
        });
        
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
        
        const data = await res.json();
        newItems.push({
          url: data.url,
          publicId: data.publicId,
          type,
          isPrimary: mediaItems.length === 0 && i === 0 && type === "IMAGE",
        });
      }
      
      setMediaItems(prev => [...prev, ...newItems]);
      toast.success("Upload complete!");
    } catch (error) {
      toast.error("Media upload failed");
    } finally {
      setUploading(false);
      // clear input
      e.target.value = '';
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems(prev => {
      const newItems = [...prev];
      const removed = newItems.splice(index, 1)[0];
      // If we removed the primary, make the first image primary if available
      if (removed.isPrimary) {
        const firstImage = newItems.find(m => m.type === "IMAGE");
        if (firstImage) firstImage.isPrimary = true;
      }
      return newItems;
    });
  };

  const setPrimaryMedia = (index: number) => {
    if (mediaItems[index].type !== "IMAGE") {
      toast.error("Only images can be set as primary thumbnail");
      return;
    }
    setMediaItems(prev => prev.map((item, i) => ({
      ...item,
      isPrimary: i === index
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        payload.append(key, value);
      });
      payload.append("mediaItems", JSON.stringify(mediaItems));

      if (isNew) {
        await createAutomation(payload);
        // Server action handles redirect/toast natively? No, server actions might redirect, we should just let it.
      } else {
        await updateAutomation(initialData.id, payload);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save automation.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/automations" className="p-2 text-on-surface-variant hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {isNew ? "New Automation" : "Edit Automation"}
            </h1>
            <p className="text-on-surface-variant text-sm">Fill in the product details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/automations"
            className="px-4 py-2 text-on-surface-variant hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || uploading}
            className="flex items-center gap-2 px-6 py-2 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Basic Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Title</label>
              <input
                required
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim"
                placeholder="Product title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Slug</label>
              <input
                required
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Short Description</label>
              <input
                type="text"
                name="shortDesc"
                value={formData.shortDesc}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Detailed Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim resize-y"
              />
            </div>
          </div>

          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Features & Requirements</h2>
            
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Features (One per line)</label>
              <textarea
                name="features"
                value={formData.features}
                onChange={handleChange}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim resize-y"
                placeholder="Feature 1&#10;Feature 2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Requirements (One per line)</label>
              <textarea
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim resize-y"
                placeholder="macOS 12+&#10;Notion Account"
              />
            </div>
          </div>

          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Media Gallery</h2>
              <div className="flex gap-2">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-colors">
                  <ImageIcon size={16} /> Image
                  <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleMediaUpload(e, "IMAGE")} />
                </label>
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-colors">
                  <Video size={16} /> Video
                  <input type="file" multiple accept="video/*" className="hidden" onChange={(e) => handleMediaUpload(e, "VIDEO")} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {mediaItems.map((item, idx) => (
                <div key={idx} className={`relative aspect-video rounded-lg overflow-hidden border-2 ${item.isPrimary ? 'border-primary-fixed-dim' : 'border-white/10'}`}>
                  {item.type === "VIDEO" ? (
                    <video src={item.url} className="w-full h-full object-cover" />
                  ) : (
                    <Image src={item.url} alt="Gallery item" fill className="object-cover" />
                  )}
                  
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button type="button" onClick={() => removeMedia(idx)} className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full">
                      <Trash2 size={16} />
                    </button>
                    {item.type === "IMAGE" && !item.isPrimary && (
                      <button type="button" onClick={() => setPrimaryMedia(idx)} className="text-xs bg-black/70 text-white px-2 py-1 rounded">
                        Set Primary
                      </button>
                    )}
                  </div>
                  {item.isPrimary && (
                    <div className="absolute top-2 left-2 bg-primary-fixed-dim text-black text-xs font-bold px-2 py-1 rounded">
                      Primary
                    </div>
                  )}
                </div>
              ))}
              {mediaItems.length === 0 && (
                <div className="col-span-full py-12 text-center text-on-surface-variant border-2 border-dashed border-white/10 rounded-lg">
                  No media uploaded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Pricing</h2>
            
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Price (INR)</label>
              <input
                required
                type="number"
                name="price"
                min="0"
                step="1"
                value={formData.price}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Original Price (INR - Optional)</label>
              <input
                type="number"
                name="originalPrice"
                min="0"
                step="1"
                value={formData.originalPrice}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim"
              />
            </div>
          </div>

          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Organization</h2>
            
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim [&>option]:bg-[#1C1C1E]"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Category</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim [&>option]:bg-[#1C1C1E]"
              >
                <option value="">Select Category...</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
