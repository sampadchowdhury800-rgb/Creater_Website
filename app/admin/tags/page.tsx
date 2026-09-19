"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

interface Tag {
  id: string;
  name: string;
  slug: string;
  _count: { posts: number };
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({ name: "", slug: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/tags?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTags(data.tags || []);
    } catch (error) {
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!editingId && formData.name) {
      setFormData(prev => ({
        ...prev,
        slug: prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      }));
    }
  }, [formData.name, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const url = editingId ? `/api/admin/tags/${editingId}` : `/api/admin/tags`;
      const method = editingId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save tag");

      toast.success(editingId ? "Tag updated" : "Tag created");
      setIsModalOpen(false);
      fetchTags();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tag?")) return;
    
    try {
      const res = await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      
      toast.success("Tag deleted");
      fetchTags();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openModal = (tag?: Tag) => {
    if (tag) {
      setEditingId(tag.id);
      setFormData({
        name: tag.name,
        slug: tag.slug,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", slug: "" });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tags</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage content tags</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          New Tag
        </button>
      </div>

      <div className="flex items-center space-x-4 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <Search className="w-5 h-5 text-gray-400 ml-2" />
        <input
          type="text"
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Posts</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center">No tags found.</td>
                  </tr>
                ) : (
                  tags.map((tag) => (
                    <tr key={tag.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tag.name}</td>
                      <td className="px-6 py-4">{tag.slug}</td>
                      <td className="px-6 py-4">{tag._count.posts}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => openModal(tag)} className="text-blue-500 hover:text-blue-600 p-1">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(tag.id)} className="text-red-500 hover:text-red-600 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Tag" : "New Tag"}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({...formData, slug: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
