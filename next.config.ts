import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Run from the project with `next start` (on Replit: `npm run start:live`), so
  // no standalone bundle is needed.
  reactStrictMode: true,
  poweredByHeader: false,
  // These ship their own native/WASM binaries and resolve them relative to their
  // own files. Bundling them breaks that resolution, so keep them as plain
  // runtime requires. The App Storage client (and the Google Cloud library under
  // it) is only loaded on Replit, so it stays a runtime require too.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "@replit/object-storage"],
  // Keep local data out of the build's file traces: var/ holds gigabytes of PDFs
  // and photos, and the brain is read by `npm run brain:load`, not at runtime.
  outputFileTracingExcludes: {
    "*": ["./var/**/*", "./brain/**/*"],
  },
  experimental: {
    serverActions: {
      // Staff upload cutouts and stone swatches through server actions, which
      // refuse bodies over 1 MB by default; the forms allow 8 MB images. 20 MB
      // leaves room for the form's other fields, so anything between 8 and 20 MB
      // gets the form's own "keep it under 8 MB" message instead of an error page.
      bodySizeLimit: "20mb",
    },
  },
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
      ["/facings/", "/fireplace-walls-mantels/"],
      ["/stonework-mantels/", "/fireplace-walls-mantels/"],
      // Stoveworks doesn't sell pellet stoves (Ben, 26 Oct 2026).
      ["/stoves/pellet-stoves/", "/stoves/"],
    ];
    return moved.map(([source, destination]) => ({ source, destination, statusCode: 301 }));
  },
};

export default nextConfig;
