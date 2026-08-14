"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Trash2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth-client";
import { loadRazorpayScript } from "@/lib/razorpay-client";

interface CartItem {
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

export default function CartClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const { userId, isLoaded, openSignIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !userId) {
      setIsLoading(false);
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!userId) return;

    const fetchCart = async () => {
      try {
        const res = await fetch("/api/cart");
        if (res.ok) {
          const data = await res.json();
          setCartItems(data.cart?.items || []);
        }
      } catch (err) {
        console.error("Failed to load cart", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCart();
  }, [userId]);

  const handleRemove = async (automationId: string) => {
    try {
      const res = await fetch(`/api/cart?automationId=${automationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCartItems((prev) => prev.filter((item) => item.automation.id !== automationId));
        toast.success("Item removed from cart");
      } else {
        throw new Error("Failed to remove item");
      }
    } catch (err) {
      toast.error("Failed to remove item");
    }
  };

  const handleCheckout = async () => {
    if (!userId) {
      openSignIn();
      return;
    }

    if (cartItems.length === 0) {
      toast.info("Your cart is empty.");
      return;
    }

    setIsProcessing(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load Razorpay checkout gateway. Please check your internet connection.");
        setIsProcessing(false);
        return;
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok || !data.razorpayOrderId) {
        throw new Error(data.error || "Failed to create order");
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "Chowdhury Duo",
        description: "Automation Marketplace Order",
        order_id: data.razorpayOrderId,
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyRes = await fetch("/api/orders/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              toast.success("Payment successful!");
              router.push(`/orders/${data.orderId}`);
            } else {
              toast.error(verifyData.error || "Payment verification failed. Please contact support.");
            }
          } catch (err) {
            console.error("Verification error:", err);
            toast.error("Error verifying payment.");
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
        theme: {
          color: "#00DBEE",
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.on("payment.failed", function (failResponse: any) {
        console.error("Payment failed:", failResponse);
        toast.error(failResponse?.error?.description || "Payment failed.");
        setIsProcessing(false);
      });
      razorpay.open();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Failed to process checkout.");
      setIsProcessing(false);
    }
  };

  const total = cartItems.reduce((acc, item) => acc + item.automation.price, 0);

  if (isLoaded && !userId) {
    return (
      <ThemeProvider>
        <div className="bg-background min-h-screen flex flex-col">
          <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
          <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />
          <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full flex flex-col items-center justify-center text-center gap-6">
            <h1 className="text-4xl font-bold text-white">Shopping Cart</h1>
            <p className="text-xl text-on-surface-variant max-w-md">
              Sign in to access your cart and purchase automations.
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
          <h1 className="text-4xl font-bold text-white mb-8">Shopping Cart</h1>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary-fixed animate-spin" />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-xl text-on-surface-variant mb-6">Your cart is empty.</p>
              <Link
                href="/automations"
                className="inline-flex px-6 py-3 bg-primary-container text-on-primary-container font-bold rounded-xl hover:bg-primary-fixed transition-colors"
              >
                Browse Automations
              </Link>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Cart Items */}
              <div className="flex-1 flex flex-col gap-4">
                {cartItems.map((item) => (
                  <div
                    key={item.automation.id}
                    className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl"
                  >
                    <div className="relative w-full sm:w-32 aspect-video rounded-lg overflow-hidden bg-black/40">
                      {item.automation.thumbnailUrl && (
                        <Image
                          src={item.automation.thumbnailUrl}
                          alt={item.automation.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col">
                      <Link
                        href={`/automations/${item.automation.slug}`}
                        className="text-lg font-bold text-white hover:text-primary-fixed-dim transition-colors mb-1"
                      >
                        {item.automation.title}
                      </Link>
                      <span className="text-primary-fixed-dim font-bold">
                        ₹{(item.automation.price / 100).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemove(item.automation.id)}
                      className="p-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="w-full lg:w-80 h-fit p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col">
                <h2 className="text-xl font-bold text-white mb-6">Order Summary</h2>

                <div className="flex justify-between items-center mb-4 text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>₹{(total / 100).toLocaleString()}</span>
                </div>

                <div className="border-t border-white/10 pt-4 mb-6 flex justify-between items-center text-lg font-bold text-white">
                  <span>Total</span>
                  <span className="text-primary-fixed-dim">₹{(total / 100).toLocaleString()}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="w-full py-4 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Checkout</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
