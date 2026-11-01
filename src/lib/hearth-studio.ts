import "server-only";

import { NOT_SOLD_FUELS } from "@/content/lineup";
import { queryOne } from "@/lib/db";

/**
 * The stove or fireplace Hearth Studio can show in a room for a catalog model, as its id in the app
 * (the product's slug), or null. The ones /api/hearth-studio/stoves lists that the app shows, in a
 * fuel Stoveworks sells: an active freestanding stove with a cutout (on the lake cabin's hearth), or
 * an active built-in fireplace with a cutout and its viewing area (in the family room's wall, from
 * 31 Oct 2026). A model's page links to /hearth-studio/?stove=<id> with it ("See it in a room").
 */
export async function studioStoveFor(modelId: string): Promise<string | null> {
  const row = await queryOne<{ slug: string }>(
    `SELECT p.slug FROM products p
      WHERE p.catalog_model_id = $1 AND p.is_active AND p.cutout_path IS NOT NULL
        AND (p.category = 'stove'
             OR (p.category = 'fireplace' AND p.viewing_box IS NOT NULL AND p.viewing_in IS NOT NULL))
        AND NOT (p.fuel = ANY($2::text[]))
      ORDER BY p.slug
      LIMIT 1`,
    [modelId, [...NOT_SOLD_FUELS]],
  );
  return row?.slug ?? null;
}
