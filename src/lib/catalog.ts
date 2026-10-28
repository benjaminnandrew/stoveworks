import "server-only";

import { NOT_SOLD_FUELS } from "@/content/lineup";
import { query, queryOne } from "@/lib/db";

/**
 * The manufacturer catalog: the brain, loaded into the catalog_* tables by
 * `npm run brain:load`. Read-only from the site's side, except carry_status,
 * which belongs to staff.
 *
 * Photos and PDFs: when a file is in the file store, link to our copy
 * (fileUrl(object_path)); when it isn't, fall back to the maker's url.
 */

/** Public URL prefix for files in the store; see src/app/files/[...key]/route.ts. */
export const FILES_BASE = "/files/";

export function fileUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  return FILES_BASE + objectPath.split("/").map(encodeURIComponent).join("/");
}

export const guideUrl = (id: string) => `/guides/${id}/`;

export type CatalogModelSummary = {
  id: string;
  brand_slug: string;
  brand_name: string;
  name: string;
  form: string | null;
  fuel: string | null;
  install_type: string | null;
  venting: string | null;
  series: string | null;
  style: string | null;
  shape_group: string | null;
  lineup_status: string | null;
  us_availability: string | null;
  carry_status: string;
  heating_area_sqft_max: number | null;
  btu: number | null;
  btu_basis: string | null;
  efficiency_pct: number | null;
  efficiency_basis: string | null;
  burn_time_hr_max: number | null;
  product_url: string | null;
  /** The model's first owner & installer guide, if it has one. */
  guide_id: string | null;
  /** Our copy of the hero photo when it's stored, else the maker's. */
  hero_image: string | null;
};

type SummaryRow = Omit<CatalogModelSummary, "hero_image"> & {
  hero_image_url: string | null;
  hero_object_path: string | null;
};

const summarySelect = (extraColumns = "") => `
  SELECT m.id, m.brand_slug, b.name AS brand_name, m.name, m.form, m.fuel, m.install_type,
         m.venting, m.series, m.style, m.shape_group, m.lineup_status, m.us_availability,
         m.carry_status,
         m.heating_area_sqft_max::float8 AS heating_area_sqft_max,
         m.btu::float8 AS btu, m.btu_basis,
         m.efficiency_pct::float8 AS efficiency_pct, m.efficiency_basis,
         m.burn_time_hr_max::float8 AS burn_time_hr_max, m.product_url,
         (SELECT mg.guide_id FROM catalog_model_guides mg
           WHERE mg.model_id = m.id ORDER BY mg.sort LIMIT 1) AS guide_id,
         m.hero_image_url, i.object_path AS hero_object_path${extraColumns}
  FROM catalog_models m
  JOIN catalog_brands b ON b.slug = m.brand_slug
  LEFT JOIN catalog_images i ON i.url = m.hero_image_url`;

function toSummary({ hero_image_url, hero_object_path, ...row }: SummaryRow): CatalogModelSummary {
  return { ...row, hero_image: fileUrl(hero_object_path) ?? hero_image_url };
}

export async function listCatalogModels(
  filter: { brand?: string; form?: string; fuel?: string } = {},
): Promise<CatalogModelSummary[]> {
  // Retired models (gone from the brain, kept for staff's carry_status) never list.
  const where: string[] = ["m.retired_at IS NULL"];
  const params: unknown[] = [];
  for (const [column, value] of [
    ["m.brand_slug", filter.brand],
    ["m.form", filter.form],
    ["m.fuel", filter.fuel],
  ] as const) {
    if (value) {
      params.push(value);
      where.push(`${column} = $${params.length}`);
    }
  }
  const { rows } = await query<SummaryRow>(
    `${summarySelect()} WHERE ${where.join(" AND ")} ORDER BY b.name, m.name`,
    params,
  );
  return rows.map(toSummary);
}

