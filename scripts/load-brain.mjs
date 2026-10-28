/**
 * Loads the brain (brain/) into the database's catalog_* tables.
 *
 *   npm run brain:load                    load, or refresh after the brain changes
 *   npm run brain:load -- --dry-run       show what would change; write nothing
 *   npm run brain:load -- --brain <dir>   read the brain from another folder
 *
 * Safe to re-run. Each run brings the tables in line with the brain (adding,
 * updating and removing rows) inside one transaction, so the site never sees a
 * half-loaded catalog. carry_status is the exception: once staff set it, the
 * loader leaves it alone.
 *
 * It also records which photos and PDFs are actually in storage (the
 * var/brain-assets folder locally, the app's App Storage bucket on Replit), so
 * run it again after uploading files.
 *
 * It creates its tables if they're missing (db/catalog.sql, idempotent), so it
 * works on a fresh database. It changes no table structure outside them, so a
 * load doesn't lock the site's tables while it runs.
 *
 * It also keeps the visualizer's product list (the products table) in step with
 * the catalog: one product per model, the old placeholder rows retired. Staff
 * keep what they own there: cutouts, whether a product is live, and the summary
 * and sizes once set. That step needs `npm run db:migrate` to have run.
 *
 * A model that drops out of the brain is removed, unless staff have set its
 * carry_status: then it's kept and marked retired (retired_at), so their mark
 * isn't lost, and cleared again if the model comes back.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { connect } from "./db-driver.mjs";
import { buildSearchRows } from "./search-rows.mjs";
import { listCatalogFiles } from "./store-driver.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
function option(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

const BRAIN = path.resolve(option("--brain", "brain"));
const DRY_RUN = flag("--dry-run");

const IMAGE_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

/** The guide template's one line saying where manuals live; /guides/<id>/ rewrites it. */
const MANUAL_BASE_LINE = /const MANUAL_BASE = "[^"\n]*";/g;

// --- small helpers ------------------------------------------------------------

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const shown = (p) => (path.relative(process.cwd(), p) || ".").split(path.sep).join("/");

