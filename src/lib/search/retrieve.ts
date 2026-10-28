import "server-only";

import { query } from "@/lib/db";

import { STOP } from "./recognize";

/**
 * Full-text retrieval over the guides and manuals (blueprint section 3,
 * "Execute"): curated guide sections first, raw manual pages as the fallback,
 * narrowed to the models the search resolved when it resolved any.
 */

export type SectionHit = {
  guide_id: string;
  guide_title: string;
  key: string;
  title: string;
  audience: "owner" | "installer";
  kind: string;
  link: string;
  page: number | null;
  document_id: string | null;
  safety: boolean;
  snippet: string | null;
  rank: number;
};

export type PageHit = { document_id: string; page: number; guide_id: string | null; guide_title: string | null; rank: number };

/** The words worth searching for, safe to put in a tsquery. */
export function searchWords(tokens: string[]): string[] {
  return [...new Set(tokens.filter((t) => t.length > 1 && !STOP.has(t) && /^[a-z0-9]+$/.test(t)))];
}

/** All the words first; if that finds nothing, any of them, with prefixes. */
const queries = (ws: string[]) => [ws.join(" & "), ws.map((w) => (w.length >= 4 ? `${w}:*` : w)).join(" | ")];

export async function guidesFor(modelIds: string[]): Promise<string[]> {
  if (!modelIds.length) return [];
  const { rows } = await query<{ guide_id: string }>(
    `SELECT DISTINCT guide_id FROM catalog_model_guides WHERE model_id = ANY($1::text[])`,
    [modelIds],
  );
  return rows.map((r) => r.guide_id);
}

export async function searchSections(words: string[], guideIds: string[] | null, limit = 8): Promise<SectionHit[]> {
  if (!words.length) return [];
  for (const tsq of queries(words)) {
    const { rows } = await query<SectionHit>(
      `SELECT s.guide_id, g.title AS guide_title, s.key, s.title, s.audience, s.kind, s.link, s.page,
              s.document_id, s.safety,
              CASE WHEN s.safety THEN NULL
                   ELSE ts_headline('english', s.body, q,
                          'MaxWords=26, MinWords=10, ShortWord=2, MaxFragments=1, StartSel=<<, StopSel=>>') END AS snippet,
              ts_rank_cd(s.tsv, q, 32)::float8 AS rank
       FROM catalog_guide_sections s
       JOIN catalog_guides g ON g.id = s.guide_id,
            to_tsquery('english', $1) q
       WHERE s.tsv @@ q AND ($2::text[] IS NULL OR s.guide_id = ANY($2::text[]))
       ORDER BY rank DESC, s.sort
       LIMIT $3`,
      [tsq, guideIds, limit],
    );
    if (rows.length) return rows;
  }
  return [];
}

export async function searchManualPages(words: string[], guideIds: string[] | null, limit = 5): Promise<PageHit[]> {
  if (!words.length) return [];
  for (const tsq of queries(words)) {
    const { rows } = await query<PageHit>(
      `WITH docs AS (
         SELECT DISTINCT ON (m->>'storage_key') m->>'storage_key' AS document_id, g.id AS guide_id, g.title AS guide_title
         FROM catalog_guides g, jsonb_array_elements(g.manuals) m
         WHERE $2::text[] IS NULL OR g.id = ANY($2::text[])
       )
       SELECT p.document_id, p.page, d.guide_id, d.guide_title, ts_rank_cd(p.tsv, q, 32)::float8 AS rank
       FROM catalog_manual_pages p
       JOIN docs d ON d.document_id = p.document_id,
            to_tsquery('english', $1) q
       WHERE p.tsv @@ q
       ORDER BY rank DESC, p.page
       LIMIT $3`,
      [tsq, guideIds, limit],
    );
    if (rows.length) return rows;
  }
  return [];
}
