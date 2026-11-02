/**
 * Puts a stove into Hearth Studio on a local dev site, until the stove admin has its sizing step
 * (handoff/hearth-studio/INTEGRATION.md, 7d). Run with the dev server stopped: PGlite is
 * single-process. Details in docs/hearth-studio.md, "Phase 4".
 *
 *   node scripts/set-stove-cutout.mjs trim <maker's transparent png> <out.png>
 *     Trims it exactly as an admin cutout upload does (src/lib/storage.ts, storeProductCutout).
 *     Measure the facts on <out.png>, in pixels.
 *
 *   node scripts/set-stove-cutout.mjs set <product slug> <trimmed png> <view> <spanL,spanR> <x0,y0,x1,y1> [topFront]
 *     Stores the cutout as an upload would, and records what Hearth Studio reads with it:
 *     view (front, left34 or right34); the span, where the maker's width on file runs across the
 *     photo (for a front view, the top plate's front corners); the fire window's box; and the row
 *     where the stove's top meets its front, at its middle (the top of the maker's height), which
 *     lets Hearth Studio draw it the right height as well as width.
 *
 *   node scripts/set-stove-cutout.mjs top <product slug> <topFront>
 *     Records that row for a stove whose cutout is already stored.
 *
 *   node scripts/set-stove-cutout.mjs flue <product slug> <x,y>
 *     For a stove whose photo shows its top flue outlet capped (a blanking plate, not a collar):
 *     the middle of that plate, in pixels of the stored cutout (31 Oct 2026). Hearth Studio stands
 *     the pipe on the top there, so it comes out of the top opening.
 *
 *   node scripts/set-stove-cutout.mjs face <product slug> <trimmed png> <x0,y0,x1,y1> <wide,tall> <gx0,gy0,gx1,gy1>
 *     For a built-in fireplace, photographed straight on (31 Oct 2026): stores the cutout, its
 *     viewing area (the box inside the front, in pixels, and the maker's published size of it in
 *     inches) and the fire window's box. Hearth Studio draws the front at that size. The box's shape
 *     has to match the maker's figures, which catches a photo that isn't straight on.
 *     For an insert (1 Nov 2026), the box is its surround's outer edges and the size the manual's
 *     surround size (the bottom where the side panels end: an ash lip in front of the surround
 *     shows lower in the photo).
 *
 *   node scripts/set-stove-cutout.mjs export
 *     Writes db/hearth-studio/ from this database: every product's cutout, and what Hearth Studio
 *     reads with it. set, top, flue and face do this themselves after they write, so the folder
 *     goes to the live site with the code, and `npm run studio:load` (part of start:live) puts it
 *     in that site's database and file store (2 Nov 2026).
 */

import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { connect } from "./db-driver.mjs";
import { storeKind } from "./store-driver.mjs";

const [cmd, ...args] = process.argv.slice(2);
const pngSize = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];   // the PNG's IHDR
const productsDir = path.resolve("var", "uploads", "media", "products");
const seedDir = path.resolve("db", "hearth-studio");

/** The row where the top meets the front, as a fraction of the photo's height, or null. */
function topFrontOf(rowPx, H) {
  if (rowPx == null) return null;
  const f = Number(rowPx) / H;
  if (!(f > 0 && f < 0.9)) throw new Error(`the top's front edge must be a row inside the top 90% of the photo (it is ${rowPx} of ${H})`);
  return f;
}

