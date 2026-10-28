import "server-only";

import { brands } from "@/content/brands";
import { typeLabel } from "@/content/lineup";
import { pages } from "@/content/pages";
import { FORM_WORDS, FUEL_WORDS, PAGE_WORDS } from "@/content/search-terms";
import { query } from "@/lib/db";

import { compact, fold, hasDigit, words } from "./fold";

/**
 * Every name the search knows, generated from the data (blueprint rule 3):
 * the catalog's models, model numbers and series, the brand list, the product
 * types, the site's pages, and the aliases staff add. Nothing here names a
 * brand or model.
 *
 * Built in memory (200 models take a few milliseconds) and rebuilt when the
 * brain is loaded again. A failed build is retried on the next search rather
 * than kept (blueprint section 9).
 */

export type EntryKind = "brand" | "model" | "model_number" | "family" | "series" | "category" | "page";

export type Entry = {
  kind: EntryKind;
  /** Folded name: "jotul f 500 v3 oslo". */
  key: string;
  /** brand slug · model id · "<brand>:<family or series>" · "<form>/<fuel>" (either may be "*") · page path */
  ref: string;
  /** What a choice button or list shows: "Jøtul F 500 V3 Oslo · wood stove". */
  label: string;
  /** The models it stands for; empty for categories and pages. */
  modelIds: string[];
  /** A bare name with no digit: it counts only beside a brand or product word, or as the whole search. */
  contextOnly: boolean;
  /** Brand of a model, family or series. */
  brand?: string;
};

export type IndexModel = {
  id: string;
  brand_slug: string;
  brand_name: string;
  name: string;
  official_name: string | null;
  model_numbers: string[];
  series: string | null;
  form: string | null;
  fuel: string | null;
  lineup_status: string | null;
  us_availability: string | null;
  carry_status: string;
  /** The model's first owner & installer guide. */
  guide_id: string | null;
};

export type NameIndex = {
  exact: Map<string, Entry[]>;
  compact: Map<string, Entry[]>;
  /** Every word in every name, by first letter, for near spellings. */
  vocab: Map<string, string[]>;
  vocabSet: Set<string>;
  models: Map<string, IndexModel>;
  /** Every distinct key, for prefix suggestions. */
  keys: string[];
  /** Words in the longest held name: how far the recognizer looks. */
  maxSpan: number;
  builtAt: number;
  stamp: string;
};

const brandName = (slug: string, fallback: string) => brands.find((b) => b.slug === slug)?.name ?? fallback;

function add(map: Map<string, Entry[]>, key: string, entry: Entry) {
  if (!key) return;
  const list = map.get(key) ?? [];
  if (!list.some((e) => e.kind === entry.kind && e.ref === entry.ref)) list.push(entry);
  map.set(key, list);
}

/** The words of a name up to its first word with a digit: "Ashford 20.2" → "ashford". */
function familyStem(name: string): string | null {
  const ws = words(name);
  const i = ws.findIndex(hasDigit);
  if (i <= 0) return null;
  const stem = ws.slice(0, i).join(" ");
  return stem.length >= 3 ? stem : null;
}

