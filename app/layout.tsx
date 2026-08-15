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

import { buildDynamicMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/siteConfig";
import { getOrganizationSchema, getWebSiteSchema } from "@/lib/jsonld";

export const metadata: Metadata = buildDynamicMetadata({
  title: `${siteConfig.name} | ${siteConfig.tagline}`,
  description: siteConfig.shortDescription,
  canonicalPath: "/",
  keywords: [
    "Chowdhury Duo",
    "Sampad Chowdhury",
    "Bharti Shaw",
    "Full Stack Developer",
    "Business Automation",
    "AI Workflows",
    "SaaS Development",
    "Next.js Developer",
    "Python Developer",
    "Digital Products",
  ],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = getOrganizationSchema();
  const webSiteSchema = getWebSiteSchema();

  return (
    <html lang="en" className="dark">
      <head>
        {/* Global JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
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
