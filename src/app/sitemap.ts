import type { MetadataRoute } from "next";

import { pages } from "@/content/pages";
import { siteUrl } from "@/lib/site-url";

/**
 * No lastModified: pages have no real per-page edit dates, and stamping every URL
 * with the build time teaches Google to ignore the field. Add it once content
 * carries genuine dates (e.g. /learn/ articles).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "contact-us", "visualizer", "veneer", ...pages.map((p) => p.slug)];

  return routes.map((route) => ({
    url: route ? `${siteUrl}/${route}/` : `${siteUrl}/`,
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
