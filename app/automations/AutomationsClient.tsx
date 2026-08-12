"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import AutomationCard from "@/components/AutomationCard";
import { ThemeProvider } from "@/components/ThemeProvider";

interface AutomationsClientProps {
  automations: any[]; // replace with actual type later
}

export default function AutomationsClient({ automations }: AutomationsClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="bg-background dark:bg-background selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
        {/* We pass empty videos array because this page doesn't search videos by default, or we can fetch them. */}
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          videos={[]}
        />

        <main className="flex-1 pt-32 pb-20 px-6 max-w-[1440px] mx-auto w-full">
          <div className="mb-12">
            <h1 className="text-4xl md:text-[64px] font-display-lg font-bold text-primary-fixed-dim tracking-tighter mb-4 drop-shadow-[0_0_30px_rgba(0,219,233,0.2)]">
              Automations
            </h1>
            <p className="text-on-tertiary-fixed-variant dark:text-on-surface-variant text-lg max-w-2xl">
              Supercharge your workflow with our premium, ready-to-use automation products.
            </p>
          </div>

          {automations.length === 0 ? (
            <div className="py-20 text-center border border-black/5 dark:border-white/5 rounded-2xl bg-black/5 dark:bg-white/5">
              <p className="text-on-tertiary-fixed-variant dark:text-on-surface-variant text-lg">
                No automations published yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {automations.map((automation) => (
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
