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
  // The WordPress site's URLs all end in a slash (/stoves/wood-stoves/). Matching
  // that keeps every unchanged page at exactly the URL Google already has, rather
  // than redirecting the whole site on launch day. The slash redirect itself is
  // done in src/proxy.ts, for pages only, so API calls don't take a 308 hop.
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  async redirects() {
    // Pages renamed in the rebuild (docs/seo-plan.md). 301 rather than Next's
    // default 308, to match what the old URLs are being retired with.
    const moved: [string, string][] = [
      ["/specialty-hearth/", "/hearth-accessories/"],
      ["/specialty-hearth/glass-doors/", "/hearth-accessories/glass-doors/"],
      ["/specialty-hearth/hearth-pads/", "/hearth-accessories/hearth-pads/"],
      ["/specialty-hearth/gas-logs/", "/hearth-accessories/gas-logs/"],
      ["/specialty-hearth/outdoor-rings-grills/", "/outdoor/"],
      ["/specialty-hearth/refrigerators-cook-stoves/", "/cook-stoves/"],
      ["/specialty-hearth/hot-tubs-sauna-stoves/", "/sauna-stoves/"],
      ["/facings/", "/stonework-mantels/"],
    ];
    // The stove visualizer and the veneer studio became one Room Studio (Oct 2026).
    // Veneer mock-ups moved into designs under the same ids (db/schema.sql).
    moved.push(
      ["/veneer/", "/visualizer/?layer=stone"],
      ["/account/veneer/:id/", "/account/designs/:id/"],
    );
    return moved.map(([source, destination]) => ({ source, destination, statusCode: 301 }));
  },
};

export default nextConfig;
