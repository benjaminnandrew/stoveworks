/**
 * Findability, generated from the brain: every model typed the ways people type
 * it, through the real endpoint. Marks from docs/smart-search-plan.md section 4.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { each, finds, fold, models, plainLetters, rate, report, search } from "./helpers.mjs";

const EXACT_MARK = 98;
const LOOSE_MARK = 90;
const PLAIN_MARK = 100;
const SPELLING_MARK = 95;

/** Swap two letters in the middle of the name's longest plain word: one typo. */
function typo(name) {
  const ws = name.split(" ");
  const i = ws.reduce((best, w, k) => (/^[A-Za-z]{6,}$/.test(w) && w.length > (ws[best]?.length ?? 0) ? k : best), -1);
  if (i < 0 || !/^[A-Za-z]{6,}$/.test(ws[i])) return null;
  const w = ws[i];
  const at = Math.floor(w.length / 2);
  ws[i] = w.slice(0, at) + w[at + 1] + w[at] + w.slice(at + 2);
  return ws.join(" ");
}

test("exact forms: full name, brand + name, name alone, model numbers", async () => {
  const cases = [];
  for (const m of models) {
    cases.push({ m, q: `${m.brand} ${m.name}`, label: `${m.brand} ${m.name}` });
    cases.push({ m, q: m.name, label: m.name });
    for (const n of m.model_numbers) {
      cases.push({ m, q: n, label: `#${n}` });
      cases.push({ m, q: n.replace(/[\s-]+/g, ""), label: `#${n} compact` });
      if (/\s/.test(n)) cases.push({ m, q: n.replace(/\s+/g, "-"), label: `#${n} hyphenated` });
    }
  }
  const results = await each(cases, async (c) => ({ label: c.label, ok: finds((await search(c.q)).body, c.m) }));
  const r = rate(results);
  console.log(report("Findability, exact forms", r, EXACT_MARK));
  assert.ok(r.pct >= EXACT_MARK, report("Findability, exact forms", r, EXACT_MARK));
});

test("loose forms: start of the name, official name, brand in plain letters", async () => {
  const cases = [];
  for (const m of models) {
    const first = m.name.split(" ")[0];
    if (/^[A-Za-z]{5,}$/.test(first)) {
      cases.push({ m, q: `${m.brand} ${first.slice(0, Math.max(4, first.length - 2))}`, label: `${m.brand} ${first}… (start)` });
    }
    if (m.official_name && m.official_name !== m.name) cases.push({ m, q: m.official_name, label: `${m.official_name} (official)` });
    cases.push({ m, q: fold(`${m.brand} ${m.name}`), label: `${fold(m.brand)} ${fold(m.name)} (lowercase, no punctuation)` });
  }
  const results = await each(cases, async (c) => ({ label: c.label, ok: finds((await search(c.q)).body, c.m) }));
  const r = rate(results);
  console.log(report("Findability, loose forms", r, LOOSE_MARK));
  assert.ok(r.pct >= LOOSE_MARK, report("Findability, loose forms", r, LOOSE_MARK));
});

test("plain letters: ø, æ, é and friends typed plain", async () => {
  const cases = models
    .filter((m) => /[^\x00-\x7f]/.test(`${m.brand} ${m.name}`))
    .map((m) => ({ m, q: plainLetters(`${m.brand} ${m.name}`), label: plainLetters(`${m.brand} ${m.name}`) }));
  assert.ok(cases.length > 0, "the brain has names with accented letters");
  const results = await each(cases, async (c) => ({ label: c.label, ok: finds((await search(c.q)).body, c.m) }));
  const r = rate(results);
  console.log(report("Plain letters", r, PLAIN_MARK));
  assert.ok(r.pct >= PLAIN_MARK, report("Plain letters", r, PLAIN_MARK));
});

test("spelling: one typo still finds the model, or offers it", async () => {
  const cases = models.flatMap((m) => {
    const t = typo(m.name);
    return t ? [{ m, q: `${m.brand} ${t}`, label: `${m.brand} ${t}` }] : [];
  });
  const results = await each(cases, async (c) => ({ label: c.label, ok: finds((await search(c.q)).body, c.m) }));
  const r = rate(results);
  console.log(report("Spelling", r, SPELLING_MARK));
  assert.ok(r.pct >= SPELLING_MARK, report("Spelling", r, SPELLING_MARK));
});
