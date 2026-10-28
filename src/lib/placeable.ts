import "server-only";

import { NOT_SOLD_FUELS } from "@/content/lineup";

import { PLACEHOLDER_BY_CATEGORY, type PlaceableProduct } from "./design-types";
import { listProducts, type Product } from "./products";

/**
 * Turns catalog rows into what the visualizer needs. Products without a cutout
 * fall back to a category silhouette so the tool is usable while Steve's team
 * gathers real product photography.
 */
export function toPlaceable(p: Product): PlaceableProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    fuel: p.fuel,
    brandName: p.brand_name,
    image: p.cutout_path ?? PLACEHOLDER_BY_CATEGORY[p.category],
    isPlaceholder: !p.cutout_path,
    widthIn: p.width_in ? Number(p.width_in) : null,
    heightIn: p.height_in ? Number(p.height_in) : null,
    productUrl: p.product_url,
    catalogModelId: p.catalog_model_id,
  };
}

/** What the visualizer offers: not the fuels Stoveworks doesn't sell (NOT_SOLD_FUELS). */
export async function listPlaceableProducts(): Promise<PlaceableProduct[]> {
  return (await listProducts()).filter((p) => !NOT_SOLD_FUELS.has(p.fuel)).map(toPlaceable);
}
