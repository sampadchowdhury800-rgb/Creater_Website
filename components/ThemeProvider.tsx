"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isInsideProvider: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  mounted: false,
  toggleTheme: () => {},
  setTheme: () => {},
  isInsideProvider: false,
});

export function isAutomationRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/automations" ||
    pathname.startsWith("/automations/") ||
    pathname === "/my-automations" ||
    pathname.startsWith("/my-automations/")
  );
}

function ThemeRootProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Synchronize with localStorage and DOM on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      const html = document.documentElement;
      if (saved === "light" || saved === "dark") {
        // Explicit user preference takes absolute precedence
        setThemeState(saved);
        html.classList.remove("dark", "light");
        html.classList.add(saved);
      } else {
        // No explicit preference: automation routes and global site default to dark
        setThemeState("dark");
        html.classList.remove("light");
        html.classList.add("dark");
      }
    } catch {
      // Ignore storage access errors if in private browsing
    }
    setMounted(true);
  }, []);

  // When navigating client-side, if the user has NO explicit preference and enters an automation route,
  // ensure the theme defaults to dark without overriding an explicit choice.
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem("theme");
      if (!saved && isAutomationRoute(pathname)) {
        setThemeState("dark");
        const html = document.documentElement;
        html.classList.remove("light");
        html.classList.add("dark");
      }
    } catch {}
  }, [pathname, mounted]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {}
      const html = document.documentElement;
      html.classList.remove("dark", "light");
      html.classList.add(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, mounted, toggleTheme, setTheme, isInsideProvider: true }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const existing = useContext(ThemeContext);
  // If already wrapped in a ThemeProvider higher up the tree, avoid duplicate state
  if (existing.isInsideProvider) {
    return <>{children}</>;
  }
  return <ThemeRootProvider>{children}</ThemeRootProvider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}