/** Summaries for these models, in the order given (for search results). */
export async function getModelSummaries(ids: string[]): Promise<CatalogModelSummary[]> {
  if (!ids.length) return [];
  const { rows } = await query<SummaryRow>(`${summarySelect()} WHERE m.id = ANY($1::text[])`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, toSummary(r)]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

// ---------------------------------------------------------------------------
// What Stoveworks carries. Steve marks it at /admin/carry/; the loader never
// overwrites a mark (carry_status_set_at not null). Until he does, every model
// is "unconfirmed" and the public lineup shows it as the maker's lineup.
// ---------------------------------------------------------------------------

export const CARRY_STATUSES = ["unconfirmed", "carried", "on_floor", "not_carried"] as const;
export type CarryStatus = (typeof CARRY_STATUSES)[number];

export const CARRY_LABEL: Record<CarryStatus, string> = {
  unconfirmed: "Not marked yet",
  carried: "We carry it",
  on_floor: "On our showroom floor",
  not_carried: "Not carried",
};

export const isCarryStatus = (v: string): v is CarryStatus =>
  (CARRY_STATUSES as readonly string[]).includes(v);

/** Staff only: callers check requireStaff(). "unconfirmed" clears the mark. */
export async function setCarryStatus(modelId: string, status: CarryStatus, userId: string) {
  await query(
    status === "unconfirmed"
      ? `UPDATE catalog_models SET carry_status = 'unconfirmed', carry_status_set_by = NULL,
           carry_status_set_at = NULL, updated_at = now() WHERE id = $1`
      : `UPDATE catalog_models SET carry_status = $2, carry_status_set_by = $3,
           carry_status_set_at = now(), updated_at = now() WHERE id = $1`,
    status === "unconfirmed" ? [modelId] : [modelId, status, userId],
  );
}

/** The fuels the site never lists (NOT_SOLD_FUELS), as SQL. Constants, not input. */
const SOLD_FUEL = `COALESCE(m.fuel, '') NOT IN (${[...NOT_SOLD_FUELS].map((f) => `'${f}'`).join(", ")})`;

/**
 * The models customers see: the maker's current lineup, on sale in the US
 * (temporarily unavailable ones included, flagged), minus anything staff have
 * marked not carried and any fuel Stoveworks doesn't sell. Floor models first,
 * then carried, then the rest.
 */
export async function listPublicLineup(brandSlug?: string): Promise<CatalogModelSummary[]> {
  const params: unknown[] = [];
  let brandClause = "";
  if (brandSlug) {
    params.push(brandSlug);
    brandClause = ` AND m.brand_slug = $1`;
  }
  const { rows } = await query<SummaryRow>(
    `${summarySelect()}
     WHERE m.retired_at IS NULL
       AND m.lineup_status = 'current'
       AND m.us_availability IN ('available', 'temporarily_unavailable', 'temporarily_unavailable_us')
       AND m.carry_status <> 'not_carried'
       AND ${SOLD_FUEL}${brandClause}
     ORDER BY CASE m.carry_status WHEN 'on_floor' THEN 0 WHEN 'carried' THEN 1 ELSE 2 END,
              m.name`,
    params,
  );
  return rows.map(toSummary);
}

/** The same rule as listPublicLineup, for one model already in hand (its page). */
export const isPublicModel = (m: CatalogModelSummary & { retired?: boolean }) =>
  !m.retired &&
  !NOT_SOLD_FUELS.has(m.fuel ?? "") &&
  m.lineup_status === "current" &&
  ["available", "temporarily_unavailable", "temporarily_unavailable_us"].includes(m.us_availability ?? "") &&
  m.carry_status !== "not_carried";

/** How many models each brand shows publicly, for the brands hub. */
export async function publicLineupCounts(): Promise<Map<string, number>> {
  const { rows } = await query<{ brand_slug: string; n: number }>(
    `SELECT m.brand_slug, count(*)::int AS n FROM catalog_models m
     WHERE m.retired_at IS NULL AND m.lineup_status = 'current'
       AND m.us_availability IN ('available', 'temporarily_unavailable', 'temporarily_unavailable_us')
       AND m.carry_status <> 'not_carried'
       AND ${SOLD_FUEL}
     GROUP BY m.brand_slug`,
  );
  return new Map(rows.map((r) => [r.brand_slug, r.n]));
}

export type CatalogPhoto = {
  url: string;
  stored: boolean;
  role: string | null;
  variant: string | null;
  alt: string | null;
};

export type CatalogDocument = {
  url: string;
  stored: boolean;
  title: string | null;
  type: string | null;
  language: string | null;
  latest_manual: boolean;
  configuration: string | null;
  revision: string | null;
  pages: number | null;
};

export type CatalogGuideLink = { id: string; title: string; configuration: string | null; url: string };

export type CatalogModel = CatalogModelSummary & {
  /** The full brain record: specs, sizes, specs_raw, manual_differences, sources… */
  data: Record<string, unknown>;
  /** No longer in the brain; kept only because staff had set its carry_status. */
  retired: boolean;
  photos: CatalogPhoto[];
  documents: CatalogDocument[];
  guides: CatalogGuideLink[];
};

export async function getCatalogModel(id: string): Promise<CatalogModel | null> {
  const summary = await queryOne<SummaryRow & { data: Record<string, unknown>; retired: boolean }>(
    `${summarySelect(", m.data, (m.retired_at IS NOT NULL) AS retired")} WHERE m.id = $1`,
    [id],
  );
  if (!summary) return null;
  const { data, retired, ...row } = summary;

  const [photos, documents, guides] = await Promise.all([
    query<{ url: string; object_path: string | null; role: string | null; variant: string | null; alt: string | null }>(
      `SELECT i.url, i.object_path, mi.role, mi.variant, mi.alt
       FROM catalog_model_images mi JOIN catalog_images i ON i.id = mi.image_id
       WHERE mi.model_id = $1 ORDER BY mi.sort`,
      [id],
    ),
    query<{
      url: string;
      object_path: string | null;
      title: string | null;
      doc_type: string | null;
      language: string | null;
      latest_manual: boolean;
      configuration: string | null;
      revision: string | null;
      pages: number | null;
    }>(
      `SELECT d.url, d.object_path, d.title, md.doc_type, md.language, md.latest_manual,
              md.configuration, md.revision, d.pages
       FROM catalog_model_documents md JOIN catalog_documents d ON d.id = md.document_id
       WHERE md.model_id = $1 ORDER BY md.latest_manual DESC, md.sort`,
      [id],
    ),
    query<{ id: string; title: string; configuration: string | null }>(
      `SELECT g.id, g.title, mg.configuration
       FROM catalog_model_guides mg JOIN catalog_guides g ON g.id = mg.guide_id
       WHERE mg.model_id = $1 ORDER BY mg.sort`,
      [id],
    ),
  ]);

  return {
    ...toSummary(row),
    data,
    retired,
    photos: photos.rows.map(({ url, object_path, ...p }) => ({
      ...p,
      url: fileUrl(object_path) ?? url,
      stored: Boolean(object_path),
    })),
    documents: documents.rows.map(({ url, object_path, doc_type, ...d }) => ({
      ...d,
      type: doc_type,
      url: fileUrl(object_path) ?? url,
      stored: Boolean(object_path),
    })),
    guides: guides.rows.map((g) => ({ ...g, url: guideUrl(g.id) })),
  };
}

/** The guide template's one line saying where manuals live (MANUAL_BASE + storage key). */
const MANUAL_BASE_LINE = /const MANUAL_BASE = "[^"\n]*";/;

/**
 * A guide's page, ready to serve: its manual links point at /files/, where the
 * file store serves the PDFs inline so #page=N opens the right page.
 */
export async function getGuideHtml(id: string): Promise<string | null> {
  const row = await queryOne<{ html: string }>(`SELECT html FROM catalog_guides WHERE id = $1`, [id]);
  if (!row) return null;
  return row.html.replace(MANUAL_BASE_LINE, `const MANUAL_BASE = ${JSON.stringify(FILES_BASE)};`);
}

/** When the catalog was last loaded, and what's in storage. Null before the first load. */
export async function catalogLoadInfo(): Promise<Record<string, unknown> | null> {
  const row = await queryOne<{ value: Record<string, unknown> }>(
    `SELECT value FROM catalog_meta WHERE key = 'load'`,
  );
  return row?.value ?? null;
}
