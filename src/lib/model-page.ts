import "server-only";

import type { Metadata } from "next";
import { cache } from "react";

import { brandBySlug, type Brand } from "@/content/brands";
import { typeLabel } from "@/content/lineup";
import {
  getCatalogModel,
  isPublicModel,
  listPublicLineup,
  type CatalogModel,
  type CatalogModelSummary,
} from "@/lib/catalog";
import { modelHref } from "@/lib/model-url";
import { modelView, type ModelView } from "@/lib/model-view";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";

export type ModelPageData = {
  brand: Brand;
  model: CatalogModel;
  view: ModelView;
  /** The brand's other public models of the same type, for "More Blaze King wood stoves". */
  related: CatalogModelSummary[];
};

/**
 * A public model by its address, or null. Shared by the page, the pop-up and
 * their metadata; `cache` makes it one lookup per request. Models the public
 * lineup hides (discontinued, not for sale in the US, marked not carried by
 * Steve) have no page.
 */
export const loadModelPage = cache(async (brandSlug: string, slug: string): Promise<ModelPageData | null> => {
  const brand = brandBySlug(brandSlug);
  if (!brand?.inCatalog) return null;
  const model = await getCatalogModel(`${brandSlug}-${slug}`);
  if (!model || model.brand_slug !== brandSlug || !isPublicModel(model)) return null;
  const related = (await listPublicLineup(brandSlug))
    .filter((m) => m.id !== model.id && m.form === model.form && m.fuel === model.fuel)
    .slice(0, 6);
  return { brand, model, view: modelView(model, brand.name), related };
});

const absolute = (url: string) => (url.startsWith("/") ? `${siteUrl}${url}` : url);

export async function modelMetadata(brandSlug: string, slug: string): Promise<Metadata> {
  const data = await loadModelPage(brandSlug, slug);
  if (!data) return {};
  const { model, view } = data;
  const url = modelHref(model);
  return {
    title: view.seoTitle,
    description: view.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      title: view.seoTitle,
      description: view.seoDescription,
      url,
      images: model.hero_image ? [{ url: absolute(model.hero_image), alt: `${data.brand.name} ${model.name}` }] : [SHARE_IMAGE],
    },
  };
}

/** Product and BreadcrumbList JSON-LD. No offers: there are no prices on this site. */
export function modelJsonLd({ brand, model, view }: ModelPageData) {
  const url = `${siteUrl}${modelHref(model)}`;
  const numbers = Array.isArray(model.data.model_numbers) ? (model.data.model_numbers as string[]) : [];
  const images = [...new Set([model.hero_image, ...model.photos.map((p) => p.url)].filter(Boolean) as string[])];
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${brand.name} ${model.name}`,
      brand: { "@type": "Brand", name: brand.name },
      model: numbers[0] ?? model.name,
      category: typeLabel(model.form, model.fuel),
      ...(view.description ? { description: view.description } : {}),
      ...(images.length ? { image: images.slice(0, 6).map(absolute) } : {}),
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Home", href: "/" },
        { name: "Brands", href: "/brands/" },
        { name: brand.name, href: `/brands/${brand.slug}/` },
        { name: model.name, href: modelHref(model) },
      ].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${siteUrl}${c.href}` })),
    },
  ];
}
