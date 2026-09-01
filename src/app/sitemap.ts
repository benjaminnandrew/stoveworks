import type { MetadataRoute } from "next";

import { pages } from "@/content/pages";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "contact-us", ...pages.map((p) => p.slug)];

  return routes.map((route) => ({
    url: route ? `${siteUrl}/${route}` : siteUrl,
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
