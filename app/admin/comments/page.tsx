"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Search, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import Link from "next/link";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string | null;
  status: "PENDING" | "APPROVED" | "SPAM" | "REJECTED";
  createdAt: string;
  post: { title: string; slug: string } | null;
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/comments?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      setComments(comments.map(c => c.id === id ? { ...c, status: newStatus as any } : c));
      toast.success(`Comment marked as ${newStatus.toLowerCase()}`);
    } catch (error) {
      toast.error("Failed to update comment");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this comment permanently?")) return;
    
    try {
      const res = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      
      toast.success("Comment deleted");
      setComments(comments.filter(c => c.id !== id));
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'APPROVED': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Approved</span>;
      case 'PENDING': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</span>;
      case 'REJECTED': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">Rejected</span>;
      case 'SPAM': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Spam</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Comments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage user comments and discussions</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 flex-1">
          <Search className="w-5 h-5 text-gray-400 ml-2" />
          <input
            type="text"
            placeholder="Search comments, authors, emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white"
          />
        </div>
        <div className="w-full sm:w-48 border-l border-gray-200 dark:border-gray-700 pl-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="SPAM">Spam</option>
          </select>
        </div>
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
                  <th className="px-6 py-4">Author</th>
                  <th className="px-6 py-4">Comment</th>
                  <th className="px-6 py-4">Post</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center">No comments found.</td>
                  </tr>
                ) : (
                  comments.map((comment) => (
                    <tr key={comment.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-gray-900 dark:text-white">{comment.authorName}</div>
                        <div className="text-xs text-gray-400">{comment.authorEmail || "No email"}</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(comment.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 align-top max-w-md">
                        <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 line-clamp-3">{comment.content}</p>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {comment.post ? (
                          <span className="truncate max-w-[200px] inline-block" title={comment.post.title}>
                            {comment.post.title}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Deleted Post</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <StatusBadge status={comment.status} />
                      </td>
                      <td className="px-6 py-4 align-top text-right space-x-1">
                        {comment.status !== 'APPROVED' && (
                          <button onClick={() => updateStatus(comment.id, 'APPROVED')} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 p-1.5 rounded transition-colors" title="Approve">
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {comment.status !== 'REJECTED' && (
                          <button onClick={() => updateStatus(comment.id, 'REJECTED')} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 rounded transition-colors" title="Reject">
                            <XCircle size={18} />
                          </button>
                        )}
                        {comment.status !== 'SPAM' && (
                          <button onClick={() => updateStatus(comment.id, 'SPAM')} className="text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 p-1.5 rounded transition-colors" title="Mark as Spam">
                            <AlertTriangle size={18} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(comment.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition-colors" title="Delete Permanently">
                          <Trash2 size={18} />
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
