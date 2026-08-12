"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Trash2, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth-client";

interface WishlistItem {
  automation: {
    id: string;
    title: string;
    slug: string;
    price: number;
    originalPrice: number | null;
    thumbnailUrl: string | null;
    status: string;
  };
}

export default function WishlistClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { userId, isLoaded, openSignIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !userId) {
      setIsLoading(false);
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!userId) return;
    
    const fetchWishlist = async () => {
      try {
        const res = await fetch("/api/wishlist");
        if (res.ok) {
          const data = await res.json();
          setWishlistItems(data.wishlist.items || []);
        }
      } catch (err) {
        console.error("Failed to load wishlist", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWishlist();
  }, [userId]);

  const handleRemove = async (automationId: string) => {
    try {
      const res = await fetch(`/api/wishlist?automationId=${automationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWishlistItems(prev => prev.filter(item => item.automation.id !== automationId));
        toast.success("Item removed from wishlist");
      } else {
        throw new Error("Failed to remove item");
      }
    } catch (err) {
      toast.error("Failed to remove item");
    }
  };

  const handleAddToCart = async (automationId: string) => {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId }),
      });
      
      if (res.ok) {
        toast.success("Added to cart");
      } else {
        throw new Error("Failed to add to cart");
      }
    } catch (err) {
      toast.error("Failed to add to cart");
    }
  };

  // Unauthenticated state — show a proper page instead of a blank screen
  if (isLoaded && !userId) {
    return (
      <ThemeProvider>
        <div className="bg-background min-h-screen flex flex-col">
          <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
          <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />
          <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full flex flex-col items-center justify-center text-center gap-6">
            <h1 className="text-4xl font-bold text-white">My Wishlist</h1>
            <p className="text-xl text-on-surface-variant max-w-md">
              Sign in to save automations to your wishlist.
            </p>
            <button
              onClick={openSignIn}
              className="px-8 py-4 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-all active:scale-95"
            >
              Sign In to Continue
            </button>
          </main>
          <Footer />
        </div>
      </ThemeProvider>
    );
  }

  if (!isLoaded) return <div className="min-h-screen bg-background" />;

  return (
    <ThemeProvider>
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full">
          <h1 className="text-4xl font-bold text-white mb-8">My Wishlist</h1>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary-fixed animate-spin" />
            </div>
          ) : wishlistItems.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-xl text-on-surface-variant mb-6">Your wishlist is empty.</p>
              <Link 
                href="/automations"
                className="inline-flex px-6 py-3 bg-primary-container text-on-primary-container font-bold rounded-xl hover:bg-primary-fixed transition-colors"
              >
                Browse Automations
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlistItems.map((item) => (
                <div key={item.automation.id} className="group flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300">
                  <Link href={`/automations/${item.automation.slug}`} className="relative aspect-video w-full bg-black/40">
                    {item.automation.thumbnailUrl && (
                      <Image src={item.automation.thumbnailUrl} alt={item.automation.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    )}
                  </Link>
                  <div className="flex flex-col p-5 flex-1">
                    <Link href={`/automations/${item.automation.slug}`} className="font-bold text-lg text-white hover:text-primary-fixed-dim transition-colors mb-4">
                      {item.automation.title}
                    </Link>
                    
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-bold text-xl text-primary-fixed-dim">
                        ₹{(item.automation.price / 100).toLocaleString()}
                      </span>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRemove(item.automation.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full transition-colors"
                          title="Remove from wishlist"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleAddToCart(item.automation.id)}
                          className="p-2 text-primary-fixed-dim hover:bg-primary-fixed-dim/20 rounded-full transition-colors"
                          title="Add to Cart"
                        >
                          <ShoppingCart className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
