"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CheckCircle2, XCircle, ArrowLeft, Download, FileText, Clock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-client";

interface OrderDetailClientProps {
  order: any;
  isAuthenticated: boolean;
}

export default function OrderDetailClient({ order, isAuthenticated }: OrderDetailClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSignIn } = useAuth();

  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <div className="bg-background min-h-screen flex flex-col">
          <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
          <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />
          <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full flex flex-col items-center justify-center text-center gap-6">
            <h1 className="text-4xl font-bold text-white mb-4">Order Details</h1>
            <p className="text-xl text-on-surface-variant">Sign in to view this order.</p>
            <button
              onClick={openSignIn}
              className="px-8 py-4 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Sign In to Continue
            </button>
          </main>
          <Footer />
        </div>
      </ThemeProvider>
    );
  }

  const isPaid = order.paymentStatus === "PAID";

  return (
    <ThemeProvider>
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-20 px-6 max-w-[850px] mx-auto w-full">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mb-8 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Orders
          </Link>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Status Banner */}
            <div
              className={`px-8 py-6 flex items-center gap-4 border-b border-white/10 ${
                isPaid ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20"
              }`}
            >
              {isPaid ? (
                <CheckCircle2 className="w-10 h-10 text-green-400 shrink-0" />
              ) : (
                <Clock className="w-10 h-10 text-yellow-400 shrink-0" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {isPaid ? "Payment Confirmed" : "Payment Pending"}
                </h1>
                <p className="text-sm text-on-surface-variant">Order ID: {order.id}</p>
              </div>
            </div>

            <div className="p-8">
              {/* Order Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8 pb-8 border-b border-white/10">
                <div>
                  <p className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider mb-1">Order Date</p>
                  <p className="font-bold text-white text-sm">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="font-bold text-primary text-sm">₹{(order.totalAmount / 100).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider mb-1">Status</p>
                  <p className={`font-bold text-sm ${isPaid ? "text-green-400" : "text-yellow-400"}`}>
                    {order.status}
                  </p>
                </div>
                {order.razorpayPaymentId && (
                  <div className="col-span-2 sm:col-span-3 pt-2">
                    <p className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider mb-1">
                      Razorpay Payment Reference
                    </p>
                    <p className="font-mono text-xs text-white/80 bg-white/5 px-3 py-1.5 rounded-lg w-fit border border-white/5">
                      {order.razorpayPaymentId}
                    </p>
                  </div>
                )}
              </div>

              {/* Items Section */}
              <h2 className="text-xl font-bold text-white mb-6">Purchased Automations & Downloads</h2>
              <div className="flex flex-col gap-6">
                {order.items.map((item: any) => {
                  const files = item.automation?.files || [];

                  return (
                    <div
                      key={item.id}
                      className="p-5 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-4"
                    >
                      <div className="flex gap-4">
                        <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-black/40 shrink-0">
                          {item.automation?.thumbnailUrl && (
                            <Image
                              src={item.automation.thumbnailUrl}
                              alt={item.titleSnapshot}
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <Link
                            href={item.automation ? `/automations/${item.automation.slug}` : "#"}
                            className="font-bold text-white hover:text-primary transition-colors block mb-1 text-base sm:text-lg"
                          >
                            {item.titleSnapshot}
                          </Link>
                          <p className="text-sm text-primary font-bold">
                            ₹{(item.priceSnapshot / 100).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Download Section */}
                      <div className="border-t border-white/5 pt-4">
                        {isPaid ? (
                          files.length > 0 ? (
                            <div>
                              <p className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-green-400" />
                                Authorized Download Files:
                              </p>
                              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                                {files.map((file: any) => (
                                  <a
                                    key={file.id}
                                    href={`/api/orders/${order.id}/download/${file.id}`}
                                    download
                                    className="inline-flex items-center justify-between sm:justify-start gap-3 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(0,219,238,0.1)]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 shrink-0" />
                                      <span>{file.title}</span>
                                    </div>
                                    <Download className="w-4 h-4 shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-on-surface-variant flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span>No separate attachment files required for this item. Contact support for setup assistance.</span>
                            </div>
                          )
                        ) : (
                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">
                            Download available after payment confirmation.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
