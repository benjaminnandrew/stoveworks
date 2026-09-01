import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the reserved VM deploy.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // All imagery is served from /public; no remote loaders needed.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
