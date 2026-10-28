import type { Entry, NameIndex } from "./names";
import { fold } from "./fold";
import { distance, isNear } from "./spelling";

/**
 * Finds every name the search holds in what the visitor typed (blueprint
 * section 3, "Recognize"): exact names and aliases first, longest first, then
 * compact model numbers, then near spellings. A name inside a longer held name
 * is the longer name. Nothing here knows any particular brand or model.
 */

export type Hit = {
  entries: Entry[];
  /** Token positions [start, end) in the folded text. */
  start: number;
  end: number;
  /** What the visitor typed for it, folded. */
  typed: string;
  /** The held words it matched, folded: differs from `typed` where a spelling was corrected. */
  held: string;
  match: "exact" | "compact" | "near" | "prefix";
};

export type Recognition = {
  tokens: string[];
  /** Names that count. */
  hits: Hit[];
  /** Bare everyday-word names with nothing beside them to confirm them (counted only if the data does). */
  tentative: Hit[];
  /** Near spellings that weren't certain enough to use: "Did you mean…?" */
  suggestions: Entry[];
  /** Typed words no held name covers. */
  leftover: string[];
  /** The folded text with held names taken out, for the safety screen. */
  unheld: string;
};

/** Words that carry no meaning of their own in a search. */
export const STOP = new Set(
  (
    "a an the my our your i im me we you is are am was were be been do does did how to for of on in at by with and or " +
    "what whats which who can could would should will it its this that these those there theyre have has had get got " +
    "please need needs want wants looking look find show tell about any some one ones best good new from up out off so " +
    "if not no yes just like more most than then also too very much many us here when where why there s t"
  ).split(" "),
);

function scan(tokens: string[], index: NameIndex, covered: boolean[], match: "exact" | "near", typedOf: (i: number) => string) {
  const hits: Hit[] = [];
  for (let len = Math.min(index.maxSpan, tokens.length); len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      if (covered.slice(i, i + len).some(Boolean)) continue;
      const span = tokens.slice(i, i + len);
      let entries = index.exact.get(span.join(" "));
      let how: Hit["match"] = match;
      if (!entries && len <= 4) {
        entries = index.compact.get(span.join(""));
        if (entries && match === "exact") how = "compact";
      }
      if (!entries?.length) continue;
      hits.push({
        entries,
        start: i,
        end: i + len,
        typed: span.map((_, k) => typedOf(i + k)).join(" "),
        held: span.join(" "),
        match: how,
      });
      for (let k = i; k < i + len; k++) covered[k] = true;
    }
  }
  return hits;
}

/** The held word nearest a typed one, if exactly one is near enough. */
function correct(word: string, index: NameIndex): { word: string; ties: string[] } | null {
  if (word.length < 5 || index.vocabSet.has(word) || /\d/.test(word)) return null;
  const near = (index.vocab.get(word[0]) ?? []).filter((w) => isNear(word, w));
  if (!near.length) return null;
  const scored = near.map((w) => ({ w, d: distance(word, w) })).sort((a, b) => a.d - b.d);
  const best = scored.filter((s) => s.d === scored[0].d).map((s) => s.w);
  return { word: best[0], ties: best };
}