export function buildIndex(
  models: IndexModel[],
  catalogBrands: { slug: string; name: string }[],
  aliases: { alias: string; kind: string; ref: string }[],
  stamp: string,
): NameIndex {
  const exact = new Map<string, Entry[]>();
  const compactMap = new Map<string, Entry[]>();
  const byId = new Map(models.map((m) => [m.id, m]));

  // Brands: the site's spelling and aliases, and the catalog's own spelling.
  const brandKeys = new Map<string, string[]>();
  for (const b of brands) {
    const names = [b.name, ...b.aliases, ...catalogBrands.filter((c) => c.slug === b.slug).map((c) => c.name)];
    const ids = models.filter((m) => m.brand_slug === b.slug).map((m) => m.id);
    const keys = [...new Set(names.map(fold))];
    brandKeys.set(b.slug, keys);
    for (const key of keys) {
      const entry: Entry = { kind: "brand", key, ref: b.slug, label: b.name, modelIds: ids, contextOnly: false };
      add(exact, key, entry);
      add(compactMap, key.replace(/ /g, ""), entry);
    }
  }

  // Models, their numbers, families and series.
  const groups = new Map<string, Entry>();
  const group = (kind: "family" | "series", brand: string, name: string, display: string, id: string) => {
    const ref = `${brand}:${fold(name)}`;
    const k = `${kind}|${ref}`;
    const g = groups.get(k) ?? {
      kind,
      key: fold(name),
      ref,
      label: `${brandName(brand, brand)} ${display}`,
      modelIds: [],
      contextOnly: false,
      brand,
    };
    if (!g.modelIds.includes(id)) g.modelIds.push(id);
    groups.set(k, g);
  };

  for (const m of models) {
    const display = brandName(m.brand_slug, m.brand_name);
    const label = `${display} ${m.name} · ${typeLabel(m.form, m.fuel)}`;
    const entry = (key: string, kind: EntryKind = "model", contextOnly = false): Entry => ({
      kind,
      key,
      ref: m.id,
      label,
      modelIds: [m.id],
      contextOnly,
      brand: m.brand_slug,
    });

    const bare = fold(m.name);
    add(exact, bare, entry(bare, "model", !hasDigit(bare)));
    for (const bk of brandKeys.get(m.brand_slug) ?? [fold(m.brand_name)]) {
      add(exact, `${bk} ${bare}`, entry(`${bk} ${bare}`));
    }
    if (m.official_name) {
      const off = fold(m.official_name);
      add(exact, off, entry(off, "model", !hasDigit(off) && !(brandKeys.get(m.brand_slug) ?? []).some((bk) => off.startsWith(`${bk} `))));
    }

    // Compact forms of the name, from its first word with a digit on: "F 500 V3 Oslo" → f500, f500v3, f500v3oslo.
    const ws = words(m.name);
    for (let k = 1; k <= ws.length; k++) {
      const c = ws.slice(0, k).join("");
      if (hasDigit(c) && c.length >= 3) add(compactMap, c, entry(c));
    }
    for (const w of ws) if (hasDigit(w) && /[a-z]/.test(w) && w.length >= 3) add(compactMap, w, entry(w));
    for (const n of m.model_numbers) {
      const c = compact(n);
      if (c.length >= 3) add(compactMap, c, entry(c, "model_number"));
      const f = fold(n);
      if (f.length >= 3) add(exact, f, entry(f, "model_number"));
    }

    const stem = familyStem(m.name);
    if (stem && stem !== bare) group("family", m.brand_slug, stem, stem.replace(/\b\w/g, (c) => c.toUpperCase()), m.id);
    if (m.series) group("series", m.brand_slug, m.series, m.series, m.id);
  }

  for (const g of groups.values()) {
    // A family of one is just that model, already held under its own name.
    if (g.kind === "family" && g.modelIds.length < 2) continue;
    add(exact, g.key, { ...g, contextOnly: !hasDigit(g.key) });
    for (const bk of brandKeys.get(g.brand!) ?? []) {
      const key = `${bk} ${g.key}`;
      add(exact, key, { ...g, key });
    }
  }

  // Product types: every fuel word with every form word, and each alone.
  const formLabel: Record<string, string> = { stove: "stoves", insert: "inserts", fireplace: "fireplaces", cook_stove: "cook stoves" };
  for (const [form, formWords] of Object.entries(FORM_WORDS)) {
    for (const fw of formWords) {
      const key = fold(fw);
      const e: Entry = { kind: "category", key, ref: `${form}/*`, label: formLabel[form], modelIds: [], contextOnly: false };
      add(exact, key, e);
      add(compactMap, key.replace(/ /g, ""), e);
      for (const [fuel, fuelWords] of Object.entries(FUEL_WORDS)) {
        for (const fu of fuelWords) {
          const k2 = fold(`${fu} ${fw}`);
          const e2: Entry = { kind: "category", key: k2, ref: `${form}/${fuel}`, label: `${fuel} ${formLabel[form]}`, modelIds: [], contextOnly: false };
          add(exact, k2, e2);
          add(compactMap, k2.replace(/ /g, ""), e2);
        }
      }
    }
  }
  for (const [fuel, fuelWords] of Object.entries(FUEL_WORDS)) {
    for (const fu of fuelWords) {
      const key = fold(fu);
      add(exact, key, { kind: "category", key, ref: `*/${fuel}`, label: fuel, modelIds: [], contextOnly: false });
    }
  }

  // The site's pages, and the words that lead to them.
  const pageList = [
    ...pages.map((p) => ({ href: `/${p.slug}/`, title: p.title, also: p.metaTitle ? [p.metaTitle.replace(/ in Hayward.*$/i, "")] : [] })),
    { href: "/contact-us/", title: "Visit the showroom", also: ["Hours & directions"] },
    { href: "/hearth-studio/", title: "Hearth Studio", also: [] },
    { href: "/brands/", title: "Brands we carry", also: [] },
  ];
  const titleOf = new Map(pageList.map((p) => [p.href, p.title]));
  for (const p of pageList) {
    for (const n of [p.title, ...p.also]) {
      const key = fold(n);
      add(exact, key, { kind: "page", key, ref: p.href, label: p.title, modelIds: [], contextOnly: false });
    }
  }
  for (const { href, words: ws } of PAGE_WORDS) {
    for (const w of ws) {
      const key = fold(w);
      add(exact, key, { kind: "page", key, ref: href, label: titleOf.get(href) ?? href, modelIds: [], contextOnly: false });
    }
  }

  // Staff aliases: another name for something already held.
  for (const a of aliases) {
    const key = fold(a.alias);
    const target = [...exact.values()].flat().find((e) => e.kind === a.kind && e.ref === a.ref);
    if (key && target) add(exact, key, { ...target, key, contextOnly: false });
  }

  const vocabSet = new Set<string>();
  for (const key of exact.keys()) for (const w of key.split(" ")) if (w.length >= 3) vocabSet.add(w);
  const vocab = new Map<string, string[]>();
  for (const w of vocabSet) vocab.set(w[0], [...(vocab.get(w[0]) ?? []), w]);

  return {
    exact,
    compact: compactMap,
    vocab,
    vocabSet,
    models: byId,
    keys: [...exact.keys()].sort(),
    maxSpan: Math.max(1, ...[...exact.keys()].map((k) => k.split(" ").length)),
    builtAt: Date.now(),
    stamp,
  };
}

