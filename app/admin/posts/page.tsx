"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Plus, Edit2, Trash2, Search, Loader2, Eye, Calendar, Image as ImageIcon } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import Image from "next/image";

interface Post {
  id: string;
  title: string;
  platform: string;
  status: string;
  publishDate: string;
  featuredImage: string | null;
  _count: { comments: number; categories: number; tags: number };
}

function PostsContent() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform");
  const router = useRouter();

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL("/api/admin/posts", window.location.origin);
      if (platform) url.searchParams.set("platform", platform);
      if (search) url.searchParams.set("search", search);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [platform, search]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      toast.success("Post deleted");
      fetchPosts();
    } catch (error) {
      toast.error("Failed to delete post");
    }
  };

  const titlePrefix = platform ? (platform === 'INSTAGRAM' ? 'Instagram ' : 'YouTube ') : 'All ';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{titlePrefix}Posts</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your {platform ? platform.toLowerCase() : 'content'} library</p>
        </div>
        <Link
          href={`/admin/posts/new${platform ? `?platform=${platform}` : ''}`}
          className="flex items-center gap-2 bg-[#00DBEE] hover:bg-[#00DBEE]/90 text-white font-medium px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,219,238,0.4)] cursor-pointer"
        >
          <Plus size={18} />
          New Post
        </Link>
      </div>

      <div className="flex items-center space-x-4 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <Search className="w-5 h-5 text-gray-400 ml-2" />
        <input
          type="text"
          placeholder="Search posts..."
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
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Platform</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center">No posts found.</td>
                  </tr>
                ) : (
                  posts.map((post) => (
                    <tr key={post.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {post.featuredImage ? (
                            <div className="w-20 h-24 rounded-lg overflow-hidden relative shrink-0 shadow-sm">
                              <Image src={post.featuredImage} alt={post.title} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-20 h-24 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0 flex items-center justify-center shadow-sm">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{post.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          post.status === 'PUBLISHED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          post.platform === 'YOUTUBE' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400'
                        }`}>
                          {post.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-gray-500 dark:text-gray-400">
                          <Calendar className="w-4 h-4 mr-1.5" />
                          {new Date(post.publishDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link href={`/admin/posts/${post.id}`} className="inline-flex text-blue-500 hover:text-blue-600 p-1">
                          <Edit2 size={16} />
                        </Link>
                        <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-600 p-1">
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
    </div>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <PostsContent />
    </Suspense>
  );
}
