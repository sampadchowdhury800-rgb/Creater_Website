"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star, Zap, CheckCircle2 } from "lucide-react";
import ShareButton from "@/components/ShareButton";

export interface AutomationCardProps {
  automation: {
    id: string;
    slug: string;
    title: string;
    shortDesc: string | null;
    price: number;
    originalPrice: number | null;
    pricingType?: "ONE_TIME" | "SUBSCRIPTION" | "FREE";
    featured?: boolean;
    thumbnailUrl: string | null;
    ratingSum: number;
    reviewCount: number;
    integrations?: string[];
    category?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
}

export default function AutomationCard({ automation }: AutomationCardProps) {
  const averageRating =
    automation.reviewCount > 0
      ? (automation.ratingSum / automation.reviewCount).toFixed(1)
      : 0;

  const canonicalUrl = `/automations/${automation.slug}`;

  const formatPrice = () => {
    if (automation.pricingType === "FREE" || automation.price === 0) {
      return <span className="font-bold text-lg text-emerald-600">Free</span>;
    }
    const formatted = `₹${(automation.price / 100).toLocaleString()}`;
    if (automation.pricingType === "SUBSCRIPTION") {
      return (
        <span className="font-bold text-lg text-slate-900">
          {formatted}<span className="text-xs font-normal text-slate-500">/mo</span>
        </span>
      );
    }
    return <span className="font-bold text-lg text-slate-900">{formatted}</span>;
  };

  return (
    <div className="group relative flex flex-col bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:shadow-xl hover:border-blue-500/40 transition-all duration-300">
      {/* Top Bar Badges */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5">
          {automation.featured && (
            <span className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full shadow-sm pointer-events-auto">
              Featured
            </span>
          )}
          {automation.category && (
            <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-medium rounded-full shadow-sm pointer-events-auto">
              {automation.category.name}
            </span>
          )}
        </div>
        <div className="pointer-events-auto">
          <ShareButton
            title={automation.title}
            url={canonicalUrl}
            iconOnly
            className="p-2 bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 backdrop-blur-md border border-slate-200 rounded-full shadow-sm transition-transform active:scale-95"
          />
        </div>
      </div>

      {/* Thumbnail */}
      <Link href={canonicalUrl} className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 block">
        {automation.thumbnailUrl ? (
          <Image
            src={automation.thumbnailUrl}
            alt={automation.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 text-slate-400">
            <Zap className="w-8 h-8 mb-1 text-blue-400 opacity-60" />
            <span className="text-xs font-medium">Automation Product</span>
          </div>
        )}

        {/* Discount Badge */}
        {automation.originalPrice && automation.originalPrice > automation.price && automation.price > 0 && (
          <div className="absolute bottom-3 right-3 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
            Save {Math.round(((automation.originalPrice - automation.price) / automation.originalPrice) * 100)}%
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <div className="mb-2">
          <Link href={canonicalUrl} className="group-hover:text-blue-600 transition-colors">
            <h3 className="font-bold text-base text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
              {automation.title}
            </h3>
          </Link>
        </div>

        {automation.shortDesc && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-4 flex-1 leading-relaxed">
            {automation.shortDesc}
          </p>
        )}

        {/* Integrations Badges */}
        {automation.integrations && automation.integrations.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {automation.integrations.slice(0, 3).map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded-md border border-blue-100">
                <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" />
                {item}
              </span>
            ))}
            {automation.integrations.length > 3 && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md">
                +{automation.integrations.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Rating */}
        {automation.reviewCount > 0 && (
          <div className="flex items-center gap-1 mb-4 text-xs text-amber-500">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="font-semibold text-slate-900">{averageRating}</span>
            <span className="text-slate-400">({automation.reviewCount})</span>
          </div>
        )}

        {/* Footer: Price & View Details */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            <div className="flex items-baseline gap-1.5">
              {formatPrice()}
              {automation.originalPrice && automation.originalPrice > automation.price && (
                <span className="text-xs text-slate-400 line-through">
                  ₹{(automation.originalPrice / 100).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <Link
            href={canonicalUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm hover:shadow-blue-500/20 active:scale-95"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
