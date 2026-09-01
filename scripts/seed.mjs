/**
 * Seeds brands and a starting catalog from the site's own content.
 *
 * Everything here is derived from what stoveworksinc.com already says — the
 * manufacturers it names and the categories it lists them under. Nothing is
 * invented. The catalog rows are placeholders at the "we carry Jotul gas
 * stoves" level; staff replace them with real models (and upload cutouts)
 * through /admin.
 *
 * Idempotent: re-running updates rather than duplicates.
 */

import { readFileSync } from "node:fs";

import { connect } from "./db-driver.mjs";

// --- read the content module without importing TypeScript -------------------

const source = readFileSync(new URL("../src/content/pages.ts", import.meta.url), "utf8");
const body = source.split("export const pages: Page[] = [")[1].split("\n];")[0];
const pages = JSON.parse(`[${body}]`);

// --- which page means which kind of product ---------------------------------

const CATALOG = {
  "stoves/gas-stoves": { category: "stove", fuel: "gas", label: "Gas Stoves" },
  "stoves/wood-stoves": { category: "stove", fuel: "wood", label: "Wood Stoves" },
  "inserts/gas-inserts": { category: "insert", fuel: "gas", label: "Gas Inserts" },
  "inserts/wood-inserts": { category: "insert", fuel: "wood", label: "Wood Inserts" },
  "fireplaces/gas-fireplaces": { category: "fireplace", fuel: "gas", label: "Gas Fireplaces" },
  "fireplaces/wood-fireplaces": { category: "fireplace", fuel: "wood", label: "Wood Fireplaces" },
  "fireplaces/electric-fireplaces": { category: "fireplace", fuel: "electric", label: "Electric Fireplaces" },
  "specialty-hearth/glass-doors": { category: "hearth", fuel: "multi", label: "Glass Doors" },
  "specialty-hearth/hearth-pads": { category: "hearth", fuel: "multi", label: "Hearth Pads" },
  "specialty-hearth/gas-logs": { category: "hearth", fuel: "gas", label: "Gas Logs" },
  "specialty-hearth/outdoor-rings-grills": { category: "hearth", fuel: "wood", label: "Outdoor Rings & Grills" },
  "specialty-hearth/hot-tubs-sauna-stoves": { category: "hearth", fuel: "wood", label: "Hot Tubs & Sauna Stoves" },
  "specialty-hearth/refrigerators-cook-stoves": { category: "hearth", fuel: "multi", label: "Cook Stoves" },
};

/** The same manufacturer is spelled a few different ways across the pages. */
const CANONICAL = {
  KozyHeat: "Kozy Heat",
  "Morsø": "Morso",
  "Town & Country Fireplaces": "Town & Country",
  "St. Croix Stone by Environmental StoneWorks": "Environmental StoneWorks",
  Hearthstone: "HearthStone",
};

/** Logos that appear without a brand heading, so the name comes from the alt text. */
const FROM_LOGO = {
  "/images/heartland-stove.jpg": { name: "Heartland", url: null },
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// --- collect brands and their category placements ---------------------------

const brands = new Map(); // name -> { name, slug, url, logo }
const placements = []; // { brandName, slug, category, fuel, label, summary }

function noteBrand(rawName, logo) {
  const name = CANONICAL[rawName] ?? rawName;
  const existing = brands.get(name);
  const url = logo?.href && logo.href.startsWith("http") ? logo.href : null;
  if (existing) {
    existing.url ??= url;
    existing.logo ??= logo?.src ?? null;
  } else {
    brands.set(name, { name, slug: slugify(name), url, logo: logo?.src ?? null });
  }
  return name;
}

for (const page of pages) {
  const entry = CATALOG[page.slug];

  for (const section of page.sections) {
    if (section.type === "brand") {
      const name = noteBrand(section.name, section.logo);
      if (entry) {
        placements.push({
          brandName: name,
          ...entry,
          summary: section.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        });
      }
      continue;
    }

    // Pages that show manufacturer logos without a brand heading.
    const media =
      section.type === "prose-aside" ? section.aside : section.type === "media-grid" ? section.items : [];

    for (const m of media) {
      const known = FROM_LOGO[m.src];
      // A manufacturer logo links out to the manufacturer. Anything else in
      // these slots is a decorative photo, and its alt text is a filename.
      const isLogo = Boolean(known) || m.href?.startsWith("http");
      if (!isLogo) continue;

      const name = known?.name ?? m.alt?.trim();
      if (!name) continue;
      // Skip the trade-association logos on /services.
      if (/^(NABA|NAHB|NCHPBA)/i.test(name)) continue;

      const brandName = noteBrand(name, m);
      if (entry) placements.push({ brandName, ...entry, summary: null });
    }
  }
}

// --- write ------------------------------------------------------------------

const db = await connect();
console.log(`→ ${db.label}`);

try {
  let brandCount = 0;
  for (const [i, b] of [...brands.values()].entries()) {
    await db.query(
      `INSERT INTO brands (slug, name, website_url, logo_path, sort)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             website_url = COALESCE(EXCLUDED.website_url, brands.website_url),
             logo_path = COALESCE(EXCLUDED.logo_path, brands.logo_path)`,
      [b.slug, b.name, b.url, b.logo, i],
    );
    brandCount += 1;
  }

  const { rows: brandRows } = await db.query(`SELECT id, slug, name FROM brands`);
  const brandId = new Map(brandRows.map((r) => [r.name, r.id]));

  // Dedupe: one catalog row per brand + category + fuel.
  const seen = new Set();
  let productCount = 0;

  for (const p of placements) {
    const slug = `${slugify(p.brandName)}-${slugify(p.label)}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    await db.query(
      `INSERT INTO products (brand_id, slug, name, category, fuel, summary, sort)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE
         SET brand_id = EXCLUDED.brand_id,
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             fuel = EXCLUDED.fuel,
             summary = COALESCE(products.summary, EXCLUDED.summary),
             updated_at = now()`,
      [
        brandId.get(p.brandName) ?? null,
        slug,
        `${p.brandName} — ${p.label}`,
        p.category,
        p.fuel,
        p.summary,
        productCount,
      ],
    );
    productCount += 1;
  }

  console.log(`✓ ${brandCount} brands, ${productCount} catalog entries`);

  const { rows: summary } = await db.query(
    `SELECT category, fuel, count(*)::int AS n FROM products GROUP BY 1, 2 ORDER BY 1, 2`,
  );
  for (const r of summary) console.log(`    ${r.category.padEnd(10)} ${r.fuel.padEnd(9)} ${r.n}`);

  const { rows: missing } = await db.query(
    `SELECT count(*)::int AS n FROM products WHERE cutout_path IS NULL`,
  );
  console.log(`\n  ${missing[0].n} products still need a cutout image — upload via /admin.`);
} catch (err) {
  console.error("✗ seed failed:", err);
  process.exitCode = 1;
} finally {
  await db.close();
}
