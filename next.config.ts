import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // /@slug → /companies/[slug] (browser URL stays /@slug, canonical preserved)
  async rewrites() {
    return [
      // In development, proxy /api/* and /uploads/* to Express backend on port 3002
      ...(isDev ? [
        { source: "/api/:path*", destination: "http://localhost:3002/api/:path*" },
        { source: "/uploads/:path*", destination: "http://localhost:3002/uploads/:path*" },
      ] : []),
    ];
  },

  // Legacy redirects (301) preserved from existing Vite app
  async redirects() {
    return [
      // @slug shorthand → canonical company URL (prevents duplicate content)
      { source: "/@:slug", destination: "/companies/:slug", permanent: true },
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
      // 材料改版调整(2026-07-30)：原首页搬回 /，昨天临时的 /classic 归一到 /；材料首页移到 /mall。
      { source: "/classic", destination: "/", permanent: true },
      { source: "/login", destination: "/auth", permanent: true },
      { source: "/register", destination: "/auth", permanent: true },
      { source: "/join", destination: "/for-companies", permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.tarmeer.com" },
      { protocol: "https", hostname: "*.tarmeer.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
