"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Star, MessageSquarePlus } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth-client";

interface Review {
  id: string;
  clerkUserId: string;
  clerkUserName: string | null;
  clerkUserImage: string | null;
  rating: number;
  body: string | null;
  createdAt: string;
}

interface ReviewsSectionProps {
  slug: string;
}

export default function ReviewsSection({ slug }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userId, openSignIn } = useAuth();

  const loadReviews = async () => {
    try {
      const res = await fetch(`/api/automations/${slug}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to load reviews", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [slug]);

  const handleSubmit = async () => {
    if (!userId) {
      openSignIn();
      return;
    }
    if (rating < 1 || rating > 5) {
      toast.error("Please select a rating between 1 and 5.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/automations/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: body.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to submit review.");
        return;
      }

      toast.success("Review submitted!");
      setRating(0);
      setBody("");
      loadReviews();
    } catch (err) {
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="border-t border-white/10 pt-10 mt-4">
      <h2 className="text-2xl font-bold text-white mb-6">Reviews</h2>

      {/* Review form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1"
              title={`${star} star${star > 1 ? "s" : ""}`}
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  star <= (hoverRating || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-white/20"
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            userId
              ? "Share your experience with this automation..."
              : "Sign in to leave a review..."
          }
          rows={4}
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary-fixed-dim/50 mb-4 resize-none"
        />

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-3 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-70"
        >
          <MessageSquarePlus className="w-5 h-5" />
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>
        <p className="text-xs text-on-surface-variant mt-3">
          You must have a confirmed order for this automation to review it.
        </p>
      </div>

      {/* Review list */}
      {isLoading ? (
        <p className="text-on-surface-variant py-8 text-center">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-on-surface-variant py-8 text-center">
          No reviews yet. Be the first to review this automation!
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                {review.clerkUserImage ? (
                  <Image
                    src={review.clerkUserImage}
                    alt={review.clerkUserName || "User"}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {(review.clerkUserName || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">
                    {review.clerkUserName || "User"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
              {review.body && <p className="text-on-surface-variant">{review.body}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}