"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  publicId?: string;
}

interface MediaCarouselProps {
  media: MediaItem[];
}

export default function MediaCarousel({ media }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  if (!media || media.length === 0) {
    return (
      <div className="w-full aspect-video bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center text-on-surface-variant">
        No media available
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Main Display */}
      <div 
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/10 group select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div 
          ref={containerRef}
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {media.map((item, idx) => (
            <div key={item.id || idx} className="w-full h-full flex-shrink-0 relative flex items-center justify-center">
              {item.type === "VIDEO" ? (
                <video 
                  src={item.url} 
                  controls 
                  playsInline
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Image
                  src={item.url}
                  alt={`Media ${idx + 1}`}
                  fill
                  className="object-contain"
                  priority={idx === 0}
                />
              )}
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {media.length > 1 && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); prevSlide(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white backdrop-blur border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); nextSlide(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white backdrop-blur border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {media.map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative h-20 w-32 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors snap-center ${
                currentIndex === idx ? "border-primary-fixed-dim" : "border-transparent hover:border-white/20"
              }`}
            >
              {item.type === "VIDEO" ? (
                <div className="w-full h-full bg-black/60 flex items-center justify-center relative">
                  <video src={item.url} className="w-full h-full object-cover opacity-50" />
                  <Play className="absolute w-6 h-6 text-white" />
                </div>
              ) : (
                <Image
                  src={item.url}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
