"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Package, ExternalLink, Download, FileText, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-client";

interface OrdersClientProps {
  orders: any[];
  isAuthenticated: boolean;
}

export default function OrdersClient({ orders, isAuthenticated }: OrdersClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSignIn } = useAuth();

  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <div className="bg-background min-h-screen flex flex-col">
          <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
          <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />
          <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full flex flex-col items-center justify-center text-center gap-6">
            <h1 className="text-4xl font-bold text-white">My Orders</h1>
            <p className="text-xl text-on-surface-variant max-w-md">
              Sign in to view your purchase history and access your downloads.
            </p>
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

  return (
    <ThemeProvider>
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-32 pb-20 px-6 max-w-[1200px] mx-auto w-full">
          <div className="flex items-center gap-3 mb-8">
            <Package className="w-8 h-8 text-primary-fixed-dim" />
            <h1 className="text-4xl font-bold text-white">My Orders</h1>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-xl text-on-surface-variant mb-6">You haven&apos;t placed any orders yet.</p>
              <Link
                href="/automations"
                className="inline-flex px-6 py-3 bg-primary-container text-on-primary-container font-bold rounded-xl hover:bg-primary-fixed transition-colors"
              >
                Browse Automations
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {orders.map((order) => {
                const isPaid = order.paymentStatus === "PAID";

                return (
                  <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        <div>
                          <p className="text-on-surface-variant">Order Placed</p>
                          <p className="font-bold text-white">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-on-surface-variant">Total</p>
                          <p className="font-bold text-primary">₹{(order.totalAmount / 100).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-on-surface-variant">Status</p>
                          <div className="flex items-center gap-1.5 font-bold">
                            {isPaid ? (
                              <span className="text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> PAID
                              </span>
                            ) : (
                              <span className="text-yellow-400 flex items-center gap-1">
                                <Clock className="w-4 h-4" /> PENDING
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-on-surface-variant">Order #</p>
                          <p className="font-mono text-white text-xs md:text-sm mt-0.5">{order.id}</p>
                        </div>
                      </div>

                      <Link
                        href={`/orders/${order.id}`}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        View Details
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>

                    <div className="p-6 flex flex-col gap-6">
                      {order.items.map((item: any) => {
                        const files = item.automation?.files || [];

                        return (
                          <div key={item.id} className="flex flex-col md:flex-row gap-4 border-b border-white/5 last:border-0 pb-6 last:pb-0">
                            <div className="relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-black/40 shrink-0">
                              {item.automation?.thumbnailUrl && (
                                <Image
                                  src={item.automation.thumbnailUrl}
                                  alt={item.titleSnapshot}
                                  fill
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <Link
                                  href={item.automation ? `/automations/${item.automation.slug}` : "#"}
                                  className="font-bold text-lg text-white hover:text-primary transition-colors mb-1 block"
                                >
                                  {item.titleSnapshot}
                                </Link>
                                <p className="text-sm text-on-surface-variant">
                                  ₹{(item.priceSnapshot / 100).toLocaleString()}
                                </p>
                              </div>

                              <div className="mt-4">
                                {isPaid ? (
                                  files.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {files.map((file: any) => (
                                        <a
                                          key={file.id}
                                          href={`/api/orders/${order.id}/download/${file.id}`}
                                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-colors"
                                          download
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          <span>Download {file.title}</span>
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-on-surface-variant flex items-center gap-1">
                                      <FileText className="w-3.5 h-3.5" />
                                      Digital resource included
                                    </p>
                                  )
                                ) : (
                                  <p className="text-xs text-yellow-400/80">
                                    Download available after payment confirmation.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
