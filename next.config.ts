import type { NextConfig } from "next";

const cspReportOnlyHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.clerk.accounts.dev https://clerk.chowdhuryduo.com https://*.clerk.com https://challenges.cloudflare.com https://*.effectivecpmnetwork.com https://www.highperformanceformat.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://img.youtube.com https://i.ytimg.com https://img.clerk.com https://images.clerk.dev https://www.google.com https://*.effectivecpmnetwork.com https://*.highperformanceformat.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://formsubmit.co https://*.clerk.accounts.dev https://api.clerk.com https://clerk.chowdhuryduo.com https://*.effectivecpmnetwork.com https://*.highperformanceformat.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://api.razorpay.com https://checkout.razorpay.com https://challenges.cloudflare.com https://www.highperformanceformat.com https://*.effectivecpmnetwork.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://formsubmit.co",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "media-src 'self' https://res.cloudinary.com",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      // Cloudinary — for all uploaded media (featured images, gallery, etc.)
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Clerk — for user avatars
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
  async headers() {
    return [
      // Global HTTP security headers for all application responses
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), usb=(), display-capture=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnlyHeader,
          },
        ],
      },
      // Cache-Control hardening for private/sensitive API endpoints
      {
        source: "/api/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/api/automation-executions/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/api/orders/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/api/user-automations/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/api/my-automations/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
