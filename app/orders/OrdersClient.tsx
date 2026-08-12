"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Package, ExternalLink, Download } from "lucide-react";
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
              {orders.map((order) => (
                <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                      <div>
                        <p className="text-on-surface-variant">Order Placed</p>
                        <p className="font-bold text-white">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-on-surface-variant">Total</p>
                        <p className="font-bold text-white">₹{(order.totalAmount / 100).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-on-surface-variant">Order #</p>
                        <p className="font-bold text-white">{order.id}</p>
                      </div>
                    </div>
                    
                    <Link 
                      href={`/orders/${order.id}`}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      View Details
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                  
                  <div className="p-6 flex flex-col gap-4">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="relative w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-black/40">
                          {item.automation?.thumbnailUrl && (
                            <Image src={item.automation.thumbnailUrl} alt={item.titleSnapshot} fill className="object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <Link 
                            href={item.automation ? `/automations/${item.automation.slug}` : "#"} 
                            className="font-bold text-lg text-white hover:text-primary-fixed-dim transition-colors mb-1 block"
                          >
                            {item.titleSnapshot}
                          </Link>
                          {order.paymentStatus === "PAID" && (
                            <button className="text-primary-fixed-dim hover:text-primary-fixed text-sm font-bold flex items-center gap-1 mt-2 transition-colors">
                              <Download className="w-4 h-4" />
                              Download Files
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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
