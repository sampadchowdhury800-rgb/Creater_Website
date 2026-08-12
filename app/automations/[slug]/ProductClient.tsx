"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import MediaCarousel from "@/components/automations/MediaCarousel";
import ShareButton from "@/components/automations/ShareButton";
import ReviewsSection from "@/components/automations/ReviewsSection";
import CommentsSection from "@/components/automations/CommentsSection";
import { ShoppingCart, Heart, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth-client";

interface ProductClientProps {
  automation: any; // we can type this better later
}

export default function ProductClient({ automation }: ProductClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { userId, openSignIn } = useAuth();

  const handleAddToCart = async () => {
    if (!userId) {
      openSignIn();
      return;
    }
    
    setIsAddingToCart(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId: automation.id }),
      });
      
      if (!res.ok) throw new Error("Failed to add to cart");
      toast.success("Added to cart!");
    } catch (err) {
      toast.error("Failed to add to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlist = async () => {
    if (!userId) {
      openSignIn();
      return;
    }
    
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId: automation.id }),
      });
      
      if (!res.ok) throw new Error("Failed to add to wishlist");
      toast.success("Added to wishlist!");
    } catch (err) {
      toast.error("Failed to add to wishlist. Please try again.");
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <ThemeProvider>
      <div className="bg-background dark:bg-background selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Left: Media */}
            <div className="lg:w-3/5">
              <MediaCarousel media={automation.media} />
            </div>

            {/* Right: Info & Actions */}
            <div className="lg:w-2/5 flex flex-col">
              {automation.category && (
                <span className="text-sm font-label-caps tracking-widest text-primary-fixed-dim uppercase mb-3">
                  {automation.category.name}
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {automation.title}
              </h1>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-primary-fixed-dim">
                    ₹{(automation.price / 100).toLocaleString()}
                  </span>
                  {automation.originalPrice && automation.originalPrice > automation.price && (
                    <span className="text-lg text-on-surface-variant line-through mb-1">
                      ₹{(automation.originalPrice / 100).toLocaleString()}
                    </span>
                  )}
                </div>
                {automation.originalPrice && automation.originalPrice > automation.price && (
                  <span className="bg-red-500/20 text-red-400 font-bold px-2 py-1 rounded text-sm">
                    Save {Math.round(((automation.originalPrice - automation.price) / automation.originalPrice) * 100)}%
                  </span>
                )}
              </div>

              {automation.description && (
                <div className="prose prose-invert prose-p:text-on-surface-variant prose-headings:text-white max-w-none mb-8">
                  {automation.description.split("\n").map((para: string, idx: number) => (
                    <p key={idx} className="mb-4">{para}</p>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mb-8">
                <button 
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="w-full py-4 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {isAddingToCart ? "Adding..." : "Add to Cart"}
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={handleWishlist}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Heart className="w-5 h-5" />
                    Wishlist
                  </button>
                  <ShareButton title={automation.title} url={shareUrl} />
                </div>
              </div>

              {/* Features & Requirements */}
              {(automation.features?.length > 0 || automation.requirements?.length > 0) && (
                <div className="border-t border-white/10 pt-8 mt-4 flex flex-col gap-8">
                  {automation.features?.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4">Features</h3>
                      <ul className="flex flex-col gap-3">
                        {automation.features.map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-3 text-on-surface-variant">
                            <CheckCircle2 className="w-5 h-5 text-primary-fixed-dim shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {automation.requirements?.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4">Requirements</h3>
                      <ul className="flex flex-col gap-3 list-disc pl-5 text-on-surface-variant">
                        {automation.requirements.map((req: string, idx: number) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <ReviewsSection slug={automation.slug} />
          <CommentsSection slug={automation.slug} />
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
