/**
 * Puts Hearth Studio's cutouts and sizes from db/hearth-studio/ into this site's database and
 * file store (App Storage on Replit, var/uploads locally):
 *
 *   npm run studio:load
 *
 * Until the stove admin has its sizing step (7d), products are sized on a local copy with
 * scripts/set-stove-cutout.mjs, which writes that folder. This carries them to the live site, and
 * `npm run start:live` runs it after brain:load, which makes the product rows. Safe to re-run.
 *
 * What staff do on a site wins. A product gets the folder's cutout and sizes when it has no
 * cutout, or when it still has the one this put there last time (so a product re-measured or
 * re-cut on the laptop follows the folder). A product whose cutout staff changed or removed on
 * the site keeps theirs.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { connect } from "./db-driver.mjs";
import { writeMedia } from "./store-driver.mjs";

const SEED = path.resolve("db", "hearth-studio");
const FACTS = [
  "cutout_view", "cutout_span", "cutout_width_in", "glass_box",
  "cutout_top_front", "cutout_flue", "viewing_box", "viewing_in",
];
/** catalog_meta key: { applied: { <slug>: the cutout_path this last set } } */
const META = "hearth_studio";

/** Equal as stored: numbers to within float4's precision, arrays item by item. */
function same(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  const x = Number(a), y = Number(b);
  return Number.isNaN(x) || Number.isNaN(y) ? a === b : Math.abs(x - y) < 1e-6;
}

let seed;
try {
  seed = JSON.parse(await readFile(path.join(SEED, "products.json"), "utf8"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  console.log("· no db/hearth-studio/products.json, so nothing to load");
  process.exit(0);
}

const db = await connect();
console.log(`→ ${db.label}`);

const done = { added: [], updated: [], kept: [], missing: [], failed: [] };
let ok = false;
try {
  const { rows: ready } = await db.query(
    `SELECT to_regclass('catalog_meta') IS NOT NULL AS meta,
            EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = current_schema() AND table_name = 'products'
                       AND column_name = 'viewing_in') AS cols`,
  );
  if (!ready[0].cols) throw new Error("the products table hasn't got Hearth Studio's columns: run `npm run db:migrate` first");
  if (!ready[0].meta) throw new Error("the catalog isn't loaded, so there are no products yet: run `npm run brain:load` first");

  const { rows: meta } = await db.query(`SELECT value FROM catalog_meta WHERE key = $1`, [META]);
  const applied = { ...(meta[0]?.value?.applied ?? {}) };

  for (const p of seed) {
    const want = `/files/media/products/${p.cutout}`;
    const { rows } = await db.query(`SELECT cutout_path, ${FACTS.join(", ")} FROM products WHERE slug = $1`, [p.slug]);
    const row = rows[0];
    if (!row) {
      done.missing.push(p.slug);
      continue;
    }
    const have = row.cutout_path;
    const ours = have === want || (have == null ? !(p.slug in applied) : have === applied[p.slug]);
    if (!ours) {
      done.kept.push(p.slug);
      continue;
    }
    if (have === want && FACTS.every((f) => same(row[f], p[f]))) {
      applied[p.slug] = want;
      continue;
    }
    try {
      if (have !== want) await writeMedia(`products/${p.cutout}`, await readFile(path.join(SEED, "cutouts", p.cutout)));
      await db.query(
        `UPDATE products
            SET cutout_path = $2, ${FACTS.map((f, i) => `${f} = $${i + 3}`).join(", ")}, updated_at = now()
          WHERE slug = $1`,
        [p.slug, want, ...FACTS.map((f) => p[f] ?? null)],
      );
      (have == null ? done.added : done.updated).push(p.slug);
      applied[p.slug] = want;
    } catch (err) {
      done.failed.push(`${p.slug}: ${err.message}`);
    }
  }

  await db.query(
    `INSERT INTO catalog_meta (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [META, JSON.stringify({ applied })],
  );
  ok = true;
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}

if (ok) {
  const changed = done.added.length + done.updated.length;
  console.log(
    `✓ Hearth Studio: ${seed.length} products in db/hearth-studio · ` +
      (changed ? `${done.added.length} added, ${done.updated.length} updated` : "no changes"),
  );
  if (done.kept.length) console.log(`  kept the cutout staff set on this site: ${done.kept.join(", ")}`);
  if (done.missing.length) console.log(`  ! not in the catalog, so skipped: ${done.missing.join(", ")}`);
  if (done.failed.length) {
    console.error(`  ✗ ${done.failed.join("\n  ✗ ")}`);
    process.exitCode = 1;
  }
}
