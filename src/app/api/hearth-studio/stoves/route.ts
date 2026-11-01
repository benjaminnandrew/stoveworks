import { brandBySlug } from "@/content/brands";
import { NOT_SOLD_FUELS } from "@/content/lineup";
import { listPublicLineup } from "@/lib/catalog";
import { query } from "@/lib/db";
import { modelHref } from "@/lib/model-url";
import { siteUrl } from "@/lib/site-url";

/**
 * GET -> { stoves: [...] }: the stoves Hearth Studio can draw, in the shape its stove layer reads
 * (handoff/hearth-studio/INTEGRATION.md, section 7a). public/hs/index.html points
 * HS_CONFIG.stoveCatalogUrl here. `?all=1` lists every stove, drawable or not, for checking
 * what's missing.
 *
 * Only facts on file go out; anything missing is left out, never guessed:
 * - `image` is the product's cutout, uploaded at /admin like the stove visualizer's were (none
 *   until the Morsø 7110 B, 28 Oct 2026). Ben confirmed that day that the makers' own product
 *   photos may be used, so a maker's cutout can be one. A stove without one can't be drawn, so
 *   it's listed only with ?all=1.
 * - `view`, `imageSpan`, `imageWidthIn` and `glassBox` describe the cutout: which way it faces,
 *   where the maker's width runs across it (and that width in inches), and the fire window. Staff
 *   set them with the image (7d); `imageSpan` is this site's addition to 7a, for 7d's markers.
 * - `imageTopFront` (the site's addition, 30 Oct 2026) is the row where the stove's top meets its
 *   front, as a fraction of the photo's height: the top of the maker's height. With it the app
 *   fits the front to the maker's height and the top to the room's camera, not only the width.
 * - `imageFlue` (the site's addition, 31 Oct 2026) is where the photo shows the top flue outlet
 *   with a blanking plate on it, not a collar, as [x, y] fractions. The app stands the pipe on the
 *   top there, so it comes out of the top opening.
 * - `viewingBox` and `viewingIn` (the site's addition, 31 Oct 2026) are a built-in fireplace's
 *   viewing area: where it is in the photo, and the maker's published size of it in inches (wide,
 *   tall). The app draws the fireplace's front over the family room's own at that size, and lists
 *   only fireplaces that have them.
 * - `flue` is left to the app's default (top for wood, rear for gas).
 * - `pageUrl` is the stove's own page on this site, only when its model has one (the model
 *   page's rule). It's a full address from SITE_URL, because the showroom puts it on the
 *   customer's phone as a QR code and the app would otherwise put a path on its own idea of
 *   the domain. The maker's page isn't sent: stove cards link to our pages, never the maker's
 *   (Ben, 28 Oct 2026).
 * - `onDisplay` is Steve's "On our showroom floor" mark from /admin/carry/.
 * Brands are spelled the site's way (Jøtul, Morsø), from src/content/brands.ts. No prices. Fuels
 * Stoveworks doesn't sell are left out (NOT_SOLD_FUELS).
 */

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { stove: "freestanding", insert: "insert", fireplace: "fireplace" };
const VIEWS = new Set(["front", "left34", "right34"]);

type Row = {
  slug: string;
  name: string;
  model_name: string | null;
  brand: string | null;
  brand_slug: string | null;
  category: string;
  fuel: string;
  width_in: string | null;
  height_in: string | null;
  depth_in: string | null;
  cutout_path: string | null;
  cutout_view: string | null;
  cutout_span: number[] | null;
  cutout_width_in: string | null;
  glass_box: number[] | null;
  cutout_top_front: number | null;
  cutout_flue: number[] | null;
  viewing_box: number[] | null;
  viewing_in: number[] | null;
  model_id: string | null;
  carry_status: string | null;
};

const inches = (v: string | null) => (v == null ? undefined : Number(v));
const fractions = (v: number[] | null, n: number) =>
  v?.length === n && v.every((x) => x >= 0 && x <= 1) ? v.map((x) => Math.round(x * 1000) / 1000) : undefined;

export async function GET(request: Request) {
  const all = new URL(request.url).searchParams.get("all") === "1";
  const { rows } = await query<Row>(
    `SELECT p.slug, p.name, m.name AS model_name, b.name AS brand, b.slug AS brand_slug, p.category, p.fuel,
            p.width_in, p.height_in, p.depth_in, p.cutout_path, p.cutout_view, p.cutout_span,
            p.cutout_width_in, p.glass_box, p.cutout_top_front, p.cutout_flue, p.viewing_box, p.viewing_in,
            p.catalog_model_id AS model_id, m.carry_status
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN catalog_models m ON m.id = p.catalog_model_id
      WHERE p.is_active AND p.category = ANY($1::text[])
      ORDER BY b.name, p.name`,
    [Object.keys(KIND)],
  );
  // The models that have a page (src/lib/model-page.ts: a catalog brand and the public lineup).
  const pages = new Map(
    (await listPublicLineup())
      .filter((m) => brandBySlug(m.brand_slug)?.inCatalog)
      .map((m) => [m.id, `${siteUrl}${modelHref(m)}`]),
  );

  const stoves = rows
    .filter((r) => !NOT_SOLD_FUELS.has(r.fuel) && (all || r.cutout_path))
    .map((r) => ({
      id: r.slug,
      brand: (r.brand_slug && brandBySlug(r.brand_slug)?.name) ?? r.brand ?? undefined,
      // The catalog's model name is the maker's; the product's name carries the brand in front.
      name: r.model_name ?? r.name,
      fuel: r.fuel,
      kind: KIND[r.category],
      image: r.cutout_path ?? undefined,
      ...(r.cutout_path
        ? {
            view: r.cutout_view && VIEWS.has(r.cutout_view) ? r.cutout_view : undefined,
            imageSpan: fractions(r.cutout_span, 2),
            imageWidthIn: inches(r.cutout_width_in),
            glassBox: fractions(r.glass_box, 4),
            imageTopFront: fractions(r.cutout_top_front == null ? null : [r.cutout_top_front], 1)?.[0],
            imageFlue: fractions(r.cutout_flue, 2),
            viewingBox: fractions(r.viewing_box, 4),
            viewingIn: r.viewing_in?.length === 2 && r.viewing_in.every((v) => v > 0) ? r.viewing_in.map(Number) : undefined,
          }
        : {}),
      widthIn: inches(r.width_in),
      heightIn: inches(r.height_in),
      depthIn: inches(r.depth_in),
      pageUrl: (r.model_id && pages.get(r.model_id)) || undefined,
      onDisplay: r.carry_status === "on_floor",
    }));

  return Response.json({ stoves });
}
