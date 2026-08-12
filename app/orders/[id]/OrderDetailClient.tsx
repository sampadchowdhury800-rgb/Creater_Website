"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CheckCircle2, XCircle, ArrowLeft, Download } from "lucide-react";
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

  const isPaid = order.paymentStatus === "PAID";

  return (
    <ThemeProvider>
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />
        
        <main className="flex-1 pt-32 pb-20 px-6 max-w-[800px] mx-auto w-full">
          <Link href="/orders" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </Link>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className={`px-8 py-6 flex items-center gap-4 border-b border-white/10 ${isPaid ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {isPaid ? (
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              ) : (
                <XCircle className="w-10 h-10 text-red-400" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {isPaid ? "Payment Successful" : "Payment Pending / Failed"}
                </h1>
                <p className="text-on-surface-variant">Order #{order.id}</p>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-white/10">
                <div>
                  <p className="text-sm text-on-surface-variant mb-1">Date</p>
                  <p className="font-bold text-white">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant mb-1">Total Amount</p>
                  <p className="font-bold text-primary-fixed-dim">₹{(order.totalAmount / 100).toLocaleString()}</p>
                </div>
                {order.razorpayPaymentId && (
                  <div className="col-span-2">
                    <p className="text-sm text-on-surface-variant mb-1">Transaction ID</p>
                    <p className="font-mono text-white">{order.razorpayPaymentId}</p>
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-white mb-6">Items Ordered</h2>
              <div className="flex flex-col gap-6">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black/40">
                      {item.automation?.thumbnailUrl && (
                        <Image src={item.automation.thumbnailUrl} alt={item.titleSnapshot} fill className="object-cover" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Link 
                        href={item.automation ? `/automations/${item.automation.slug}` : "#"} 
                        className="font-bold text-white hover:text-primary-fixed-dim transition-colors block mb-1"
                      >
                        {item.titleSnapshot}
                      </Link>
                      <p className="text-sm text-on-surface-variant mb-3">₹{(item.priceSnapshot / 100).toLocaleString()}</p>
                      
                      {isPaid ? (
                        <button className="px-4 py-2 bg-primary-container hover:bg-primary-fixed text-on-primary-container text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Download Resource
                        </button>
                      ) : (
                        <p className="text-sm text-red-400">Payment required to download</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
