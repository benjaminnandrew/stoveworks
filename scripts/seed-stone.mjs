/**
 * Seeds the stone veneer catalogue.
 *
 * Deliberately conservative. The live site says Cultured Stone offers "more
 * than 21 textures and more than 100 colors" but names none of them, so this
 * seeds the profile families only — no invented colour names, no invented SKUs.
 * Staff add colour variants and confirm the list against the current catalogue
 * through /admin/stone.
 *
 * Coverage figures are the industry-typical 10 sq ft per box of flats and
 * 6 linear ft per box of corners. They are marked for confirmation in the
 * admin UI because they vary by profile.
 *
 * Idempotent: re-running updates rather than duplicates.
 */

import { connect } from "./db-driver.mjs";

const BRAND = "Cultured Stone";

/** Profile families. `needsReview` drives the notice shown in admin. */
const PROFILES = [
  "Country Ledgestone",
  "Southern Ledgestone",
  "Pro-Fit Alpine Ledgestone",
  "Dressed Fieldstone",
  "Cobblefield",
  "Limestone",
  "Hewn Stone",
  "River Rock",
  "Used Brick",
  "Handmade Brick",
];

const TYPICAL_FLAT_SQFT_PER_BOX = 10;
const TYPICAL_CORNER_LNFT_PER_BOX = 6;

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const db = await connect();
console.log(`→ ${db.label}`);

try {
  const brand = await db.query(`SELECT id FROM brands WHERE name = $1`, [BRAND]);
  const brandId = brand.rows[0]?.id ?? null;

  if (!brandId) {
    console.warn(`  ! "${BRAND}" is not in brands — run db:seed first. Seeding unattached.`);
  }

  let n = 0;
  for (const [i, texture] of PROFILES.entries()) {
    const slug = `cultured-stone-${slugify(texture)}`;
    await db.query(
      `INSERT INTO stone_products
         (brand_id, slug, name, texture, color, summary,
          swatch_width_in, swatch_height_in,
          flat_sqft_per_box, corner_lnft_per_box, product_url, sort)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (slug) DO UPDATE
         SET brand_id = EXCLUDED.brand_id,
             name = EXCLUDED.name,
             texture = EXCLUDED.texture,
             product_url = COALESCE(stone_products.product_url, EXCLUDED.product_url),
             updated_at = now()`,
      [
        brandId,
        slug,
        `${BRAND} — ${texture}`,
        texture,
        `${texture} profile from ${BRAND}. Colour options and the swatch image still need adding.`,
        24,
        16,
        TYPICAL_FLAT_SQFT_PER_BOX,
        TYPICAL_CORNER_LNFT_PER_BOX,
        "https://www.culturedstone.com/",
        i,
      ],
    );
    n += 1;
  }

  console.log(`✓ ${n} stone profiles seeded for ${BRAND}`);

  const { rows: missing } = await db.query(
    `SELECT count(*)::int AS n FROM stone_products WHERE swatch_path IS NULL`,
  );
  console.log(`\n  ${missing[0].n} profiles still need a swatch image — upload via /admin/stone.`);
  console.log(`  Colour variants and the full 21+ texture list need adding there too.`);
} catch (err) {
  console.error("✗ stone seed failed:", err);
  process.exitCode = 1;
} finally {
  await db.close();
}
