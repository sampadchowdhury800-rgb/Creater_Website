"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Zap, ExternalLink, ArrowRight, Layers, Lock, AlertCircle, CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-client";

interface MyAutomationsClientProps {
  userAutomations: any[];
  isAuthenticated: boolean;
}

export default function MyAutomationsClient({ userAutomations, isAuthenticated }: MyAutomationsClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { openSignIn } = useAuth();

  const filtered = userAutomations.filter((item) => {
    if (!searchQuery) return true;
    const title = item.automation?.title || "";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <ThemeProvider>
      <div className="bg-[#FAFAFA] dark:bg-[#FAFAFA] text-slate-900 min-h-screen flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                User SaaS Dashboard
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                My Automations
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                View, manage, and access workspace settings for your business automation products.
              </p>
            </div>

            <Link
              href="/automations"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 shrink-0"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {!isAuthenticated ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
              <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sign in required</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                Please sign in to access your automation workspace and view your active automation products.
              </p>
              <button
                onClick={() => openSignIn()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">You haven't added any automations yet</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Explore the marketplace to discover business automation products designed to save you hours of work.
              </p>
              <Link
                href="/automations"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
              >
                <span>Explore Automations</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search filter for user's owned automations */}
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search my automations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((item) => {
                  const auto = item.automation;
                  if (!auto) return null;

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          {auto.category && (
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-md">
                              {auto.category.name}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            Not configured
                          </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-1">
                          {auto.title}
                        </h3>

                        {auto.shortDesc && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                            {auto.shortDesc}
                          </p>
                        )}

                        {auto.integrations && auto.integrations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-6">
                            {auto.integrations.map((ig: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded border border-blue-100">
                                {ig}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Added {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                        <Link
                          href={`/my-automations/${item.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                        >
                          <span>Open Workspace</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
