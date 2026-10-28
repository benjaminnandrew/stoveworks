/**
 * Guide retrieval (90%) and speed budgets, through the real endpoint.
 * Marks from docs/smart-search-plan.md section 4.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { each, guideContent, guides, models, rate, report, search } from "./helpers.mjs";

const RETRIEVAL_MARK = 90;

test("a question from each guide section's title finds that section in the top 3", async () => {
  const byId = new Map(models.map((m) => [m.id, m]));
  const cases = [];
  for (const g of guides) {
    const m = byId.get(g.model_ids?.[0]);
    if (!m) continue;
    const c = guideContent(g.id);
    // Every third topic, so a run stays around a minute.
    Object.entries(c.detail ?? {}).forEach(([key, d], i) => {
      if (i % 3 === 0) cases.push({ q: `${m.brand} ${m.name} ${d.title}`, want: `${g.id}#${key}`, label: `${g.id}: ${d.title}` });
    });
  }
  const results = await each(cases, async (c) => {
    const { body } = await search(c.q);
    const top = body.sources.filter((s) => s.kind === "guide_section").slice(0, 3);
    return { label: c.label, ok: top.some((s) => s.id === c.want) };
  });
  const r = rate(results);
  console.log(report("Guide retrieval", r, RETRIEVAL_MARK));
  assert.ok(r.pct >= RETRIEVAL_MARK, report("Guide retrieval", r, RETRIEVAL_MARK));
});

const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

test("speed: name lookups under 300 ms, questions under 6.5 s (p95)", async () => {
  await search("warm up"); // the first search builds the name index
  const names = models.slice(0, 80).map((m) => `${m.brand} ${m.name}`);
  const nameMs = (await each(names, async (q) => (await search(q)).ms, 1));
  const questions = models.slice(0, 30).map((m) => `${m.brand} ${m.name} how do I clean the glass`);
  const questionMs = (await each(questions, async (q) => (await search(q)).ms, 1));
  console.log(`Speed: names p95 ${p95(nameMs).toFixed(0)} ms (budget 300), questions p95 ${p95(questionMs).toFixed(0)} ms (budget 6500)`);
  assert.ok(p95(nameMs) < 300, `names p95 ${p95(nameMs).toFixed(0)} ms`);
  assert.ok(p95(questionMs) < 6500, `questions p95 ${p95(questionMs).toFixed(0)} ms`);
});