function readJson(rel) {
  const file = path.join(BRAIN, rel);
  if (!existsSync(file)) {
    fail(`Can't find ${file}.\n  Run this from the site folder (the one with brain/ in it), or pass --brain <folder>.`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function int(v) {
  const n = num(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

const text = (v) => (v === undefined || v === null ? null : String(v));
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function* chunks(rows, size) {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}

// --- read and check the brain ---------------------------------------------------

const brands = readJson("data/brands.json");
const models = readJson("data/models.json");
const candidates = readJson("data/candidates.json");
const shapes = readJson("data/shapes.json");
const images = readJson("assets/images.json");
const documents = readJson("assets/documents.json");
const manuals = readJson("assets/manuals.json");
const guideIndex = readJson("guides/guides.json");
const guides = guideIndex.guides ?? [];

const problems = [];
const brandSlugs = new Set(brands.map((b) => b.slug));
const modelIds = new Set();
for (const m of models) {
  if (modelIds.has(m.id)) problems.push(`model ${m.id} is listed twice`);
  modelIds.add(m.id);
  if (!brandSlugs.has(m.brand_slug)) problems.push(`model ${m.id}: unknown brand "${m.brand_slug}"`);
}
const imageKeyByUrl = new Map(images.map((e) => [e.url, e.storage_key]));
const documentKeyByUrl = new Map(documents.map((e) => [e.url, e.storage_key]));
const documentByKey = new Map(documents.map((e) => [e.storage_key, e]));
const documentKeys = new Set(documentByKey.keys());
const guideIds = new Set(guides.map((g) => g.id));
if (imageKeyByUrl.size !== images.length) problems.push("assets/images.json lists a photo twice");
if (documentKeys.size !== documents.length) problems.push("assets/documents.json lists a PDF twice");
if (guideIds.size !== guides.length) problems.push("guides/guides.json lists a guide twice");
for (const m of models) {
  for (const img of m.images ?? []) {
    if (!imageKeyByUrl.has(img.url)) problems.push(`model ${m.id}: photo not in assets/images.json: ${img.url}`);
  }
  for (const d of m.documents ?? []) {
    if (!documentKeyByUrl.has(d.url)) problems.push(`model ${m.id}: PDF not in assets/documents.json: ${d.url}`);
  }
  for (const lm of m.latest_manuals ?? []) {
    if (!documentKeys.has(lm.storage_key)) problems.push(`model ${m.id}: manual not in assets/documents.json: ${lm.storage_key}`);
  }
  for (const g of m.guides ?? []) {
    if (!guideIds.has(g.id)) problems.push(`model ${m.id}: guide not in guides/guides.json: ${g.id}`);
  }
}
for (const g of guides) {
  for (const id of g.model_ids ?? []) if (!modelIds.has(id)) problems.push(`guide ${g.id}: unknown model ${id}`);
}
if (problems.length) {
  fail(`The brain has ${plural(problems.length, "broken reference")}:\n  ${problems.slice(0, 20).join("\n  ")}`);
}

// --- what's actually in storage ------------------------------------------------

let store;
try {
  store = await listCatalogFiles();
} catch (err) {
  fail(err.message);
}

// Photos are stored as <storage key>.<ext>, the extension read from the file itself.
const imageObjectByKey = new Map();
for (const objectPath of store.files.keys()) {
  if (!objectPath.startsWith("images/")) continue;
  const dot = objectPath.lastIndexOf(".");
  if (dot <= objectPath.lastIndexOf("/")) continue;
  if (IMAGE_TYPES[objectPath.slice(dot + 1).toLowerCase()]) imageObjectByKey.set(objectPath.slice(0, dot), objectPath);
}

// --- rows -------------------------------------------------------------------------

const brandRows = brands.map((b) => ({
  slug: b.slug,
  name: b.name,
  website: text(b.website),
  status: text(b.status),
  about: text(b.about),
  model_count: int(b.model_count),
  browse: b.browse ?? null,
  data: b,
}));

const modelRows = models.map((m) => {
  const h = m.headline ?? {};
  return {
    id: m.id,
    brand_slug: m.brand_slug,
    name: m.name,
    official_name: text(m.official_name),
    model_numbers: (m.model_numbers ?? []).map(String),
    form: text(m.form),
    fuel: text(m.fuel),
    install_type: text(m.install_type),
    venting: text(m.venting),
    series: text(m.series),
    style: text(m.style),
    shape_group: text(m.shape?.group),
    shape: m.shape ?? null,
    flame_pattern: m.flame_pattern ?? null,
    viewing: m.viewing ?? null,
    lineup_status: text(m.lineup_status),
    us_availability: text(m.us_availability),
    availability_note: text(m.availability_note),
    description: text(m.description),
    features: m.features ?? [],
    heating_area_sqft_max: num(h.heating_area_sqft_max),
    btu: num(h.btu),
    btu_basis: text(h.btu_basis),
    efficiency_pct: num(h.efficiency_pct),
    efficiency_basis: text(h.efficiency_basis),
    log_length_max_in: num(h.log_length_max_in),
    burn_time_hr_max: num(h.burn_time_hr_max),
    headline: m.headline ?? null,
    specs: m.specs ?? {},
    sizes: m.sizes ?? [],
    specs_raw: m.specs_raw ?? [],
    manual_differences: m.manual_differences ?? [],
    hero_image_url: text(m.hero_image),
    product_url: text(m.product_url),
    checked_on: /^\d{4}-\d{2}-\d{2}$/.test(m.checked_on ?? "") ? m.checked_on : null,
    carry_status: text(m.carry_status) ?? "unconfirmed",
    data: m,
  };
});

const imageRows = images.map((e) => {
  const objectPath = imageObjectByKey.get(e.storage_key) ?? null;
  return {
    id: e.storage_key,
    url: e.url,
    brand_slug: text(e.brand_slug),
    object_path: objectPath,
    content_type: objectPath ? IMAGE_TYPES[objectPath.split(".").pop().toLowerCase()] : null,
    bytes: objectPath ? (store.files.get(objectPath) ?? null) : null,
  };
});

const latestManualKeys = new Set(manuals.map((e) => e.storage_key));
const pagesByKey = new Map();
for (const g of guides) {
  for (const mm of g.manuals ?? []) if (int(mm.pages) !== null) pagesByKey.set(mm.storage_key, int(mm.pages));
}
const documentRows = documents.map((e) => {
  const stored = store.files.has(e.storage_key);
  return {
    id: e.storage_key,
    url: e.url,
    brand_slug: text(e.brand_slug),
    title: text(e.title),
    types: (e.types ?? []).filter(Boolean).map(String),
    languages: (e.languages ?? []).filter(Boolean).map(String),
    latest_manual: latestManualKeys.has(e.storage_key),
    pages: pagesByKey.get(e.storage_key) ?? null,
    object_path: stored ? e.storage_key : null,
    bytes: stored ? (store.files.get(e.storage_key) ?? null) : null,
  };
});

const guideRows = guides.map((g) => {
  const file = path.resolve(BRAIN, g.file ?? `guides/${g.id}.html`);
  if (!file.startsWith(BRAIN + path.sep)) fail(`Guide ${g.id}: its file is outside the brain folder.`);
  if (!existsSync(file)) fail(`Guide ${g.id}: missing page ${shown(file)}.`);
  const html = readFileSync(file, "utf8");
  const lines = html.match(MANUAL_BASE_LINE)?.length ?? 0;
  if (lines !== 1) {
    fail(`Guide ${g.id}: expected one MANUAL_BASE line, found ${lines}. Rebuild it with the current guide template.`);
  }
  return {
    id: g.id,
    title: g.title,
    configuration: text(g.configuration),
    manuals: g.manuals ?? [],
    conflicts_flagged: int(g.conflicts_flagged),
    conflicts_by_class: g.conflicts_by_class ?? null,
    manual_differences: int(g.manual_differences),
    html,
    html_sha256: sha256(html),
    data: g,
  };
});

// The site search's rows (scripts/search-rows.mjs), rebuilt only when they change.
const search = buildSearchRows({ brain: BRAIN, guides, htmlById: new Map(guideRows.map((r) => [r.id, r.html])) });
const searchSha = sha256(JSON.stringify([search.sections, search.pages]));

const modelImageRows = [];
const modelDocumentRows = [];
const modelGuideRows = [];
for (const m of models) {
  (m.images ?? []).forEach((img, i) =>
    modelImageRows.push({
      model_id: m.id,
      sort: i,
      image_id: imageKeyByUrl.get(img.url),
      role: text(img.role),
      variant: text(img.variant),
      alt: text(img.alt),
      width: int(img.width),
      height: int(img.height),
      source_page: text(img.source_page),
    }),
  );

  const docs = new Map();
  (m.documents ?? []).forEach((d, i) => {
    const id = documentKeyByUrl.get(d.url);
    if (docs.has(id)) return;
    docs.set(id, {
      model_id: m.id,
      document_id: id,
      sort: i,
      doc_type: text(d.type),
      language: text(d.language),
      latest_manual: false,
      configuration: null,
      role: null,
      revision: null,
      revision_date: null,
    });
  });
  for (const lm of m.latest_manuals ?? []) {
    // A newest manual is normally also in the model's documents list; if not, take its
    // type and language from assets/documents.json.
    const listed = documentByKey.get(lm.storage_key);
    const row = docs.get(lm.storage_key) ?? {
      model_id: m.id,
      document_id: lm.storage_key,
      sort: docs.size,
      doc_type: text(listed?.types?.[0]),
      language: text(listed?.languages?.[0]),
    };
    Object.assign(row, {
      latest_manual: true,
      configuration: text(lm.configuration),
      role: text(lm.role),
      revision: text(lm.revision),
      revision_date: text(lm.date),
    });
    docs.set(lm.storage_key, row);
  }
  modelDocumentRows.push(...docs.values());

  (m.guides ?? []).forEach((g, i) =>
    modelGuideRows.push({ model_id: m.id, guide_id: g.id, sort: i, configuration: text(g.configuration) }),
  );
}

const candidateRows = candidates.map((c, i) => ({
  id: i + 1,
  brand: text(c.brand),
  name: text(c.name),
  url: text(c.url),
  category: text(c.category),
  note: text(c.note),
  data: c,
}));

// --- columns (name, type as read from JSON) --------------------------------------

const BRAND_COLS = [
  ["slug", "text"], ["name", "text"], ["website", "text"], ["status", "text"], ["about", "text"],
  ["model_count", "integer"], ["browse", "jsonb"], ["data", "jsonb"],
];
const MODEL_COLS = [
  ["id", "text"], ["brand_slug", "text"], ["name", "text"], ["official_name", "text"],
  ["model_numbers", "text[]"], ["form", "text"], ["fuel", "text"], ["install_type", "text"],
  ["venting", "text"], ["series", "text"], ["style", "text"], ["shape_group", "text"],
  ["shape", "jsonb"], ["flame_pattern", "jsonb"], ["viewing", "jsonb"], ["lineup_status", "text"],
  ["us_availability", "text"], ["availability_note", "text"], ["description", "text"],
  ["features", "jsonb"], ["heating_area_sqft_max", "numeric"], ["btu", "numeric"],
  ["btu_basis", "text"], ["efficiency_pct", "numeric"], ["efficiency_basis", "text"],
  ["log_length_max_in", "numeric"], ["burn_time_hr_max", "numeric"], ["headline", "jsonb"],
  ["specs", "jsonb"], ["sizes", "jsonb"], ["specs_raw", "jsonb"], ["manual_differences", "jsonb"],
  ["hero_image_url", "text"], ["product_url", "text"], ["checked_on", "date"],
  ["carry_status", "text"], ["data", "jsonb"],
];
const IMAGE_COLS = [
  ["id", "text"], ["url", "text"], ["brand_slug", "text"], ["object_path", "text"],
  ["content_type", "text"], ["bytes", "bigint"],
];
const DOCUMENT_COLS = [
  ["id", "text"], ["url", "text"], ["brand_slug", "text"], ["title", "text"], ["types", "text[]"],
  ["languages", "text[]"], ["latest_manual", "boolean"], ["pages", "integer"],
  ["object_path", "text"], ["bytes", "bigint"],
];
const GUIDE_META_COLS = [
  ["id", "text"], ["title", "text"], ["configuration", "text"], ["manuals", "jsonb"],
  ["conflicts_flagged", "integer"], ["conflicts_by_class", "jsonb"], ["manual_differences", "integer"],
  ["data", "jsonb"],
];
const GUIDE_COLS = [...GUIDE_META_COLS, ["html", "text"], ["html_sha256", "text"]];
const MODEL_IMAGE_COLS = [
  ["model_id", "text"], ["sort", "integer"], ["image_id", "text"], ["role", "text"],
  ["variant", "text"], ["alt", "text"], ["width", "integer"], ["height", "integer"],
  ["source_page", "text"],
];
const MODEL_DOCUMENT_COLS = [
  ["model_id", "text"], ["document_id", "text"], ["sort", "integer"], ["doc_type", "text"],
  ["language", "text"], ["latest_manual", "boolean"], ["configuration", "text"], ["role", "text"],
  ["revision", "text"], ["revision_date", "text"],
];
const MODEL_GUIDE_COLS = [["model_id", "text"], ["guide_id", "text"], ["sort", "integer"], ["configuration", "text"]];
const SECTION_COLS = [
  ["guide_id", "text"], ["key", "text"], ["sort", "integer"], ["audience", "text"], ["kind", "text"],
  ["title", "text"], ["terms", "text"], ["body", "text"], ["document_id", "text"], ["page", "integer"],
  ["link", "text"], ["safety", "boolean"],
];
const MANUAL_PAGE_COLS = [["document_id", "text"], ["page", "integer"], ["body", "text"]];
const CANDIDATE_COLS = [
  ["id", "integer"], ["brand", "text"], ["name", "text"], ["url", "text"], ["category", "text"],
  ["note", "text"], ["data", "jsonb"],
];

// Staff own carry_status once they've set it.
const KEEP_STAFF_CARRY_STATUS = {
  carry_status: {
    set: "carry_status = CASE WHEN t.carry_status_set_at IS NULL THEN EXCLUDED.carry_status ELSE t.carry_status END",
    changed: "(t.carry_status_set_at IS NULL AND t.carry_status IS DISTINCT FROM EXCLUDED.carry_status)",
  },
};

// --- database ---------------------------------------------------------------------

const db = await connect();
console.log(`→ ${db.label}`);
console.log(`  brain: ${shown(BRAIN)} · files: ${store.label}`);

/**
 * Insert new rows and update changed ones (rows that are already identical are
 * left alone, so updated_at means "last changed"). Returns counts.
 */
async function upsert(table, key, cols, rows, { special = {}, size = 400 } = {}) {
  const names = cols.map(([n]) => n);
  const defs = cols.map(([n, t]) => `${n} ${t}`).join(", ");
  const others = names.filter((n) => n !== key);
  const sets = others.map((n) => special[n]?.set ?? `${n} = EXCLUDED.${n}`);
  const changed = others.map((n) => special[n]?.changed ?? `t.${n} IS DISTINCT FROM EXCLUDED.${n}`);
  const sql = `
    INSERT INTO ${table} AS t (${names.join(", ")})
    SELECT ${names.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS x(${defs})
    ON CONFLICT (${key}) DO UPDATE SET ${sets.join(", ")}, updated_at = now()
    WHERE ${changed.join(" OR ")}
    RETURNING (t.xmax = 0) AS inserted`;
  let added = 0;
  let updated = 0;
  for (const chunk of chunks(rows, size)) {
    const { rows: out } = await db.query(sql, [JSON.stringify(chunk)]);
    for (const r of out) r.inserted ? added++ : updated++;
  }
  return { total: rows.length, added, updated };
}

/** Guides carry ~36 MB of pages, so only send the pages that changed. */
async function upsertGuides(rows) {
  const { rows: existing } = await db.query("SELECT id, html_sha256 FROM catalog_guides");
  const known = new Map(existing.map((r) => [r.id, r.html_sha256]));
  const withPage = rows.filter((r) => known.get(r.id) !== r.html_sha256);
  const metaOnly = rows.filter((r) => known.get(r.id) === r.html_sha256);

  const result = { total: rows.length, added: 0, updated: 0 };
  // Batches of roughly 8 MB.
  let batch = [];
  let bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    const r = await upsert("catalog_guides", "id", GUIDE_COLS, batch, { size: batch.length });
    result.added += r.added;
    result.updated += r.updated;
    batch = [];
    bytes = 0;
  };
  for (const row of withPage) {
    batch.push(row);
    bytes += row.html.length;
    if (bytes > 8_000_000) await flush();
  }
  await flush();

  if (metaOnly.length) {
    const names = GUIDE_META_COLS.map(([n]) => n);
    const defs = GUIDE_META_COLS.map(([n, t]) => `${n} ${t}`).join(", ");
    const others = names.filter((n) => n !== "id");
    const { rows: out } = await db.query(
      `UPDATE catalog_guides AS t SET ${others.map((n) => `${n} = x.${n}`).join(", ")}, updated_at = now()
       FROM jsonb_to_recordset($1::jsonb) AS x(${defs})
       WHERE t.id = x.id AND (${others.map((n) => `t.${n} IS DISTINCT FROM x.${n}`).join(" OR ")})
       RETURNING t.id`,
      [JSON.stringify(metaOnly.map(({ html, html_sha256, ...meta }) => meta))],
    );
    result.updated += out.length;
  }
  return result;
}

/** Link tables are rebuilt whole: cheaper to reason about than a diff. */
async function replaceAll(table, cols, rows) {
  const names = cols.map(([n]) => n);
  const defs = cols.map(([n, t]) => `${n} ${t}`).join(", ");
  await db.query(`DELETE FROM ${table}`);
  for (const chunk of chunks(rows, 1000)) {
    await db.query(
      `INSERT INTO ${table} (${names.join(", ")}) SELECT ${names.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS x(${defs})`,
      [JSON.stringify(chunk)],
    );
  }
}

/** Delete rows whose key isn't in `keep` (and that match `onlyIf`, an extra SQL condition). */
async function removeMissing(table, key, keep, onlyIf = "TRUE") {
  const { rows } = await db.query(
    `DELETE FROM ${table}
     WHERE ${key} NOT IN (SELECT jsonb_array_elements_text($1::jsonb)) AND (${onlyIf})
     RETURNING ${key} AS key`,
    [JSON.stringify([...keep])],
  );
  return rows.map((r) => r.key);
}

/** The search rows are ~20 MB of text, so they're only rewritten when the guides changed them. */
async function syncSearchRows() {
  const { rows: meta } = await db.query("SELECT value FROM catalog_meta WHERE key = 'search'");
  const { rows: [count] } = await db.query("SELECT count(*)::int AS n FROM catalog_guide_sections");
  const out = { sections: search.sections.length, pages: search.pages.length, changed: false };
  if (meta[0]?.value?.sha256 === searchSha && count.n > 0) return out;
  await replaceAll("catalog_guide_sections", SECTION_COLS, search.sections);
  await replaceAll("catalog_manual_pages", MANUAL_PAGE_COLS, search.pages);
  await setMeta("search", { sha256: searchSha, sections: search.sections.length, pages: search.pages.length });
  return { ...out, changed: true };
}

async function setMeta(key, value) {
  await db.query(
    `INSERT INTO catalog_meta (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

// --- the visualizer's products ------------------------------------------------------

/** Brand names as the site shows them in product names. */
const SHORT_BRAND = {
  "Mendota Hearth": "Mendota",
  "Town & Country Fireplaces": "Town & Country",
  "Wilkening Fireplace": "Wilkening",
};
/** Catalog brand slugs that the site's brands table spells differently. */
const SITE_BRAND_SLUG = { "town-country": "town-and-country" };
const CATEGORY_OF = { stove: "stove", insert: "insert", fireplace: "fireplace", cook_stove: "hearth", outdoor_fireplace: "fireplace" };
const FUELS = new Set(["gas", "wood", "electric", "pellet"]);

const PRODUCT_COLS = [
  ["catalog_model_id", "text"], ["slug", "text"], ["brand_id", "integer"], ["name", "text"],
  ["category", "text"], ["fuel", "text"], ["summary", "text"], ["width_in", "numeric"],
  ["height_in", "numeric"], ["depth_in", "numeric"], ["product_url", "text"], ["is_active", "boolean"],
];

/**
 * One product per catalog model. Sizes come from the catalog only for
 * freestanding stoves: for inserts and fireplaces the catalog gives the unit's
 * or the framing width, not the visible front the visualizer scales, so staff
 * enter that with the cutout.
 */
async function syncProducts() {
  const { rows: ready } = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'catalog_model_id'`,
  );
  if (!ready.length) return { skipped: true };

  // Brands: match the site's brands by slug, adding any the site doesn't list yet.
  const brandName = new Map(brands.map((b) => [b.slug, b.name]));
  const siteBrandId = new Map();
  for (const b of brands) {
    const slug = SITE_BRAND_SLUG[b.slug] ?? b.slug;
    const { rows } = await db.query(
      `INSERT INTO brands (slug, name, website_url) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id, (xmax = 0) AS inserted`,
      [slug, SHORT_BRAND[b.name] ?? b.name, text(b.website)],
    );
    siteBrandId.set(b.slug, rows[0].id);
    if (rows[0].inserted) productsResult.brandsAdded.push(slug);
  }

  const rows = modelRows.map((m) => {
    const stove = m.install_type === "freestanding";
    const size = (k) => (stove && num(m.specs?.[k]) > 0 ? num(m.specs[k]) : null);
    return {
      catalog_model_id: m.id,
      slug: m.id,
      brand_id: siteBrandId.get(m.brand_slug) ?? null,
      name: `${SHORT_BRAND[brandName.get(m.brand_slug)] ?? brandName.get(m.brand_slug)} ${m.name}`.slice(0, 200),
      category: CATEGORY_OF[m.form] ?? "hearth",
      fuel: FUELS.has(m.fuel) ? m.fuel : "multi",
      summary: m.description,
      width_in: size("width_in"),
      height_in: size("height_in"),
      depth_in: size("depth_in"),
      product_url: m.product_url,
      // Discontinued models start hidden; after that, staff decide what's live.
      is_active: m.lineup_status !== "discontinued" && m.us_availability !== "discontinued",
    };
  });

  // The old placeholder rows (not tied to a model) go, unless a saved design uses
  // one: those stay, hidden, so the design still shows it.
  const { rows: gone } = await db.query(
    `DELETE FROM products p
     WHERE p.catalog_model_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM designs d
                       WHERE d.items @> jsonb_build_array(jsonb_build_object('productId', p.id::text)))
     RETURNING p.slug`,
  );
  const { rows: hidden } = await db.query(
    `UPDATE products SET is_active = false, slug = slug || '-placeholder', updated_at = now()
     WHERE catalog_model_id IS NULL AND slug NOT LIKE '%-placeholder'
     RETURNING slug`,
  );
  productsResult.placeholdersRemoved = gone.length;
  productsResult.placeholdersHidden = hidden.length;

  const names = PRODUCT_COLS.map(([n]) => n);
  const defs = PRODUCT_COLS.map(([n, t]) => `${n} ${t}`).join(", ");
  const { rows: out } = await db.query(
    `INSERT INTO products AS p (${names.join(", ")})
     SELECT ${names.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS x(${defs})
     ON CONFLICT (catalog_model_id) DO UPDATE SET
       slug = EXCLUDED.slug, brand_id = EXCLUDED.brand_id, name = EXCLUDED.name,
       category = EXCLUDED.category, fuel = EXCLUDED.fuel, product_url = EXCLUDED.product_url,
       summary = COALESCE(p.summary, EXCLUDED.summary),
       width_in = COALESCE(p.width_in, EXCLUDED.width_in),
       height_in = COALESCE(p.height_in, EXCLUDED.height_in),
       depth_in = COALESCE(p.depth_in, EXCLUDED.depth_in),
       updated_at = now()
     WHERE (p.slug, p.brand_id, p.name, p.category, p.fuel, p.product_url)
             IS DISTINCT FROM (EXCLUDED.slug, EXCLUDED.brand_id, EXCLUDED.name, EXCLUDED.category, EXCLUDED.fuel, EXCLUDED.product_url)
        OR (p.summary IS NULL AND EXCLUDED.summary IS NOT NULL)
        OR (p.width_in IS NULL AND EXCLUDED.width_in IS NOT NULL)
        OR (p.height_in IS NULL AND EXCLUDED.height_in IS NOT NULL)
        OR (p.depth_in IS NULL AND EXCLUDED.depth_in IS NOT NULL)
     RETURNING (p.xmax = 0) AS inserted`,
    [JSON.stringify(rows)],
  );
  for (const r of out) r.inserted ? productsResult.added++ : productsResult.updated++;

  // A model that left the catalog (or was kept only as retired) leaves the visualizer.
  const { rows: off } = await db.query(
    `UPDATE products SET is_active = false, updated_at = now()
     WHERE catalog_model_id IS NOT NULL AND is_active
       AND catalog_model_id NOT IN (SELECT id FROM catalog_models WHERE retired_at IS NULL)
     RETURNING slug`,
  );
  productsResult.hiddenGone = off.map((r) => r.slug);
  // Models back in the catalog whose product a past load hid: staff may have hidden
  // some themselves, so they stay hidden, but the report names them.
  const back = [...modelIds].filter((id) => !modelsBefore.has(id));
  const { rows: stillHidden } = await db.query(
    `SELECT slug FROM products
     WHERE NOT is_active AND created_at < now()
       AND catalog_model_id IN (SELECT jsonb_array_elements_text($1::jsonb))`,
    [JSON.stringify(back)],
  );
  productsResult.stillHidden = stillHidden.map((r) => r.slug);
  productsResult.total = rows.length;
  productsResult.withSize = rows.filter((r) => r.width_in).length;
  return productsResult;
}

/** Catalog models (not retired) before this load, to spot ones coming back. */
let modelsBefore = new Set();

const productsResult = {
  added: 0, updated: 0, total: 0, withSize: 0, brandsAdded: [],
  placeholdersRemoved: 0, placeholdersHidden: 0, hiddenGone: [], stillHidden: [],
};

const catalogSchema = readFileSync(new URL("../db/catalog.sql", import.meta.url), "utf8");
const result = {};
const removed = {};
const retired = { now: [], kept: [], back: [] };

try {
  await db.exec("BEGIN");
  // Only the catalog's own tables, so the site's tables are never locked by a load.
  await db.exec(catalogSchema);
  // One load at a time, even if two copies start together (two deploys, say).
  await db.query("SELECT pg_advisory_xact_lock(hashtext('stoveworks:brain-load'))");
  modelsBefore = new Set((await db.query("SELECT id FROM catalog_models WHERE retired_at IS NULL")).rows.map((r) => r.id));

  result.brands = await upsert("catalog_brands", "slug", BRAND_COLS, brandRows);
  result.models = await upsert("catalog_models", "id", MODEL_COLS, modelRows, { special: KEEP_STAFF_CARRY_STATUS });
  const allModelIds = JSON.stringify([...modelIds]);
  ({ rows: retired.back } = await db.query(
    `UPDATE catalog_models SET retired_at = NULL, updated_at = now()
     WHERE retired_at IS NOT NULL AND id IN (SELECT jsonb_array_elements_text($1::jsonb))
     RETURNING id`,
    [allModelIds],
  ));
  result.photos = await upsert("catalog_images", "id", IMAGE_COLS, imageRows);
  result.pdfs = await upsert("catalog_documents", "id", DOCUMENT_COLS, documentRows);
  result.guides = await upsertGuides(guideRows);

  await replaceAll("catalog_model_images", MODEL_IMAGE_COLS, modelImageRows);
  await replaceAll("catalog_model_documents", MODEL_DOCUMENT_COLS, modelDocumentRows);
  await replaceAll("catalog_model_guides", MODEL_GUIDE_COLS, modelGuideRows);
  await replaceAll("catalog_candidates", CANDIDATE_COLS, candidateRows);

  // Anything no longer in the brain goes (links to it went with the rebuild above).
  removed.guides = await removeMissing("catalog_guides", "id", guideIds);
  result.search = await syncSearchRows();
  removed.photos = await removeMissing("catalog_images", "id", new Set(images.map((e) => e.storage_key)));
  removed.pdfs = await removeMissing("catalog_documents", "id", documentKeys);
  // Models staff have marked are kept, as retired, rather than deleted with their mark.
  ({ rows: retired.now } = await db.query(
    `UPDATE catalog_models SET retired_at = now(), updated_at = now()
     WHERE id NOT IN (SELECT jsonb_array_elements_text($1::jsonb))
       AND carry_status_set_at IS NOT NULL AND retired_at IS NULL
     RETURNING id`,
    [allModelIds],
  ));
  removed.models = await removeMissing("catalog_models", "id", modelIds, "carry_status_set_at IS NULL");
  ({ rows: retired.kept } = await db.query(`SELECT id FROM catalog_models WHERE retired_at IS NOT NULL ORDER BY id`));
  // A brand goes only when no kept model still belongs to it.
  removed.brands = await removeMissing(
    "catalog_brands",
    "slug",
    brandSlugs,
    "NOT EXISTS (SELECT 1 FROM catalog_models m WHERE m.brand_slug = catalog_brands.slug)",
  );

  result.products = await syncProducts();

  const photosStored = imageRows.filter((r) => r.object_path).length;
  const pdfsStored = documentRows.filter((r) => r.object_path).length;
  const guideManualKeys = new Set(guides.flatMap((g) => (g.manuals ?? []).map((mm) => mm.storage_key)));
  const guideManualsStored = [...guideManualKeys].filter((k) => store.files.has(k)).length;

  await setMeta("shapes", shapes);
  await setMeta("guides", { about: guideIndex.about ?? null, count: guides.length });
  await setMeta("load", {
    loaded_at: new Date().toISOString(),
    files: store.label,
    counts: {
      brands: brands.length,
      models: models.length,
      photos: images.length,
      photos_in_storage: photosStored,
      pdfs: documents.length,
      pdfs_in_storage: pdfsStored,
      guide_manuals: guideManualKeys.size,
      guide_manuals_in_storage: guideManualsStored,
      guides: guides.length,
      candidates: candidates.length,
    },
    brain: {
      models_sha256: sha256(readFileSync(path.join(BRAIN, "data/models.json"))),
      guides_sha256: sha256(readFileSync(path.join(BRAIN, "guides/guides.json"))),
    },
  });

  await db.exec(DRY_RUN ? "ROLLBACK" : "COMMIT");

  // --- report -----------------------------------------------------------------------
  const change = (r) => {
    const parts = [];
    if (r.added) parts.push(`${r.added} new`);
    if (r.updated) parts.push(`${r.updated} changed`);
    return parts.length ? parts.join(", ") : "no changes";
  };
  const line = (label, n, note) => console.log(`    ${label.padEnd(11)}${String(n).padStart(5)}   ${note}`);

  console.log(DRY_RUN ? "✓ dry run — nothing was written. It would load:" : "✓ catalog loaded");
  line("brands", brands.length, change(result.brands));
  line("models", models.length, change(result.models));
  line("photos", images.length, `${change(result.photos)} · ${photosStored} in storage`);
  line(
    "PDFs",
    documents.length,
    `${change(result.pdfs)} · ${pdfsStored} in storage, including ${guideManualsStored} of the ${guideManualKeys.size} manuals the guides open`,
  );
  line("guides", guides.length, change(result.guides));
  line(
    "search",
    result.search.sections,
    `guide sections and ${result.search.pages} manual pages · ${result.search.changed ? "rebuilt" : "no changes"}`,
  );
  for (const p of search.problems.slice(0, 8)) console.log(`  ! search: ${p}`);
  line("candidates", candidates.length, "unverified, not part of the catalog");
  if (result.products.skipped) {
    console.log("  ! The visualizer's products weren't updated: run `npm run db:migrate`, then this again.");
  } else {
    const p = result.products;
    line("products", p.total, `${change(p)} · the visualizer's list, one per model · ${p.withSize} stoves with sizes from the catalog`);
    if (p.placeholdersRemoved || p.placeholdersHidden) {
      console.log(
        `  removed ${plural(p.placeholdersRemoved, "placeholder product")}` +
          (p.placeholdersHidden ? `; kept ${p.placeholdersHidden} hidden because saved designs use them` : ""),
      );
    }
    if (p.brandsAdded.length) console.log(`  added to the site's brands: ${p.brandsAdded.join(", ")}`);
    if (p.hiddenGone.length) console.log(`  hid products whose model left the catalog: ${p.hiddenGone.join(", ")}`);
    if (p.stillHidden.length) {
      console.log(`  ! back in the catalog but still hidden in the visualizer (turn on at /admin if wanted): ${p.stillHidden.join(", ")}`);
    }
  }

  for (const [what, ids] of Object.entries(removed)) {
    if (ids.length) console.log(`  removed ${plural(ids.length, what.replace(/s$/, ""), what)} no longer in the brain: ${ids.slice(0, 12).join(", ")}${ids.length > 12 ? " …" : ""}`);
  }

  const ids = (rows) => rows.map((r) => r.id).join(", ");
  if (retired.back.length) {
    console.log(`  back in the brain, no longer retired: ${ids(retired.back)}`);
  }
  if (retired.kept.length) {
    console.log(
      `  kept ${plural(retired.kept.length, "model")} no longer in the brain because staff set what Stoveworks carries ` +
        `(marked retired; pages skip them): ${ids(retired.kept)}` +
        (retired.now.length ? ` (newly retired: ${ids(retired.now)})` : ""),
    );
  }

  const missingManualGuides = guides.filter((g) => (g.manuals ?? []).some((mm) => !store.files.has(mm.storage_key)));
  if (missingManualGuides.length) {
    console.log(
      `  ! ${plural(missingManualGuides.length, "guide")} open manuals that aren't in storage yet, so those PDF links won't work until the files are uploaded` +
        (missingManualGuides.length <= 8 ? `: ${missingManualGuides.map((g) => g.id).join(", ")}` : "."),
    );
  }
  if (photosStored < images.length && photosStored > 0) {
    console.log(`  · ${images.length - photosStored} photos aren't in storage; pages can fall back to the maker's copy (catalog_images.url).`);
  }
  if (!photosStored && !pdfsStored) {
    console.log(`  · No photos or PDFs found in ${store.label}. Upload them, then run this again.`);
  }
} catch (err) {
  await db.exec("ROLLBACK").catch(() => {});
  console.error(`✗ load failed, nothing was changed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
