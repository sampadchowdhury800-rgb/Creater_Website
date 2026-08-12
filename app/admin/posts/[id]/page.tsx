"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import PromptEditor from "@/components/editor/PromptEditor";
import { createPost, updatePost } from "@/app/admin/actions";
import { ArrowLeft, Save, Loader2, Image as ImageIcon, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface PostFormData {
  title: string;
  slug: string;
  shortDesc: string;
  content: string;
  featuredImage: string;
  videoUrl: string;
  platform: "INSTAGRAM" | "YOUTUBE";
  status: "DRAFT" | "PUBLISHED";
  publishDate: string;
  
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  keywords: string;
  
  categoryIds: string[];
  tagIds: string[];
}

export default function PostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const isNew = id === 'new';
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlatform = searchParams.get('platform') as "INSTAGRAM" | "YOUTUBE" || "INSTAGRAM";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [tags, setTags] = useState<{id: string, name: string}[]>([]);

  const [formData, setFormData] = useState<PostFormData>({
    title: "",
    slug: "",
    shortDesc: "",
    content: "",
    featuredImage: "",
    videoUrl: "",
    platform: initialPlatform,
    status: "DRAFT",
    publishDate: new Date().toISOString().slice(0, 16),
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    keywords: "",
    categoryIds: [],
    tagIds: [],
  });

  const fetchData = useCallback(async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/admin/categories'),
        fetch('/api/admin/tags')
      ]);
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      
      setCategories(catData.categories || []);
      setTags(tagData.tags || []);

      if (!isNew) {
        const postRes = await fetch(`/api/admin/posts/${id}`);
        if (!postRes.ok) {
          router.push('/admin/posts');
          return;
        }
        const postData = await postRes.json();
        const post = postData.post;
        
        setFormData({
          title: post.title || "",
          slug: post.slug || "",
          shortDesc: post.shortDesc || "",
          content: post.content || "",
          featuredImage: post.featuredImage || "",
          videoUrl: post.videoUrl || "",
          platform: post.platform,
          status: post.status,
          publishDate: post.publishDate ? new Date(post.publishDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
          seoTitle: post.seoTitle || "",
          seoDescription: post.seoDescription || "",
          canonicalUrl: post.canonicalUrl || "",
          keywords: post.keywords || "",
          categoryIds: post.categories?.map((c: any) => c.id) || [],
          tagIds: post.tags?.map((t: any) => t.id) || [],
        });
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [id, isNew, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        publishDate: new Date(formData.publishDate).toISOString(),
      };

      if (isNew) {
        await createPost(payload);
        toast.success("Post published successfully.");
        router.push('/admin/posts');
      } else {
        await updatePost(id, payload);
        toast.success("Post published successfully.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to publish post.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const uploadData = new FormData();
    uploadData.append("file", file);
    
    toast.info("Uploading featured image...");
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setFormData({ ...formData, featuredImage: data.url });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
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
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 sticky top-4 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link href="/admin/posts" className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isNew ? "Create New Post" : "Edit Post"}
          </h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value as any})}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm font-medium"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="group relative overflow-hidden flex items-center gap-2 bg-[#dbfcff]/10 hover:bg-[#dbfcff]/20 text-[#dbfcff]/90 hover:text-[#dbfcff] border border-[#dbfcff]/20 hover:border-[#dbfcff]/40 px-4 py-2 rounded-lg transition-all duration-300 ease-out hover:shadow-[0_0_20px_rgba(0,219,238,0.15)] focus:outline-none focus:ring-2 focus:ring-[#dbfcff]/50 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none font-medium text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin text-[#dbfcff]/70 group-hover:text-[#dbfcff]" /> : <Save className="w-4 h-4 text-[#dbfcff]/70 group-hover:text-[#dbfcff] transition-colors duration-300" />}
            {saving ? "Publishing..." : "Post Now"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) => {
                  const title = e.target.value;
                  if (isNew) {
                    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    setFormData({...formData, title, slug});
                  } else {
                    setFormData({...formData, title});
                  }
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                placeholder="Post title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt Sections</label>
              <PromptEditor 
                content={formData.content} 
                onChange={(content) => setFormData({...formData, content})} 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Description (Excerpt)</label>
              <textarea
                value={formData.shortDesc}
                onChange={(e) => setFormData({...formData, shortDesc: e.target.value})}
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                placeholder="Brief summary for listings and SEO fallback"
              />
            </div>
          </div>
          
          {/* SEO Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">SEO Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SEO Title</label>
              <input
                type="text"
                value={formData.seoTitle}
                onChange={(e) => setFormData({...formData, seoTitle: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                placeholder="Leave blank to use main title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SEO Description</label>
              <textarea
                value={formData.seoDescription}
                onChange={(e) => setFormData({...formData, seoDescription: e.target.value})}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                placeholder="Meta description for search engines"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keywords</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                placeholder="Comma separated keywords"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Publishing</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <input
                required
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({...formData, slug: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({...formData, platform: e.target.value as any})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              >
                <option value="INSTAGRAM">Instagram</option>
                <option value="YOUTUBE">YouTube</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instagram / Video URL</label>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({...formData, videoUrl: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publish Date</label>
              <input
                type="datetime-local"
                value={formData.publishDate}
                onChange={(e) => setFormData({...formData, publishDate: e.target.value})}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Featured Image</h3>
            
            {formData.featuredImage ? (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <Image src={formData.featuredImage} alt="Featured" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setFormData({...formData, featuredImage: ""})}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to upload</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Taxonomy</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categories</label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {categories.map(cat => (
                  <label key={cat.id} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <input 
                      type="checkbox" 
                      checked={formData.categoryIds.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) setFormData({...formData, categoryIds: [...formData.categoryIds, cat.id]});
                        else setFormData({...formData, categoryIds: formData.categoryIds.filter(id => id !== cat.id)});
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-white dark:bg-gray-700" 
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {tags.map(tag => (
                  <label key={tag.id} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <input 
                      type="checkbox" 
                      checked={formData.tagIds.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) setFormData({...formData, tagIds: [...formData.tagIds, tag.id]});
                        else setFormData({...formData, tagIds: formData.tagIds.filter(id => id !== tag.id)});
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-white dark:bg-gray-700" 
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
