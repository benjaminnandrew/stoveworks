/**
 * Shared by the search tests (docs/smart-search-plan.md section 4).
 *
 * Every test goes through the real endpoint the site's boxes call, on a running
 * server (`npm run dev`, then `npm run test:search`), and checks each response
 * with the browser's own validator. Calls to anywhere but this machine fail.
 */

import { readFileSync } from "node:fs";

import { isSearchResponse } from "../../src/lib/search/contract.ts";
import { fold } from "../../src/lib/search/fold.ts";

export const BASE = process.env.SEARCH_URL ?? "http://localhost:3014";

// Outside network calls are blocked: only this machine may be reached.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(`Outside network call blocked in tests: ${url.hostname}`);
  }
  return realFetch(input, init);
};

/** One search through the endpoint. Throws if the response isn't the contract's shape. */
export async function search(message, extra = {}) {
  const started = performance.now();
  const r = await fetch(`${BASE}/api/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, surface: "test", ...extra }),
  });
  const body = await r.json();
  const ms = performance.now() - started;
  if (!isSearchResponse(body)) throw new Error(`Response for "${message}" broke the contract: ${JSON.stringify(body).slice(0, 300)}`);
  return { status: r.status, body, ms };
}

/** Run searches a few at a time. */
export async function each(items, fn, width = 6) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const brain = (rel) => JSON.parse(readFileSync(new URL(`../../brain/${rel}`, import.meta.url), "utf8"));
export const models = brain("data/models.json");
export const guides = brain("guides/guides.json").guides;
export const guideContent = (id) => brain(`guides/content/${id}.json`);

/** Plain letters, the way most people type: Jøtul → Jotul, Décor → Decor. */
export const plainLetters = (s) =>
  s.replace(/[øØ]/g, (c) => (c === "ø" ? "o" : "O")).replace(/[æÆ]/g, "ae").normalize("NFKD").replace(/\p{M}/gu, "");

export { fold };

/** Did a response find this model: in its sources, or offered as a choice? */
export function finds(body, model) {
  if (body.sources.some((s) => s.kind === "model" && s.id === model.id)) return true;
  const name = fold(model.name);
  return body.choices.some((c) => fold(c.message).endsWith(name));
}

/** A pass rate, with the first misses, for the test's message. */
export function rate(results) {
  const pass = results.filter((r) => r.ok).length;
  const misses = results.filter((r) => !r.ok).map((r) => r.label);
  return { pass, total: results.length, pct: results.length ? (100 * pass) / results.length : 100, misses };
}

export const report = (name, r, mark) =>
  `${name}: ${r.pass}/${r.total} (${r.pct.toFixed(1)}%, mark ${mark}%)` +
  (r.misses.length ? `\n  misses: ${r.misses.slice(0, 12).join(" | ")}${r.misses.length > 12 ? ` … +${r.misses.length - 12}` : ""}` : "");