async function update(sql, params, missing = "with the maker's width on file") {
  const db = await connect();
  console.log(`→ ${db.label}`);
  try {
    const { rows } = await db.query(sql, params);
    if (!rows.length) throw new Error(`no product "${params[0]}" ${missing}`);
    console.log("✓", rows[0]);
  } catch (err) {
    console.error("✗", err.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
  if (!process.exitCode) await exportSeed();
}

/**
 * db/hearth-studio/: products.json, one product a line (its slug, its cutout's file name and the
 * columns set with it), and cutouts/ with those files. Rewritten whole each time.
 */
async function exportSeed() {
  const db = await connect();
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT slug, cutout_path, cutout_view, cutout_span, cutout_width_in, glass_box, cutout_top_front,
              cutout_flue, viewing_box, viewing_in
         FROM products WHERE cutout_path LIKE '/files/media/products/%' ORDER BY slug`,
    ));
  } finally {
    await db.close();
  }
  const cutoutsDir = path.join(seedDir, "cutouts");
  await mkdir(cutoutsDir, { recursive: true });
  const out = [];
  for (const r of rows) {
    const cutout = path.basename(r.cutout_path);
    try {
      await copyFile(path.join(productsDir, cutout), path.join(cutoutsDir, cutout));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      console.error(`! ${r.slug}: its cutout ${cutout} isn't in var/uploads/media/products, so it's left out`);
      continue;
    }
    out.push({
      slug: r.slug,
      cutout,
      cutout_view: r.cutout_view,
      cutout_span: r.cutout_span,
      cutout_width_in: r.cutout_width_in == null ? null : Number(r.cutout_width_in),
      glass_box: r.glass_box,
      cutout_top_front: r.cutout_top_front,
      cutout_flue: r.cutout_flue,
      viewing_box: r.viewing_box,
      viewing_in: r.viewing_in,
    });
  }
  const kept = new Set(out.map((p) => p.cutout));
  for (const file of await readdir(cutoutsDir)) if (!kept.has(file)) await unlink(path.join(cutoutsDir, file));
  await writeFile(path.join(seedDir, "products.json"), `[\n${out.map((p) => `  ${JSON.stringify(p)}`).join(",\n")}\n]\n`);
  console.log(`✓ db/hearth-studio: ${out.length} products' cutouts and sizes, for the live site (studio:load)`);
}

if (cmd === "trim") {
  const [src, out] = args;
  if (!src || !out) usage();
  const sharp = (await import("sharp")).default;
  const buf = await sharp(await readFile(src))
    .rotate()
    .trim()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out, buf);
  const { width, height } = await sharp(buf).metadata();
  console.log(`✓ ${out}: ${width} x ${height}`);
} else if (cmd === "set") {
  const [slug, src, view, spanPx, glassPx, topPx] = args;
  if (!glassPx) usage();
  if (storeKind() !== "local") throw new Error("This writes the local file store only. On the live site, upload the cutout at /admin/products/.");
  const png = await readFile(src);
  const [W, H] = pngSize(png);
  const [sl, sr] = spanPx.split(",").map(Number);
  const [x0, y0, x1, y1] = glassPx.split(",").map(Number);
  const span = [sl / W, sr / W];
  const glass = [x0 / W, y0 / H, x1 / W, y1 / H];
  const topFront = topFrontOf(topPx, H);
  if (!["front", "left34", "right34"].includes(view)) throw new Error(`view must be front, left34 or right34 (it is "${view}")`);
  if (![...span, ...glass].every((v) => v >= 0 && v <= 1) || span[1] <= span[0] || glass[2] <= glass[0] || glass[3] <= glass[1]) {
    throw new Error("the span and the box must lie inside the photo, left to right and top to bottom");
  }

  const name = `${slug}-${randomUUID().slice(0, 8)}.png`;
  await mkdir(productsDir, { recursive: true });
  await writeFile(path.join(productsDir, name), png);

  // cutout_width_in is the maker's width on file: the span is the part of the photo it covers.
  await update(
    `UPDATE products
        SET cutout_path = $2, cutout_view = $3, cutout_span = $4, cutout_width_in = width_in,
            glass_box = $5, cutout_top_front = $6, cutout_flue = NULL, updated_at = now()
      WHERE slug = $1 AND width_in IS NOT NULL
      RETURNING slug, name, width_in, cutout_path, cutout_view, cutout_span, glass_box, cutout_top_front`,
    [slug, `/files/media/products/${name}`, view, span, glass, topFront],
  );
} else if (cmd === "top") {
  const [slug, topPx] = args;
  if (!topPx) usage();
  const [, H] = await storedSize(slug);
  await update(
    `UPDATE products SET cutout_top_front = $2, updated_at = now()
      WHERE slug = $1 AND width_in IS NOT NULL
      RETURNING slug, name, cutout_path, cutout_top_front`,
    [slug, topFrontOf(topPx, H)],
  );
} else if (cmd === "flue") {
  const [slug, fluePx] = args;
  if (!fluePx) usage();
  const [W, H] = await storedSize(slug);
  const [x, y] = fluePx.split(",").map(Number);
  const flue = [x / W, y / H];
  // the plate is on the top, so it's in the photo's top fifth
  if (!(flue[0] > 0 && flue[0] < 1 && flue[1] > 0 && flue[1] < 0.2)) throw new Error(`the outlet must be a point on the stove's top, in the photo's top fifth (it is ${x}, ${y} of ${W} x ${H})`);
  await update(
    `UPDATE products SET cutout_flue = $2, updated_at = now()
      WHERE slug = $1 AND width_in IS NOT NULL
      RETURNING slug, name, cutout_path, cutout_flue`,
    [slug, flue],
  );
} else if (cmd === "face") {
  const [slug, src, viewPx, viewIn, glassPx] = args;
  if (!glassPx) usage();
  if (storeKind() !== "local") throw new Error("This writes the local file store only. On the live site, upload the cutout at /admin/products/.");
  const png = await readFile(src);
  const [W, H] = pngSize(png);
  const [x0, y0, x1, y1] = viewPx.split(",").map(Number);
  const [wide, tall] = viewIn.split(",").map(Number);
  const [gx0, gy0, gx1, gy1] = glassPx.split(",").map(Number);
  const viewing = [x0 / W, y0 / H, x1 / W, y1 / H];
  const glass = [gx0 / W, gy0 / H, gx1 / W, gy1 / H];
  if (![...viewing, ...glass].every((v) => v >= 0 && v <= 1) || viewing[2] <= viewing[0] || viewing[3] <= viewing[1] || glass[2] <= glass[0] || glass[3] <= glass[1]) {
    throw new Error("the boxes must lie inside the photo, left to right and top to bottom");
  }
  if (!(wide > 0 && tall > 0)) throw new Error(`the box's size is two numbers of inches, wide,tall (it is "${viewIn}")`);
  const sx = (x1 - x0) / wide, sy = (y1 - y0) / tall;   // pixels per inch, across and up
  if (Math.abs(sx / sy - 1) > 0.03) {
    throw new Error(`the box is ${(x1 - x0).toFixed(1)} x ${(y1 - y0).toFixed(1)} px, which isn't the shape of ${wide} x ${tall} in (${((sx / sy - 1) * 100).toFixed(1)}% off): is the photo straight on, and the box the viewing area (a fireplace) or the surround (an insert)?`);
  }
  console.log(`  the front comes to about ${(W / sx).toFixed(1)} x ${(H / sy).toFixed(1)} in (shape ${((sx / sy - 1) * 100).toFixed(2)}% off)`);

  const name = `${slug}-${randomUUID().slice(0, 8)}.png`;
  await mkdir(productsDir, { recursive: true });
  await writeFile(path.join(productsDir, name), png);

  await update(
    `UPDATE products
        SET cutout_path = $2, cutout_view = 'front', viewing_box = $3, viewing_in = $4, glass_box = $5,
            cutout_span = NULL, cutout_width_in = NULL, cutout_top_front = NULL, cutout_flue = NULL, updated_at = now()
      WHERE slug = $1 AND category IN ('fireplace', 'insert')
      RETURNING slug, name, cutout_path, viewing_box, viewing_in, glass_box`,
    [slug, `/files/media/products/${name}`, viewing, [wide, tall], glass],
    "that's a built-in fireplace or an insert",
  );
} else if (cmd === "export") {
  await exportSeed();
} else {
  usage();
}

/** The stored cutout's size in pixels, [W, H]. */
async function storedSize(slug) {
  if (storeKind() !== "local") throw new Error("This reads the local file store only.");
  const db = await connect();
  let file;
  try {
    const { rows } = await db.query(`SELECT cutout_path FROM products WHERE slug = $1`, [slug]);
    file = rows[0]?.cutout_path;
  } finally {
    await db.close();
  }
  if (!file?.startsWith("/files/media/products/")) throw new Error(`no stored cutout for "${slug}"`);
  return pngSize(await readFile(path.join(productsDir, path.basename(file))));
}

function usage() {
  console.error(
    "usage: node scripts/set-stove-cutout.mjs trim <png> <out.png>\n" +
      "       node scripts/set-stove-cutout.mjs set <slug> <trimmed.png> <view> <spanL,spanR> <x0,y0,x1,y1> [topFront]\n" +
      "       node scripts/set-stove-cutout.mjs top <slug> <topFront>\n" +
      "       node scripts/set-stove-cutout.mjs flue <slug> <x,y>\n" +
      "       node scripts/set-stove-cutout.mjs face <slug> <trimmed.png> <x0,y0,x1,y1> <wide,tall> <gx0,gy0,gx1,gy1>\n" +
      "       node scripts/set-stove-cutout.mjs export",
  );
  process.exit(2);
}
