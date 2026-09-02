import "server-only";

import { query, queryOne } from "./db";
import type { StoneSwatch } from "./veneer-types";

export type StoneProduct = {
  id: string;
  slug: string;
  name: string;
  texture: string;
  color: string | null;
  summary: string | null;
  swatch_path: string | null;
  swatch_width_in: string;
  swatch_height_in: string;
  flat_sqft_per_box: string | null;
  corner_lnft_per_box: string | null;
  product_url: string | null;
  is_active: boolean;
  brand_id: number | null;
  brand_name: string | null;
  brand_slug: string | null;
};

const SELECT = `
  SELECT s.id, s.slug, s.name, s.texture, s.color, s.summary,
         s.swatch_path, s.swatch_width_in, s.swatch_height_in,
         s.flat_sqft_per_box, s.corner_lnft_per_box, s.product_url,
         s.is_active, s.brand_id,
         b.name AS brand_name, b.slug AS brand_slug
    FROM stone_products s
    LEFT JOIN brands b ON b.id = s.brand_id`;

/**
 * Generic tiles stand in until staff upload real swatches, chosen by texture
 * family so a ledgestone profile at least looks like ledgestone. Everywhere
 * one of these appears it is labelled as a placeholder.
 */
const PLACEHOLDER_BY_TEXTURE: Array<[RegExp, string]> = [
  [/brick/i, "/stone/brick-red.png"],
  [/field|cobble|river|round/i, "/stone/fieldstone-grey.png"],
  [/ledge|stack|split/i, "/stone/ledgestone-grey.png"],
];

function placeholderFor(texture: string, slug: string): string {
  for (const [pattern, file] of PLACEHOLDER_BY_TEXTURE) {
    if (pattern.test(texture)) {
      // Alternate the two colourways so a list of profiles is not monotone.
      const warm = slug.charCodeAt(slug.length - 1) % 2 === 1;
      if (/ledge|stack|split/i.test(texture) && warm) return "/stone/ledgestone-tan.png";
      if (/field|cobble|river|round/i.test(texture) && warm) return "/stone/fieldstone-warm.png";
      return file;
    }
  }
  return "/stone/ledgestone-grey.png";
}

export function toSwatch(s: StoneProduct): StoneSwatch {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    texture: s.texture,
    color: s.color,
    brandName: s.brand_name,
    image: s.swatch_path ?? placeholderFor(s.texture, s.slug),
    isPlaceholder: !s.swatch_path,
    tileWidthIn: Number(s.swatch_width_in) || 24,
    tileHeightIn: Number(s.swatch_height_in) || 16,
    flatSqftPerBox: s.flat_sqft_per_box ? Number(s.flat_sqft_per_box) : null,
    cornerLnftPerBox: s.corner_lnft_per_box ? Number(s.corner_lnft_per_box) : null,
    productUrl: s.product_url,
  };
}

export async function listStoneProducts(
  opts: { includeInactive?: boolean } = {},
): Promise<StoneProduct[]> {
  const { rows } = await query<StoneProduct>(
    `${SELECT}
     ${opts.includeInactive ? "" : "WHERE s.is_active"}
     ORDER BY b.name NULLS LAST, s.texture, s.sort, s.color NULLS FIRST, s.name`,
  );
  return rows;
}

export async function listSwatches(): Promise<StoneSwatch[]> {
  return (await listStoneProducts()).map(toSwatch);
}

export function getStoneProduct(id: string): Promise<StoneProduct | null> {
  return queryOne<StoneProduct>(`${SELECT} WHERE s.id = $1`, [id]);
}

export async function getSwatchesByIds(ids: string[]): Promise<Map<string, StoneSwatch>> {
  if (ids.length === 0) return new Map();
  const { rows } = await query<StoneProduct>(`${SELECT} WHERE s.id = ANY($1::uuid[])`, [ids]);
  return new Map(rows.map((s) => [s.id, toSwatch(s)]));
}

export async function stoneCounts() {
  const { rows } = await query<{ texture: string; n: number; ready: number }>(
    `SELECT texture, count(*)::int AS n, count(swatch_path)::int AS ready
       FROM stone_products WHERE is_active GROUP BY texture ORDER BY texture`,
  );
  return rows;
}
