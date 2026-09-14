"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import MediaCarousel from "@/components/automations/MediaCarousel";
import ShareButton from "@/components/automations/ShareButton";
import ReviewsSection from "@/components/automations/ReviewsSection";
import CommentsSection from "@/components/automations/CommentsSection";
import {
  ShoppingCart,
  Heart,
  CheckCircle2,
  Zap,
  Loader2,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth-client";
import { loadRazorpayScript } from "@/lib/razorpay-client";

interface PlanItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  planType: "TRIAL" | "TIME_LIMITED" | "LIFETIME";
  price: number; // in paise
  originalPrice: number | null;
  durationDays: number | null;
  trialDays: number | null;
  maintenanceEnabled: boolean;
  maintenancePrice: number; // in paise
  maintenanceInterval: string;
  isPopular: boolean;
}

interface AccessResultData {
  hasAccess: boolean;
  reason: string;
  remainingDays: number | null;
  isLifetime: boolean;
  isTrial: boolean;
  maintenanceStatus: string;
  errorMessage: string | null;
}

interface ProductClientProps {
  automation: any;
  existingUserAutomationId?: string | null;
  accessResult?: AccessResultData | null;
}

export default function ProductClient({
  automation,
  existingUserAutomationId,
  accessResult,
}: ProductClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [isClaimingTrial, setIsClaimingTrial] = useState(false);
  const [isAddingToMyAutomations, setIsAddingToMyAutomations] = useState(false);
  const { userId, openSignIn } = useAuth();
  const router = useRouter();

  const plans: PlanItem[] = automation.plans || [];
  const trialPlan = plans.find((p) => p.planType === "TRIAL");
  const paidPlans = plans.filter((p) => p.planType !== "TRIAL");

  // Default to first paid plan or first plan
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    paidPlans[0]?.id || plans[0]?.id || ""
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const isFreeProduct =
    (automation.price === 0 || automation.pricingType === "FREE") && plans.length === 0;

  // Active entitlement status
  const hasActiveAccess = accessResult?.hasAccess ?? false;
  const isExpired =
    accessResult && !accessResult.hasAccess && ["EXPIRED", "TRIAL_EXPIRED"].includes(accessResult.reason);

  const handleStartTrial = async () => {
    if (!userId) {
      openSignIn();
      return;
    }

    setIsClaimingTrial(true);
    try {
      const res = await fetch(`/api/automations/${automation.id}/trial`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to activate free trial.");

      toast.success(`Free trial activated for ${data.trialDays} days!`);
      if (data.userAutomationId) {
        router.push(`/my-automations/${data.userAutomationId}`);
      } else {
        router.push("/my-automations");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start trial.");
    } finally {
      setIsClaimingTrial(false);
    }
  };

  const handleBuyNow = async () => {
    if (!userId) {
      openSignIn();
      return;
    }

    setIsBuyingNow(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load Razorpay checkout gateway. Please check your internet connection.");
        setIsBuyingNow(false);
        return;
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automationId: automation.id,
          planId: selectedPlan?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.razorpayOrderId) {
        throw new Error(data.error || "Failed to initiate purchase.");
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "Chowdhury Duo",
        description: selectedPlan ? `Purchase ${automation.title} (${selectedPlan.name})` : `Purchase ${automation.title}`,
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
              toast.success("Payment successful! Automation entitlement activated.");
              if (verifyData.userAutomationId) {
                router.push(`/my-automations/${verifyData.userAutomationId}`);
              } else {
                router.push("/my-automations");
              }
            } else {
              toast.error(verifyData.error || "Payment verification failed. Please contact support.");
            }
          } catch (err) {
            console.error("Verification error:", err);
            toast.error("Error verifying payment.");
          } finally {
            setIsBuyingNow(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsBuyingNow(false);
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
        setIsBuyingNow(false);
      });
      razorpay.open();
    } catch (err: any) {
      console.error("Buy Now error:", err);
      toast.error(err.message || "Failed to process purchase.");
      setIsBuyingNow(false);
    }
  };

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
        body: JSON.stringify({
          automationId: automation.id,
          planId: selectedPlan?.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to add to cart");
      toast.success(`Added ${selectedPlan ? `${selectedPlan.name} to cart!` : "to cart!"}`);
    } catch (err) {
      toast.error("Failed to add to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleAddToMyAutomations = async () => {
    if (!userId) {
      openSignIn();
      return;
    }

    setIsAddingToMyAutomations(true);
    try {
      const res = await fetch("/api/user-automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId: automation.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add to My Automations");
      toast.success("Added to My Automations!");
      if (data.userAutomation?.id) {
        router.push(`/my-automations/${data.userAutomation.id}`);
      } else {
        router.push("/my-automations");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add to My Automations.");
    } finally {
      setIsAddingToMyAutomations(false);
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

  const canonicalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/automations/${automation.slug}`
      : `/automations/${automation.slug}`;

  // Current display price based on selected plan or fallback
  const currentPricePaise = selectedPlan ? selectedPlan.price : automation.price;
  const currentOriginalPricePaise = selectedPlan ? selectedPlan.originalPrice : automation.originalPrice;

  return (
    <ThemeProvider>
      <div className="bg-background selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Left: Media */}
            <div className="lg:w-3/5">
              <MediaCarousel media={automation.media} />
            </div>

            {/* Right: Info & Plans */}
            <div className="lg:w-2/5 flex flex-col">
              {automation.category && (
                <span className="text-sm font-label-caps tracking-widest text-primary-fixed-dim uppercase mb-3">
                  {automation.category.name}
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
                {automation.title}
              </h1>

              {/* Status Banner for Active / Expired users */}
              {hasActiveAccess && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Active License</p>
                      <p className="text-xs text-emerald-300">
                        {accessResult?.isLifetime
                          ? "Lifetime Perpetual Access"
                          : accessResult?.remainingDays !== null
                          ? `${accessResult?.remainingDays} days remaining`
                          : "Access Active"}
                      </p>
                    </div>
                  </div>
                  {existingUserAutomationId && (
                    <button
                      onClick={() => router.push(`/my-automations/${existingUserAutomationId}`)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Workspace</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}

              {isExpired && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">Access Expired</p>
                    <p className="text-xs text-amber-300">
                      Your previous pass has ended. Choose a plan below to renew execution rights.
                    </p>
                  </div>
                </div>
              )}

              {/* Free Trial Banner if available */}
              {trialPlan && !hasActiveAccess && (
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-[#111622] border border-cyan-500/30 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold uppercase tracking-wider">
                      <Zap size={14} className="fill-current" />
                      <span>{trialPlan.trialDays}-Day Free Trial</span>
                    </div>
                    <p className="text-xs text-gray-300">
                      Test all workflow capabilities with zero credit card commitment.
                    </p>
                  </div>
                  <button
                    onClick={handleStartTrial}
                    disabled={isClaimingTrial}
                    className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs transition-all active:scale-95 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {isClaimingTrial ? "Activating..." : "Start Trial"}
                  </button>
                </div>
              )}

              {/* Dynamic Pricing Plan Selector */}
              {paidPlans.length > 0 && (
                <div className="mb-6 space-y-3">
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-400 font-bold">
                    Choose Your Access Plan
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {paidPlans.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                            isSelected
                              ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,219,238,0.15)]"
                              : "bg-white/80 dark:bg-white/5 border-black/10 dark:border-white/10 hover:border-cyan-500/40 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/[0.07]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? "border-primary bg-primary" : "border-gray-400 dark:border-gray-500"
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{plan.name}</span>
                                {plan.isPopular && (
                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/20 text-cyan-800 dark:text-primary font-bold">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                                <Clock size={12} />
                                <span>
                                  {plan.planType === "LIFETIME"
                                    ? "Lifetime Access"
                                    : `${plan.durationDays} Days Pass`}
                                </span>
                                {plan.maintenanceEnabled && (
                                  <span className="text-cyan-700 dark:text-cyan-300">
                                    • +₹{(plan.maintenancePrice / 100).toLocaleString()}/mo maint.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-slate-900 dark:text-white">
                              ₹{(plan.price / 100).toLocaleString()}
                            </span>
                            {plan.originalPrice && plan.originalPrice > plan.price && (
                              <span className="block text-[11px] line-through text-gray-500">
                                ₹{(plan.originalPrice / 100).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price summary if no plans or single plan */}
              {paidPlans.length === 0 && (
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-primary-fixed-dim">
                      {isFreeProduct ? "Free" : `₹${(automation.price / 100).toLocaleString()}`}
                    </span>
                    {automation.originalPrice && automation.originalPrice > automation.price && (
                      <span className="text-lg text-on-surface-variant line-through mb-1">
                        ₹{(automation.originalPrice / 100).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {automation.description && (
                <div className="prose dark:prose-invert prose-p:text-on-surface-variant prose-headings:text-slate-900 dark:prose-headings:text-white max-w-none mb-8 text-sm">
                  {automation.description.split("\n").map((para: string, idx: number) => (
                    <p key={idx} className="mb-3">{para}</p>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mb-8">
                {isFreeProduct ? (
                  <button
                    onClick={handleAddToMyAutomations}
                    disabled={isAddingToMyAutomations}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-70"
                  >
                    {isAddingToMyAutomations ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Adding to Workspace...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Add to My Automations (Free)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleBuyNow}
                      disabled={isBuyingNow}
                      className="w-full py-4 bg-primary text-black hover:bg-primary-fixed font-extrabold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,219,238,0.3)] disabled:opacity-70 disabled:active:scale-100 cursor-pointer"
                    >
                      {isBuyingNow ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Initiating Checkout...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 fill-current" />
                          <span>
                            {hasActiveAccess
                              ? `Renew / Upgrade: ${selectedPlan ? selectedPlan.name : "Plan"}`
                              : `Purchase: ${selectedPlan ? selectedPlan.name : "Automation"}`}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleAddToCart}
                      disabled={isAddingToCart}
                      className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10 disabled:opacity-70 disabled:active:scale-100 cursor-pointer"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {isAddingToCart ? "Adding..." : "Add to Cart"}
                    </button>
                  </>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleWishlist}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Heart className="w-5 h-5" />
                    Wishlist
                  </button>
                  <ShareButton title={automation.title} url={canonicalUrl} />
                </div>
              </div>

              {/* Features List */}
              {automation.features && automation.features.length > 0 && (
                <div className="border-t border-white/10 pt-6 space-y-4">
                  <h3 className="text-lg font-bold text-white">Features</h3>
                  <ul className="space-y-2">
                    {automation.features.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 text-on-surface-variant text-sm">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Integrations List */}
              {automation.integrations && automation.integrations.length > 0 && (
                <div className="border-t border-white/10 pt-6 mt-6 space-y-3">
                  <h3 className="text-sm font-mono uppercase tracking-wider text-gray-400">
                    Supported Integrations
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {automation.integrations.map((item: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-gray-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Social Proof & Comments */}
          <div className="mt-20 border-t border-white/10 pt-16">
            <ReviewsSection slug={automation.slug} />
            <div className="mt-16 border-t border-white/10 pt-16">
              <CommentsSection slug={automation.slug} />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
