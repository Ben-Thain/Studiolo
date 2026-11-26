import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Template photos are read with fs when a site is created. Vercel only
  // ships files the trace sees, and the path is chosen at runtime.
  outputFileTracingIncludes: {
    "/sites": ["./public/templates/**/*"],
    "/sites/templates/[templateId]": ["./public/templates/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Live-site images are same-origin via /api/assets (prompt 09).
    // Do not add Supabase Storage to remotePatterns; the bucket is private.
    localPatterns: [
      {
        pathname: "/api/assets/**",
      },
    ],
  },
};

export default nextConfig;
