import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
