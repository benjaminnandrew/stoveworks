/**
 * The site search's rows, built from the brain's guides (docs/smart-search-plan.md).
 *
 *   catalog_guide_sections  one row per thing a guide explains, from guides/content/<id>.json
 *   catalog_manual_pages    the text of every manual page, from each guide page's PAGES
 *
 * Nothing here names a brand or model: every row comes from the guide files.
 * Used by load-brain.mjs, inside its transaction.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Guide HTML fragments to plain text. */
export function plain(html) {
  return String(html ?? "")
    .replace(/\u0000/g, "")
    .replace(/<(br|\/p|\/li|\/h\d|\/div|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/**
 * Sections whose figures are safety-critical (clearances, gas, venting, chimney,
 * floor protection). The search links these and never quotes their figures.
 * A rule on the section's own title, not a list of models.
 */
const SAFETY_TITLE =
  /clearance|combustible|gas (supply|pressure|line|input|conversion)|pressure|manifold|orifice|venting|vent (pipe|termination|config)|flue|chimney (height|type|connection)|liner|hearth|floor protect|mobile home|outside air|termination/i;

const PAGES_LINE = /const PAGES\s*=\s*(\[[\s\S]*?\]);\n/;

/**
 * @param {{ brain: string, guides: Array<{ id: string, file?: string, manuals?: Array<{ storage_key: string }> }>, htmlById: Map<string, string> }} input
 * @returns {{ sections: object[], pages: object[], problems: string[] }}
 */
export function buildSearchRows({ brain, guides, htmlById }) {
  const sections = [];
  const pages = new Map();
  const problems = [];

  for (const g of guides) {
    const manuals = g.manuals ?? [];
    const docAt = (d) => manuals[d - 1]?.storage_key ?? null;

    const contentFile = path.join(brain, "guides", "content", `${g.id}.json`);
    if (!existsSync(contentFile)) {
      problems.push(`guide ${g.id}: no content file, so its sections aren't searchable`);
    } else {
      const c = JSON.parse(readFileSync(contentFile, "utf8"));
      const pageref = c.pageref ?? {};
      const ref = (key) => {
        const r = pageref[key];
        if (r == null) return { document_id: null, page: null };
        return Array.isArray(r) ? { document_id: docAt(r[0]), page: r[1] } : { document_id: docAt(1), page: r };
      };
      const termsFor = (key) =>
        (c.index_extra ?? [])
          .filter((x) => x.id === key)
          .map((x) => `${x.t} ${x.p ?? ""}`.trim())
          .join(" · ") || null;

      let sort = 0;
      const add = (row) => {
        sections.push({
          guide_id: g.id,
          sort: sort++,
          terms: null,
          ...row,
          safety: SAFETY_TITLE.test(row.title),
        });
      };

      for (const [key, d] of Object.entries(c.detail ?? {})) {
        const [who, kind] = String(d.tag ?? "").split(" · ");
        add({
          key,
          audience: /^installer/i.test(who) ? "installer" : "owner",
          kind: (kind ?? "topic").toLowerCase(),
          title: d.title,
          terms: termsFor(key),
          body: plain(d.html),
          ...ref(key),
          link: `#${key}`,
        });
      }

      (c.steps ?? []).forEach((s, i) => {
        add({
          key: `step${i}`,
          audience: "installer",
          kind: "step",
          title: s[0],
          body: plain([s[1], s[2]].filter(Boolean).join("\n")),
          ...ref(`step${i}`),
          link: "#installer",
        });
      });

      (c.faults?.panels ?? []).forEach((p, i) => {
        add({
          key: `fault${i}`,
          audience: "installer",
          kind: "fault",
          title: p.title,
          body: plain((p.items ?? []).join("\n")),
          document_id: null,
          page: null,
          link: "#installer",
        });
      });

      (c.codes ?? []).forEach((code, i) => {
        const [signal, title, about] = code;
        const label = typeof signal === "number" ? `${signal} blink${signal === 1 ? "" : "s"}` : String(signal);
        add({
          key: `code${i}`,
          audience: "installer",
          kind: "code",
          title: `${label}: ${title}`,
          body: plain(about ?? ""),
          document_id: null,
          page: null,
          link: "#installer",
        });
      });
    }

    const html = htmlById.get(g.id);
    const m = html?.match(PAGES_LINE);
    if (!m) {
      problems.push(`guide ${g.id}: no manual page text, so its manual isn't searchable`);
      continue;
    }
    let list;
    try {
      list = JSON.parse(m[1]);
    } catch {
      problems.push(`guide ${g.id}: its manual page text couldn't be read`);
      continue;
    }
    for (const p of list) {
      const document_id = docAt(p.d ?? 1);
      if (!document_id || !Number.isInteger(p.p)) continue;
      const k = `${document_id}#${p.p}`;
      if (!pages.has(k)) pages.set(k, { document_id, page: p.p, body: String(p.t ?? "").replace(/\u0000/g, "") });
    }
  }

  return { sections, pages: [...pages.values()], problems };
}
