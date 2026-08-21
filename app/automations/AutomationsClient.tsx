"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import AutomationCard from "@/components/AutomationCard";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Search, Sparkles, SlidersHorizontal, ArrowRight, Layers, LayoutGrid } from "lucide-react";
import Link from "next/link";

interface AutomationsClientProps {
  automations: any[];
  dbCategories?: any[];
}

const DEFAULT_CATEGORIES = [
  "All",
  "Email",
  "Sales",
  "Lead Generation",
  "Marketing",
  "AI",
  "CRM",
  "Productivity",
  "Operations",
];

export default function AutomationsClient({ automations, dbCategories = [] }: AutomationsClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Merge default SaaS categories with database categories
  const categoriesList = useMemo(() => {
    const list = [...DEFAULT_CATEGORIES];
    dbCategories.forEach((cat) => {
      if (cat.name && !list.includes(cat.name)) {
        list.push(cat.name);
      }
    });
    return list;
  }, [dbCategories]);

  // Filter automations based on search and selected category
  const filteredAutomations = useMemo(() => {
    return automations.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.shortDesc && item.shortDesc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.integrations && item.integrations.some((ig: string) => ig.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory =
        selectedCategory === "All" ||
        (item.category && item.category.name.toLowerCase() === selectedCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [automations, searchQuery, selectedCategory]);

  return (
    <ThemeProvider>
      <div className="bg-[#FAFAFA] dark:bg-[#FAFAFA] text-slate-900 min-h-screen flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          videos={[]}
        />

        {/* Hero & Marketplace Section */}
        <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          {/* Top Banner */}
          <div className="mb-10 text-center sm:text-left bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Enterprise Business Automations
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
                Automation SaaS Marketplace
              </h1>
              <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed">
                Automate repetitive work with powerful, ready-to-deploy business automation products engineered for maximum reliability and throughput.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/my-automations"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-95"
                >
                  <span>Go to My Automations</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#marketplace-grid"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md transition-all"
                >
                  <span>Browse Products</span>
                </a>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div id="marketplace-grid" className="mb-8 space-y-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search automations by title, description, or integration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              {/* Counter Badge */}
              <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-slate-500 px-2">
                <span className="font-semibold text-slate-700">
                  {filteredAutomations.length} {filteredAutomations.length === 1 ? 'automation' : 'automations'} available
                </span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 pr-2 border-r border-slate-200 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Categories</span>
              </div>
              {categoriesList.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all shadow-xs cursor-pointer ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automations Grid / Empty State */}
          {filteredAutomations.length === 0 ? (
            <div className="py-20 text-center bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No automations available yet</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Check back soon for new automation products published from the admin panel, or try adjusting your search terms.
              </p>
              {searchQuery || selectedCategory !== "All" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                  className="px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Reset Filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAutomations.map((automation) => (
                <AutomationCard key={automation.id} automation={automation} />
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
