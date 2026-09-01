import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the reserved VM deploy.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // These ship their own native/WASM binaries and resolve them relative to their
  // own files. Bundling them breaks that resolution, so keep them as plain
  // runtime requires.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  images: {
    // All imagery is served from /public; no remote loaders needed.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