export function recognize(text: string, index: NameIndex): Recognition {
  const tokens = fold(text).split(" ").filter(Boolean);
  const covered = tokens.map(() => false);

  // 1. Exact names, aliases and compact model numbers, longest first.
  const hits = scan(tokens, index, covered, "exact", (i) => tokens[i]);

  // 2. Near spellings: correct uncovered words, then look again with the corrections.
  const suggestions: Entry[] = [];
  const corrected = [...tokens];
  let changed = false;
  tokens.forEach((t, i) => {
    if (covered[i] || STOP.has(t)) return;
    const c = correct(t, index);
    if (!c) return;
    if (c.ties.length > 1) {
      // Two held words equally close: offer them rather than guess.
      for (const w of c.ties.slice(0, 3)) suggestions.push(...(index.exact.get(w) ?? []).slice(0, 1));
      return;
    }
    corrected[i] = c.word;
    changed = true;
  });
  if (changed) {
    // Scan the corrected words afresh, so a longer name can take in names
    // already found ("pacific energy" + "tretnon classic" → the Trenton Classic).
    const nearHits = scan(corrected, index, corrected.map(() => false), "near", (i) => tokens[i]);
    for (const h of nearHits) {
      if (!corrected.slice(h.start, h.end).some((w, k) => w !== tokens[h.start + k])) continue;
      const inside = (x: Hit) => x.start >= h.start && x.end <= h.end;
      const overlaps = (x: Hit) => x.start < h.end && x.end > h.start;
      if (hits.some((x) => overlaps(x) && !inside(x))) continue;
      for (let k = hits.length - 1; k >= 0; k--) if (inside(hits[k])) hits.splice(k, 1);
      hits.push(h);
      for (let k = h.start; k < h.end; k++) covered[k] = true;
    }
  }

  // 3. The start of a name, typed last: "bellin". At least four letters, at most five things.
  const last = tokens.length - 1;
  if (last >= 0 && !covered[last] && tokens[last].length >= 4 && !STOP.has(tokens[last])) {
    for (let len = Math.min(3, tokens.length); len >= 1; len--) {
      const start = tokens.length - len;
      if (covered.slice(start).some(Boolean)) continue;
      const typed = tokens.slice(start).join(" ");
      // A bare everyday-word name counts here on the same terms as anywhere: the
      // whole search, or beside its brand.
      const named = new Set(hits.flatMap((h) => h.entries.filter((e) => e.kind === "brand").map((e) => e.ref)));
      const ok = (e: Entry) => !e.contextOnly || start === 0 || (e.brand !== undefined && named.has(e.brand));
      const found = new Map<string, Entry>();
      for (const key of index.keys) {
        if (!key.startsWith(typed) || key === typed) continue;
        for (const e of index.exact.get(key) ?? []) if (ok(e)) found.set(`${e.kind}|${e.ref}`, e);
      }
      const entries = [...found.values()].filter(
        (e) => e.kind !== "page" && e.kind !== "category" && (!named.size || (e.brand !== undefined && named.has(e.brand))),
      );
      if (!entries.length) continue;
      // One family or series that covers every model found is a single answer.
      const models = new Set(entries.flatMap((e) => (e.kind === "model" || e.kind === "model_number" ? e.modelIds : [])));
      const cover = entries.find((e) => (e.kind === "family" || e.kind === "series") && [...models].every((id) => e.modelIds.includes(id)));
      const distinct = new Set(entries.map((e) => (e.kind === "model_number" ? `model|${e.ref}` : e.kind === "series" ? `family|${e.ref}` : `${e.kind}|${e.ref}`)));
      if (cover || distinct.size === 1) {
        const e = cover ?? entries[0];
        hits.push({ entries: [e], start, end: tokens.length, typed, held: e.key, match: "prefix" });
        for (let k = start; k < tokens.length; k++) covered[k] = true;
      } else {
        // Several ways to finish it: offer the families and series if there are
        // any (fewer, broader choices), otherwise the models, if few enough to read.
        const groups = entries.filter((e) => e.kind === "family" || e.kind === "series" || e.kind === "brand");
        const offer = (groups.length ? groups : entries).sort((a, b) => a.label.length - b.label.length);
        const labels = [...new Map(offer.map((e) => [e.label, e])).values()];
        if (labels.length <= 6) suggestions.push(...labels.slice(0, 4));
      }
      break;
    }
  }

  // 4. Bare everyday-word names count only beside a brand or product word, or alone.
  const hasContext = hits.some((h) => h.entries.some((e) => e.kind === "brand" || e.kind === "category"));
  const brandsNamed = new Set(hits.flatMap((h) => h.entries.filter((e) => e.kind === "brand").map((e) => e.ref)));
  const whole = (h: Hit) => h.start === 0 && h.end === tokens.length;
  const kept: Hit[] = [];
  const tentative: Hit[] = [];
  for (const h of hits) {
    const firm = h.entries.filter((e) => !e.contextOnly);
    const soft = h.entries.filter((e) => e.contextOnly);
    // With a brand named, only that brand's bare names count; with just a product word, any do.
    const softOk = soft.filter(
      (e) => whole(h) || (brandsNamed.size ? !e.brand || brandsNamed.has(e.brand) : hasContext),
    );
    const use = [...firm, ...softOk];
    if (use.length) kept.push({ ...h, entries: use });
    else tentative.push(h);
  }

  const inKept = (i: number) => kept.some((h) => i >= h.start && i < h.end);
  const leftover = tokens.filter((_, i) => !inKept(i) && !tentative.some((h) => i >= h.start && i < h.end));
  // Only product names are set aside for the safety screen. Product-type and page
  // words ("gas", "fireplace", "service") are everyday words, and "I smell gas"
  // has to reach the screen whole.
  const NAMES = new Set(["brand", "model", "model_number", "family", "series"]);
  const named = (i: number) => kept.some((h) => i >= h.start && i < h.end && h.entries.some((e) => NAMES.has(e.kind)));
  const unheld = tokens.filter((_, i) => !named(i)).join(" ");

  return { tokens, hits: kept, tentative, suggestions, leftover, unheld };
}

/** Prefix suggestions for the box as someone types: up to `limit` distinct things. */
export function suggest(text: string, index: NameIndex, limit = 6): Entry[] {
  const q = fold(text);
  if (q.length < 2) return [];
  const out: Entry[] = [];
  const seen = new Set<string>();
  // Brands first; then models, families and series together, shortest (broadest) first.
  const order: Record<string, number> = { brand: 0, model: 1, model_number: 1, family: 1, series: 1, category: 2, page: 3 };
  const matches: Entry[] = [];
  for (const key of index.keys) {
    if (!(key.startsWith(q) || key.includes(` ${q}`))) continue;
    for (const e of index.exact.get(key) ?? []) if (!e.contextOnly || key.startsWith(q)) matches.push(e);
  }
  for (const c of index.compact.get(q.replace(/ /g, "")) ?? []) matches.unshift(c);
  matches.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.label.length - b.label.length);
  for (const e of matches) {
    // One line per thing shown: a family and a series can share a name.
    const id = e.label;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}
