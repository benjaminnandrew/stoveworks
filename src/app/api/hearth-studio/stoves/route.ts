import { NOT_SOLD_FUELS } from "@/content/lineup";
import { query } from "@/lib/db";

/**
 * GET -> { stoves: [...] }: the stove visualizer's catalog in the shape Hearth Studio's stove
 * layer reads (handoff/hearth-studio/INTEGRATION.md, section 7a). Not wired into the app yet:
 * HS_CONFIG.stoveCatalogUrl goes in once the stove layer (7c) exists and stoves have cutouts.
 *
 * Only facts on file go out; anything missing is left out, never guessed:
 * - `image` is the product's own cutout (none uploaded yet, 28 Oct 2026). The visualizer's
 *   category silhouettes are placeholders, not the product, so they are never sent.
 * - `view` (which way the photo faces) and `imageWidthIn` aren't recorded anywhere yet, so they're
 *   left out; they need fields on the product admin, filled in when staff upload a cutout.
 * - `flue` is left to the app's default (top for wood, rear for gas).
 * - `onDisplay` is Steve's "On our showroom floor" mark from /admin/carry/.
 * No prices. Fuels Stoveworks doesn't sell are left out (NOT_SOLD_FUELS).
 */

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { stove: "freestanding", insert: "insert", fireplace: "fireplace" };

type Row = {
  slug: string;
  name: string;
  model_name: string | null;
  brand: string | null;
  category: string;
  fuel: string;
  width_in: string | null;
  height_in: string | null;
  depth_in: string | null;
  cutout_path: string | null;
  product_url: string | null;
  carry_status: string | null;
};

const inches = (v: string | null) => (v == null ? undefined : Number(v));

export async function GET() {
  const { rows } = await query<Row>(
    `SELECT p.slug, p.name, m.name AS model_name, b.name AS brand, p.category, p.fuel,
            p.width_in, p.height_in, p.depth_in, p.cutout_path, p.product_url, m.carry_status
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN catalog_models m ON m.id = p.catalog_model_id
      WHERE p.is_active AND p.category = ANY($1::text[])
      ORDER BY b.name, p.name`,
    [Object.keys(KIND)],
  );

  const stoves = rows
    .filter((r) => !NOT_SOLD_FUELS.has(r.fuel))
    .map((r) => ({
      id: r.slug,
      brand: r.brand ?? undefined,
      // The catalog's model name is the maker's; the product's name carries the brand in front.
      name: r.model_name ?? r.name,
      fuel: r.fuel,
      kind: KIND[r.category],
      image: r.cutout_path ?? undefined,
      widthIn: inches(r.width_in),
      heightIn: inches(r.height_in),
      depthIn: inches(r.depth_in),
      productUrl: r.product_url ?? undefined,
      onDisplay: r.carry_status === "on_floor",
    }));

  return Response.json({ stoves });
}