// ---------------------------------------------------------------------------

let cached: NameIndex | null = null;
let checkedAt = 0;
let building: Promise<NameIndex> | null = null;
const RECHECK_MS = 60_000;

async function loadStamp(): Promise<string> {
  const { rows } = await query<{ stamp: string | null }>(
    `SELECT value->>'loaded_at' AS stamp FROM catalog_meta WHERE key = 'load'`,
  );
  return rows[0]?.stamp ?? "never";
}

async function build(stamp: string): Promise<NameIndex> {
  const [{ rows: models }, { rows: catalogBrands }, aliases] = await Promise.all([
    query<IndexModel>(
      `SELECT m.id, m.brand_slug, b.name AS brand_name, m.name, m.official_name, m.model_numbers, m.series,
              m.form, m.fuel, m.lineup_status, m.us_availability, m.carry_status,
              (SELECT mg.guide_id FROM catalog_model_guides mg WHERE mg.model_id = m.id ORDER BY mg.sort LIMIT 1) AS guide_id
       FROM catalog_models m JOIN catalog_brands b ON b.slug = m.brand_slug
       WHERE m.retired_at IS NULL`,
    ),
    query<{ slug: string; name: string }>(`SELECT slug, name FROM catalog_brands`),
    // The aliases table arrives with `npm run db:migrate`; until then there are none.
    query<{ alias: string; kind: string; ref: string }>(`SELECT alias, kind, ref FROM search_aliases`)
      .then((r) => r.rows)
      .catch(() => []),
  ]);
  return buildIndex(models, catalogBrands, aliases, stamp);
}

/** The current index: rebuilt after a brain load, and retried (not kept failed) after an error. */
export async function getIndex(): Promise<NameIndex> {
  if (cached && Date.now() - checkedAt < RECHECK_MS) return cached;
  if (building) return building;
  building = (async () => {
    try {
      const stamp = await loadStamp();
      checkedAt = Date.now();
      if (cached && cached.stamp === stamp) return cached;
      cached = await build(stamp);
      return cached;
    } catch (err) {
      // A stale index beats none; with none, the error reaches the visitor as "unavailable".
      if (cached) return cached;
      throw err;
    } finally {
      building = null;
    }
  })();
  return building;
}
