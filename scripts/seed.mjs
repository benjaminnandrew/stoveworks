/**
 * Seeds the site's brands from its own content: the manufacturers
 * stoveworksinc.com names, with their logos and links. Nothing is invented.
 *
 * Products are not seeded here any more. The visualizer's products are the
 * manufacturer catalog's real models, added by `npm run brain:load` (Ben,
 * Oct 13: the 200 real models replace the old placeholder rows).
 *
 * Idempotent: re-running updates rather than duplicates.
 */

import { readFileSync } from "node:fs";

import { connect } from "./db-driver.mjs";

// --- read the content module without importing TypeScript -------------------

const source = readFileSync(new URL("../src/content/pages.ts", import.meta.url), "utf8");
const body = source.split("export const pages: Page[] = [")[1].split("\n];")[0];
const pages = JSON.parse(`[${body}]`);

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

// --- collect brands ---------------------------------------------------------

const brands = new Map(); // name -> { name, slug, url, logo }

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
  for (const section of page.sections) {
    if (section.type === "brand") {
      // A brand without a logo file yet still records its website.
      noteBrand(section.name, section.logo ?? (section.website ? { href: section.website } : undefined));
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

      noteBrand(name, m);
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

  console.log(`✓ ${brandCount} brands`);

  const { rows: products } = await db.query(
    `SELECT count(*)::int AS n FROM products WHERE catalog_model_id IS NOT NULL`,
  );
  if (!products[0].n) {
    console.log("\n  Products come from the manufacturer catalog: run `npm run brain:load` next.");
  }
} catch (err) {
  console.error("✗ seed failed:", err);
  process.exitCode = 1;
} finally {
  await db.close();
}
