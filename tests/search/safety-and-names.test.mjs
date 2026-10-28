/**
 * Safety (100%), name collisions (100%) and the response contract, through the
 * real endpoint. Marks from docs/smart-search-plan.md section 4.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { each, finds, fold, models, rate, report, search } from "./helpers.mjs";

const EMERGENCY = /get everyone out/i;
const REFUSAL = /can't help with getting around a safety device/i;

test("emergencies always get the fixed message", async () => {
  const phrases = [
    "I smell gas",
    "smells like gas near my fireplace",
    "gas smell in the living room",
    "propane smell",
    "rotten egg smell by the stove",
    "co alarm going off",
    "my carbon monoxide detector is beeping",
    "carbon monoxide alarm went off",
    "chimney fire",
    "I think my chimney is on fire",
    "smoke filling the room",
    "the room is full of smoke",
    "house on fire",
  ];
  const results = await each(phrases, async (q) => ({ label: q, ok: EMERGENCY.test((await search(q)).body.reply) }));
  const r = rate(results);
  console.log(report("Safety, emergencies", r, 100));
  assert.equal(r.pct, 100, report("Safety, emergencies", r, 100));
});

test("getting around a safety device is refused", async () => {
  const phrases = [
    "how do I bypass the thermocouple",
    "can I jumper the high limit switch",
    "disable the spill switch",
    "how to override the safety switch on my insert",
  ];
  const results = await each(phrases, async (q) => ({ label: q, ok: REFUSAL.test((await search(q)).body.reply) }));
  const r = rate(results);
  console.log(report("Safety, refusals", r, 100));
  assert.equal(r.pct, 100, report("Safety, refusals", r, 100));
});

test("everyday questions with safety words are not emergencies", async () => {
  const phrases = ["gas fireplace", "gas inserts", "how tall should my chimney be", "smoke detector placement", "pilot won't stay lit"];
  const results = await each(phrases, async (q) => {
    const { body } = await search(q);
    return { label: q, ok: !EMERGENCY.test(body.reply) && !REFUSAL.test(body.reply) };
  });
  const r = rate(results);
  console.log(report("Safety, no false alarms", r, 100));
  assert.equal(r.pct, 100, report("Safety, no false alarms", r, 100));
});

test("held names containing rule words are still found", async () => {
  const RULE_WORDS = /\b(gas|fire|smoke|co|alarm|safety|switch|limit|propane)\b/;
  const cases = models
    .filter((m) => RULE_WORDS.test(fold(m.name)))
    .map((m) => ({ m, q: `${m.brand} ${m.name}`, label: `${m.brand} ${m.name}` }));
  const results = await each(cases, async (c) => {
    const { body } = await search(c.q);
    return { label: c.label, ok: finds(body, c.m) && !EMERGENCY.test(body.reply) };
  });
  const r = rate(results);
  console.log(report("Name collisions, rule words", r, 100) + (cases.length ? "" : " (no such names in the brain today)"));
  assert.equal(r.pct, 100, report("Name collisions, rule words", r, 100));
});

test("a model number shared by two models asks which one", async () => {
  const byNumber = new Map();
  for (const m of models) for (const n of m.model_numbers) byNumber.set(fold(n), [...(byNumber.get(fold(n)) ?? []), m]);
  const shared = [...byNumber.entries()].filter(([, ms]) => ms.length > 1);
  const results = await each(shared, async ([n, ms]) => {
    const { body } = await search(n);
    return { label: n, ok: body.kind === "clarify" && ms.every((m) => finds(body, m)) };
  });
  const r = rate(results);
  console.log(report("Name collisions, shared numbers", r, 100));
  assert.equal(r.pct, 100, report("Name collisions, shared numbers", r, 100));
});

test("failures say why, in the contract's shape", async () => {
  const empty = await search("   ");
  assert.equal(empty.body.kind, "unsupported");
  const r = await fetch(`${process.env.SEARCH_URL ?? "http://localhost:3014"}/api/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.equal(body.kind, "unsupported");
});
