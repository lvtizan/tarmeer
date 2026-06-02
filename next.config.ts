import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /@slug → /companies/[slug] (browser URL stays /@slug, canonical preserved)
  async rewrites() {
    return [
      {
        source: "/@:slug",
        destination: "/companies/:slug",
      },
    ];
  },

  // Legacy redirects (301) preserved from existing Vite app
  async redirects() {
    return [
      // More-specific designer routes must come before the catch-all
      { source: "/designers/apply", destination: "/onboarding", permanent: true },
      { source: "/designers/:slug/projects/:projectSlug", destination: "/companies/:slug", permanent: true },
      { source: "/designers/:slug", destination: "/companies/:slug", permanent: true },
      { source: "/designers", destination: "/companies", permanent: true },
      { source: "/designer/:path*", destination: "/company", permanent: true },
      { source: "/showrooms", destination: "/materials", permanent: true },
      { source: "/materials/brands", destination: "/materials", permanent: true },
      { source: "/materials/brands/:path*", destination: "/materials", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/login", destination: "/auth", permanent: true },
      { source: "/register", destination: "/auth", permanent: true },
      { source: "/join", destination: "/for-companies", permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.tarmeer.com" },
      { protocol: "https", hostname: "*.tarmeer.com" },
      ...(process.env.NODE_ENV === "development"
        ? [{ protocol: "http" as const, hostname: "localhost" }]
        : []),
    ],
  },
};

export default nextConfig;
