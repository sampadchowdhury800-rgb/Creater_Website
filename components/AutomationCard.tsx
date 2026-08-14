"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Star } from "lucide-react";
import ShareButton from "@/components/ShareButton";

interface AutomationCardProps {
  automation: {
    id: string;
    slug: string;
    title: string;
    shortDesc: string | null;
    price: number;
    originalPrice: number | null;
    thumbnailUrl: string | null;
    ratingSum: number;
    reviewCount: number;
  };
}

export default function AutomationCard({ automation }: AutomationCardProps) {
  const averageRating =
    automation.reviewCount > 0
      ? (automation.ratingSum / automation.reviewCount).toFixed(1)
      : 0;

  const canonicalUrl = `/automations/${automation.slug}`;

  return (
    <div className="group relative flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-primary-fixed-dim/50 transition-all duration-300">
      {/* Top Left Share Button */}
      <div className="absolute top-3 left-3 z-20">
        <ShareButton
          title={automation.title}
          url={canonicalUrl}
          iconOnly
          className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white rounded-full transition-transform active:scale-90"
        />
      </div>

      {/* Thumbnail */}
      <Link href={`/automations/${automation.slug}`} className="relative aspect-video w-full overflow-hidden bg-black/20 block">
        {automation.thumbnailUrl ? (
          <Image
            src={automation.thumbnailUrl}
            alt={automation.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            No Image
          </div>
        )}

        {/* Discount Badge */}
        {automation.originalPrice && automation.originalPrice > automation.price && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            -{Math.round(((automation.originalPrice - automation.price) / automation.originalPrice) * 100)}%
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex justify-between items-start mb-2">
          <Link href={`/automations/${automation.slug}`} className="hover:text-primary-fixed-dim transition-colors">
            <h3 className="font-bold text-lg line-clamp-2 text-white">{automation.title}</h3>
          </Link>
        </div>

        {automation.shortDesc && (
          <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 flex-1">
            {automation.shortDesc}
          </p>
        )}

        {/* Rating */}
        {automation.reviewCount > 0 && (
          <div className="flex items-center gap-1 mb-4 text-sm text-yellow-400">
            <Star className="w-4 h-4 fill-current" />
            <span className="font-medium text-white/90">{averageRating}</span>
            <span className="text-white/40">({automation.reviewCount})</span>
          </div>
        )}

        {/* Footer: Price & Actions */}
        <div className="mt-auto flex items-end justify-between pt-4 border-t border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-primary-fixed-dim">
                ₹{(automation.price / 100).toLocaleString()}
              </span>
              {automation.originalPrice && automation.originalPrice > automation.price && (
                <span className="text-sm text-white/40 line-through">
                  ₹{(automation.originalPrice / 100).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/automations/${automation.slug}`}
              className="px-3 py-1.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary-fixed transition-colors flex items-center gap-1.5"
              title="View Product Details"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Get Now</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
