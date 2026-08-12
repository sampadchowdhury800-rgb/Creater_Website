import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { ClerkProvider } from "@clerk/nextjs";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chowdhury Duo | Creator • Videos • Projects",
  description:
    "Chowdhury Duo — A cinematic creator duo pushing the boundaries of digital storytelling and lifestyle art. We craft immersive experiences through video and design.",
  keywords: [
    "Chowdhury Duo",
    "Sampad Chowdhury",
    "Bharti Shaw",
    "YouTube",
    "Instagram",
    "creator",
    "AI",
    "lifestyle",
    "content creator",
  ],
  authors: [{ name: "Chowdhury Duo" }],
  metadataBase: new URL("https://chowdhuryduo.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://chowdhuryduo.com",
    siteName: "Chowdhury Duo",
    title: "Chowdhury Duo | Creator • Videos • Projects",
    description:
      "A cinematic creator duo pushing the boundaries of digital storytelling and lifestyle art.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chowdhury Duo | Creator • Videos • Projects",
    description:
      "A cinematic creator duo pushing the boundaries of digital storytelling and lifestyle art.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Material Symbols Outlined variable font — uses custom axis params not supported by next/font */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} bg-background selection:bg-primary-container selection:text-on-primary-container`}
      >
        <ClerkProvider>
          <AnalyticsTracker />
          {children}
          <ToastContainer position="bottom-right" theme="dark" />

          {/* Phase 2 — Popunder (head-injected by the network, lazyOnload so LCP is unaffected) */}
          <Script
            id="ecpm-popunder"
            src="https://pl30441398.effectivecpmnetwork.com/fa/90/b2/fa90b2e8bf087814d44347e55deb7891.js"
            strategy="lazyOnload"
          />

          {/* Phase 3 — Footer script */}
          <Script
            id="ecpm-footer"
            src="https://pl30441402.effectivecpmnetwork.com/9b/b6/89/9bb689216ba0a3059dd43237205fde06.js"
            strategy="lazyOnload"
          />
        </ClerkProvider>
      </body>
    </html>
  );
}
