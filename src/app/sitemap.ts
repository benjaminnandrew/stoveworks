import type { MetadataRoute } from "next";

import { brands } from "@/content/brands";
import { pages } from "@/content/pages";
import { listPublicLineup } from "@/lib/catalog";
import { modelHref } from "@/lib/model-url";
import { siteUrl } from "@/lib/site-url";

/**
 * No lastModified: pages have no real per-page edit dates, and stamping every URL
 * with the build time teaches Google to ignore the field. Add it once content
 * carries genuine dates (e.g. /learn/ articles).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    "",
    "contact-us",
    "hearth-studio",
    "guides",
    "brands",
    ...brands.map((b) => `brands/${b.slug}`),
    ...pages.map((p) => p.slug),
  ];

  // Every model in the public lineup has a page; without the database the rest still lists.
  const models = await listPublicLineup().catch(() => []);

  return [
    ...routes.map((route) => ({
      url: route ? `${siteUrl}/${route}/` : `${siteUrl}/`,
      changeFrequency: "monthly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...models.map((m) => ({ url: `${siteUrl}${modelHref(m)}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
