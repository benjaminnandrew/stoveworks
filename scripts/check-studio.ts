/**
 * Checks for Room Studio's editing rules (src/lib/studio.ts) and the maths
 * under them. No test framework — plain assertions, run with:
 *
 *   npx tsx scripts/check-studio.ts
 *
 * Exits non-zero on the first failure.
 */

import assert from "node:assert/strict";

import { parseDesignState, type DesignState, type PlaceableProduct } from "../src/lib/design-types";
import { project, unitSquareToQuad, unproject, type Quad } from "../src/lib/homography";
import { SAMPLE_PRESETS, SAMPLE_ROOM, sampleDesign } from "../src/lib/sample-room";
import {
  addItem,
  dimsFromShape,
  fitToNewPhoto,
  guessedPctPerInch,
  moveCorner,
  presetCorners,
  regionAt,
  removeItem,
  removeRegion,
  resolveItems,
  resolveRegions,
  setItemProduct,
  setRegionStone,
  snapshotCompare,
  swappedWidthPct,
  translateCorners,
  type Corners,
} from "../src/lib/studio";
import type { Region, StoneSwatch } from "../src/lib/veneer-types";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const product = (n: number, over: Partial<PlaceableProduct> = {}): PlaceableProduct => ({
  id: uuid(n),
  slug: `p${n}`,
  name: `Product ${n}`,
  category: "stove",
  fuel: "wood",
  brandName: null,
  image: "/x.png",
  isPlaceholder: false,
  widthIn: 20,
  heightIn: 30,
  productUrl: null,
  ...over,
});

const stone = (n: number): StoneSwatch => ({
  id: uuid(100 + n),
  slug: `s${n}`,
  name: `Stone ${n}`,
  texture: `Texture ${n}`,
  color: null,
  brandName: null,
  image: "/s.jpg",
  isPlaceholder: false,
  tileWidthIn: 24,
  tileHeightIn: 16,
  flatSqftPerBox: null,
  cornerLnftPerBox: null,
  productUrl: null,
});

const rect = (l: number, t: number, r: number, b: number): Corners => [
  { x: l, y: t },
  { x: r, y: t },
  { x: r, y: b },
  { x: l, y: b },
];

console.log("Room Studio checks");

// --- homography -------------------------------------------------------------

check("unproject inverts project for a perspective quad", () => {
  const quad: Quad = [
    { x: 10, y: 12 },
    { x: 80, y: 5 },
    { x: 92, y: 88 },
    { x: 4, y: 70 },
  ];
  const m = unitSquareToQuad(quad);
  for (const [u, v] of [
    [0, 0],
    [1, 0],
    [0.25, 0.75],
    [0.6, 0.3],
    [1, 1],
  ]) {
    const p = project(m, u, v);
    const back = unproject(quad, p.x, p.y)!;
    assert.ok(close(back.x, u) && close(back.y, v), `(${u},${v}) came back as (${back.x},${back.y})`);
  }
});

// --- scale ----------------------------------------------------------------------

check("a guessed scale assumes the photo is about ten feet tall", () => {
  // 4:3 photo → 75 width-units tall → 120″ → 0.625 %/in.
  assert.ok(close(guessedPctPerInch(4 / 3), 0.625));
});

check("the sample room's accent panel reads as 6′ × 8′ at its scale", () => {
  const aspect = SAMPLE_ROOM.width / SAMPLE_ROOM.height;
  const dims = dimsFromShape(presetCorners("accent", { rects: SAMPLE_PRESETS }), aspect, SAMPLE_ROOM.pctPerInch);
  assert.deepEqual(dims, { widthIn: 72, heightIn: 96 });
});

check("swapping a 20″ product for a 30″ one grows it by half, keeping any hand-sizing", () => {
  assert.ok(close(swappedWidthPct(10, product(1, { widthIn: 20 }), product(2, { widthIn: 30 })), 15));
  // No real width: falls back to the category's nominal width (stove 26″, insert 34″).
  const a = product(3, { widthIn: null, category: "stove" });
  const b = product(4, { widthIn: null, category: "insert" });
  assert.ok(close(swappedWidthPct(26, a, b), 34));
});

// --- shapes -------------------------------------------------------------------------

check("a corner can't be dragged into a bow-tie or a sliver", () => {
  const r = rect(30, 20, 70, 80);
  assert.equal(moveCorner(r, 0, { x: 90, y: 90 }), null, "fold");
  assert.equal(moveCorner(r, 0, { x: 69.9, y: 79.9 }), null, "collapse");
  const ok = moveCorner(r, 0, { x: 25, y: 15 });
  assert.ok(ok && ok[0].x === 25 && ok[0].y === 15 && ok[2].x === 70);
});

check("moving a shape stops at the edge instead of squashing it", () => {
  const moved = translateCorners(rect(30, 20, 70, 80), 200, 0);
  assert.equal(moved[1].x, 120);
  assert.equal(moved[1].x - moved[0].x, 40, "width kept");
});

