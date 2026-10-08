/**
 * The room Room Studio opens on, so a visitor can try a stove and stone before
 * they have a photo of their own to hand.
 *
 * It is the illustrated cabin from the Room Studio prototype Ben approved in
 * September 2026, exported once to public/visualizer/sample-room.webp. Because
 * it is a known picture, its scale and the things that stand in front of the
 * wall are set here by hand — which a customer's own photo has to have done
 * with "Set scale" and, later, by marking what stays in front.
 *
 * Replace it with a real photo of a showroom vignette when there is one; only
 * this file and the image change.
 */

import {
  NOMINAL_WIDTH_IN,
  clamp,
  type DesignState,
  type Occluder,
  type PlaceableProduct,
} from "./design-types";
import { presetCorners, newRegionAt, type PresetRects } from "./studio";
import type { StoneSwatch } from "./veneer-types";

export const SAMPLE_ROOM = {
  url: "/visualizer/sample-room.webp",
  width: 1100,
  height: 753,
  label: "Sample cabin · illustration",
  /**
   * The wall from the underside of the beam (y = 40px) to the floor (y = 511px)
   * is taken as 8 ft. Everything else in the picture follows from that: the
   * window comes out about 56″ wide and the painted hearth pad about 54″.
   */
  pctPerInch: ((511 - 40) / 1100) * 100 / 96,
  /** Centre of the painted hearth pad, and where a stove stands on it. */
  stove: { xPct: 53.6, yPct: 78.6 },
} as const;

/** Starting shapes matched to this picture's wall, from the prototype. */
export const SAMPLE_PRESETS: PresetRects = {
  accent: { left: 37.6, top: 5.3, right: 69.6, bottom: 68 },
  full: { left: 1.2, top: 5.3, right: 96.4, bottom: 66.8 },
};

/** Everything in the picture that stands in front of the wall. */
export const SAMPLE_OCCLUDERS: Occluder[] = [
  { id: "beam", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 5.31 }, { x: 0, y: 5.31 }] },
  { id: "floor", points: [{ x: 0, y: 66.67 }, { x: 100, y: 66.67 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
  { id: "post", points: [{ x: 96.36, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 96.36, y: 100 }] },
  { id: "window", points: [{ x: 4.09, y: 11.55 }, { x: 28.91, y: 11.55 }, { x: 28.91, y: 54.71 }, { x: 4.09, y: 54.71 }] },
  { id: "sill", points: [{ x: 3.73, y: 54.71 }, { x: 29.36, y: 54.71 }, { x: 29.36, y: 56.84 }, { x: 3.73, y: 56.84 }] },
  { id: "sofa-back", points: [{ x: 74.27, y: 46.22 }, { x: 99.55, y: 46.22 }, { x: 99.55, y: 67.99 }, { x: 74.27, y: 67.99 }] },
  { id: "sofa-seat", points: [{ x: 73.36, y: 58.7 }, { x: 100, y: 58.7 }, { x: 100, y: 71.18 }, { x: 73.36, y: 71.18 }] },
  { id: "sofa-arm-left", points: [{ x: 74.09, y: 51.66 }, { x: 77.55, y: 51.66 }, { x: 77.55, y: 72.51 }, { x: 74.09, y: 72.51 }] },
  { id: "sofa-arm-right", points: [{ x: 96.55, y: 51.66 }, { x: 100, y: 51.66 }, { x: 100, y: 72.51 }, { x: 96.55, y: 72.51 }] },
  { id: "lamp-arm", points: [{ x: 66.64, y: 42.63 }, { x: 70.45, y: 42.63 }, { x: 70.45, y: 43.69 }, { x: 66.64, y: 43.69 }] },
  { id: "lamp-pole", points: [{ x: 68.32, y: 43.82 }, { x: 68.77, y: 43.82 }, { x: 68.77, y: 69.46 }, { x: 68.32, y: 69.46 }] },
  { id: "lamp-shade", points: [{ x: 66, y: 37.98 }, { x: 70.73, y: 37.98 }, { x: 71.73, y: 43.29 }, { x: 64.91, y: 43.29 }] },
];

/** A wood stove suits a cabin; a real photo beats a placeholder when there is one. */
export function pickSampleStove(products: PlaceableProduct[]): PlaceableProduct | undefined {
  const stoves = products.filter((p) => p.category === "stove");
  return (
    stoves.find((p) => !p.isPlaceholder && p.fuel === "wood") ??
    stoves.find((p) => !p.isPlaceholder) ??
    stoves.find((p) => p.fuel === "wood") ??
    stoves[0] ??
    products[0]
  );
}

/** Real stone photography first; a generated placeholder tile only if that's all there is. */
export function pickSampleStone(stones: StoneSwatch[]): StoneSwatch | undefined {
  return stones.find((s) => !s.isPlaceholder) ?? stones[0];
}

/** The design the sample room opens with: one stove on the pad, stone behind it. */
export function sampleDesign(
  stove: PlaceableProduct | undefined,
  stone: StoneSwatch | undefined,
): DesignState {
  const aspect = SAMPLE_ROOM.width / SAMPLE_ROOM.height;
  const pct = SAMPLE_ROOM.pctPerInch;

  const items = stove
    ? [
        {
          id: `${stove.id}-sample`,
          productId: stove.id,
          xPct: SAMPLE_ROOM.stove.xPct,
          yPct: SAMPLE_ROOM.stove.yPct,
          widthPct: clamp((stove.widthIn ?? NOMINAL_WIDTH_IN[stove.category]) * pct, 4, 60),
          rotation: 0,
          flipped: false,
          shadow: 0.45,
        },
      ]
    : [];

  // Fixed ids rather than random ones: this design is built on the server and
  // again in the browser, and the two must agree.
  const regions = stone
    ? [{ ...newRegionAt(stone.id, presetCorners("accent", { rects: SAMPLE_PRESETS }), aspect, pct), id: "r-sample" }]
    : [];

  return { items, regions, occluders: SAMPLE_OCCLUDERS, pctPerInch: pct, compare: null };
}
