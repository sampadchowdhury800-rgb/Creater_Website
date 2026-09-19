"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MessageSquare, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth-client";

interface Comment {
  id: string;
  clerkUserId: string;
  clerkUserName: string | null;
  clerkUserImage: string | null;
  content: string;
  createdAt: string;
  replies?: Comment[];
}

interface CommentsSectionProps {
  slug: string;
}

export default function CommentsSection({ slug }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userId, openSignIn } = useAuth();

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/automations/${slug}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to load comments", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [slug]);

  const handlePost = async (text: string, parentId: string | null) => {
    if (!userId) {
      openSignIn();
      return;
    }
    if (!text.trim()) {
      toast.error("Comment cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/automations/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), parentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to post comment.");
        return;
      }

      toast.success(parentId ? "Reply posted!" : "Comment posted!");
      setContent("");
      setReplyContent("");
      setReplyTo(null);
      loadComments();
    } catch (err) {
      toast.error("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/automations/${slug}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Comment deleted.");
        loadComments();
      } else {
        const data = await res.json();
        toast.error(data?.error || "Failed to delete comment.");
      }
    } catch (err) {
      toast.error("Failed to delete comment.");
    }
  };

  const renderComment = (comment: Comment, isReply: boolean) => {
    const isOwn = userId && comment.clerkUserId === userId;

    return (
      <div
        key={comment.id}
        className={`border border-white/10 rounded-2xl p-5 ${
          isReply ? "bg-black/10 ml-8 sm:ml-12" : "bg-white/5"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          {comment.clerkUserImage ? (
            <Image
              src={comment.clerkUserImage}
              alt={comment.clerkUserName || "User"}
              width={isReply ? 32 : 40}
              height={isReply ? 32 : 40}
              className="rounded-full object-cover"
            />
          ) : (
            <div
              className={`rounded-full bg-white/10 flex items-center justify-center ${
                isReply ? "w-8 h-8" : "w-10 h-10"
              }`}
            >
              <span className="text-white font-bold">
                {(comment.clerkUserName || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-white">
              {comment.clerkUserName || "User"}
            </p>
            <p className="text-xs text-on-surface-variant">
              {new Date(comment.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!isReply && (
              <button
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                className="p-2 text-on-surface-variant hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Reply"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                title="Delete comment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-on-surface-variant break-words">{comment.content}</p>

        {!isReply && replyTo === comment.id && (
          <div className="mt-3 flex gap-2">
            <input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={userId ? "Write a reply..." : "Sign in to reply..."}
              className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary-fixed-dim/50"
            />
            <button
              onClick={() => handlePost(replyContent, comment.id)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary-container hover:bg-primary-fixed text-on-primary-container text-sm font-bold rounded-xl transition-colors disabled:opacity-70"
            >
              Reply
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="border-t border-white/10 pt-10 mt-12">
      <h2 className="text-2xl font-bold text-white mb-6">Comments</h2>

      {/* New comment */}
      <div className="flex gap-3 mb-8">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            userId ? "Ask a question or leave a comment..." : "Sign in to comment..."
          }
          rows={3}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary-fixed-dim/50 resize-none"
        />
        <button
          onClick={() => handlePost(content, null)}
          disabled={isSubmitting}
          className="self-end px-6 py-3 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-70"
        >
          <MessageSquarePlus className="w-5 h-5" />
          {isSubmitting ? "Posting..." : "Post"}
        </button>
      </div>

      {/* Comment list */}
      {isLoading ? (
        <p className="text-on-surface-variant py-8 text-center">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-on-surface-variant py-8 text-center">
          No comments yet. Start the discussion!
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-3">
              {renderComment(comment, false)}
              {comment.replies && comment.replies.length > 0 && (
                <div className="flex flex-col gap-3">
                  {comment.replies.map((reply) => renderComment(reply, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}