check("a tap on stone finds its area; a tap in an opening goes through to the room", () => {
  const base: Region = {
    id: "r1",
    stoneId: stone(1).id,
    corners: rect(20, 10, 80, 70),
    realWidthIn: 72,
    realHeightIn: 96,
    measured: false,
    holes: [{ id: "h", xPct: 25, yPct: 50, wPct: 50, hPct: 40 }],
    cornerEdges: { top: false, right: false, bottom: false, left: false },
    brightness: 1,
    contrast: 1,
    opacity: 1,
  };
  const top: Region = { ...base, id: "r2", corners: rect(10, 5, 40, 30), holes: [] };
  assert.equal(regionAt([base], { x: 30, y: 20 })?.id, "r1");
  assert.equal(regionAt([base], { x: 50, y: 55 }), null, "inside the opening");
  assert.equal(regionAt([base], { x: 90, y: 50 }), null, "outside");
  assert.equal(regionAt([base, top], { x: 25, y: 20 })?.id, "r2", "topmost wins");
});

// --- compare --------------------------------------------------------------------------

const p1 = product(1, { widthIn: 20 });
const p2 = product(2, { widthIn: 30 });
const pad = product(3, { category: "hearth", widthIn: 48 });
const products = new Map([p1, p2, pad].map((p) => [p.id, p]));
const s1 = stone(1);
const s2 = stone(2);
const stones = new Map([s1, s2].map((s) => [s.id, s]));

function baseDesign(): DesignState {
  const d = sampleDesign(p1, s1);
  return { ...d, compare: snapshotCompare(d) };
}

check("view B changes only its own choices; placement stays shared", () => {
  let d = baseDesign();
  const itemId = d.items[0].id;
  const regionId = d.regions[0].id;
  d = setItemProduct(d, itemId, p2.id, 1, products);
  d = setRegionStone(d, regionId, s2.id, 1);
  assert.equal(resolveItems(d, 0, products)[0].product.id, p1.id);
  assert.equal(resolveItems(d, 1, products)[0].product.id, p2.id);
  assert.equal(resolveRegions(d, 0, stones)[0].stone.id, s1.id);
  assert.equal(resolveRegions(d, 1, stones)[0].stone.id, s2.id);
  // B's stove follows its own real width: 30″ against A's 20″.
  const a = resolveItems(d, 0, products)[0].item;
  const b = resolveItems(d, 1, products)[0].item;
  assert.ok(close(b.widthPct, a.widthPct * 1.5));
  assert.equal(b.xPct, a.xPct);
});

check("bare wall in view B hides the stone there and only there", () => {
  let d = baseDesign();
  d = setRegionStone(d, d.regions[0].id, null, 1);
  assert.equal(resolveRegions(d, 0, stones).length, 1);
  assert.equal(resolveRegions(d, 1, stones).length, 0);
  // View A can't be set to the bare wall — it would orphan the area.
  assert.equal(setRegionStone(d, d.regions[0].id, null, 0), d);
});

check("adding and removing keeps view B in step", () => {
  let d = baseDesign();
  const item = { ...d.items[0], id: "second", productId: pad.id };
  d = addItem(d, item);
  assert.equal(d.compare!.products.second, pad.id);
  d = removeItem(d, "second");
  assert.equal("second" in d.compare!.products, false);
  d = removeRegion(d, d.regions[0].id);
  assert.deepEqual(d.compare!.stones, {});
});

check("hearth pads are drawn under the stove whatever order they were added in", () => {
  let d = baseDesign();
  d = addItem(d, { ...d.items[0], id: "pad", productId: pad.id });
  assert.deepEqual(
    resolveItems(d, 0, products).map((r) => r.product.category),
    ["hearth", "stove"],
  );
});

// --- validation and new photos ----------------------------------------------------------

check("a stored comparison is checked against the design it belongs to", () => {
  const d = baseDesign();
  const parsed = parseDesignState({
    ...d,
    compare: {
      products: { [d.items[0].id]: "not-a-uuid", ghost: p2.id },
      stones: { [d.regions[0].id]: null, ghost: s2.id },
    },
  });
  assert.equal(parsed.compare!.products[d.items[0].id], d.items[0].productId, "bad id falls back to A");
  assert.equal("ghost" in parsed.compare!.products, false);
  assert.equal(parsed.compare!.stones[d.regions[0].id], null);
  assert.equal("ghost" in parsed.compare!.stones, false);
});

check("leaving the sample room drops its scale and its keep-in-front shapes", () => {
  const d = sampleDesign(p1, s1);
  const aspect = 4 / 3;
  const next = fitToNewPhoto(d, { fromSample: true, photoAspect: aspect, products });
  assert.equal(next.pctPerInch, null);
  assert.deepEqual(next.occluders, []);
  // Stove re-sized at the guessed scale: 20″ × 0.625 %/in.
  assert.ok(close(next.items[0].widthPct, 12.5));
  // Stone re-read at the guessed scale from its new accent-panel shape.
  const expected = dimsFromShape(next.regions[0].corners, aspect, guessedPctPerInch(aspect));
  assert.equal(next.regions[0].realWidthIn, expected.widthIn);
  assert.equal(next.regions[0].realHeightIn, expected.heightIn);
});

console.log(`\n${passed} checks passed.`);
