/**
 * Shared between server and browser — no server-only imports.
 *
 * A veneer mock-up is a list of regions. Each region is a quadrilateral marked
 * on the room photo, plus the real-world size of the area it covers. That real
 * size does double duty: it scales the stone courses truthfully, and it is what
 * the material estimate is calculated from.
 */

import type { Point, Quad } from "./homography";

export type StoneSwatch = {
  id: string;
  slug: string;
  name: string;
  texture: string;
  color: string | null;
  brandName: string | null;
  /** Tiling image. A generic placeholder until staff upload the real swatch. */
  image: string;
  isPlaceholder: boolean;
  /** Real-world area one tile of `image` covers. */
  tileWidthIn: number;
  tileHeightIn: number;
  flatSqftPerBox: number | null;
  cornerLnftPerBox: number | null;
  productUrl: string | null;
};

/** Which edges of the region wrap an outside corner and need corner pieces. */
export type CornerEdges = { top: boolean; right: boolean; bottom: boolean; left: boolean };

/** A rectangular opening cut out of the region, in region-relative percentages. */
export type Hole = { id: string; xPct: number; yPct: number; wPct: number; hPct: number };

export type Region = {
  id: string;
  stoneId: string;
  /** Corners on the photo, as percentages. Order: TL, TR, BR, BL. */
  corners: [Point, Point, Point, Point];
  /** How big the marked area is in reality. Drives both scale and the estimate. */
  realWidthIn: number;
  realHeightIn: number;
  /**
   * True once the customer has typed the size in. Until then the size follows
   * the shape on the photo, read off the design's scale (or a rough guess at
   * one), so the stone keeps its size on screen while the corners move.
   */
  measured: boolean;
  holes: Hole[];
  cornerEdges: CornerEdges;
  /** Lighting match, so the stone sits in the room's own light. */
  brightness: number;
  contrast: number;
  opacity: number;
};

export const MAX_REGIONS = 4;
export const MAX_HOLES = 3;

/** A fireplace surround is a sensible starting shape for most photos. */
export const DEFAULT_REAL_WIDTH_IN = 72;
export const DEFAULT_REAL_HEIGHT_IN = 96;

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function newRegion(stoneId: string): Region {
  return {
    id: `r-${Math.random().toString(36).slice(2, 9)}`,
    stoneId,
    // Opens as an upright rectangle in the middle of the photo; the customer
    // drags the corners onto the actual wall from there.
    corners: [
      { x: 32, y: 24 },
      { x: 68, y: 24 },
      { x: 68, y: 82 },
      { x: 32, y: 82 },
    ],
    realWidthIn: DEFAULT_REAL_WIDTH_IN,
    realHeightIn: DEFAULT_REAL_HEIGHT_IN,
    measured: false,
    holes: [],
    cornerEdges: { top: false, right: false, bottom: false, left: false },
    brightness: 1,
    contrast: 1,
    opacity: 1,
  };
}

export function newHole(): Hole {
  return { id: `h-${Math.random().toString(36).slice(2, 9)}`, xPct: 25, yPct: 45, wPct: 50, hPct: 35 };
}

export const asQuad = (region: Region): Quad => region.corners as unknown as Quad;

// ---------------------------------------------------------------------------
// Material estimate
// ---------------------------------------------------------------------------

/**
 * Industry rule of thumb: one linear foot of outside-corner pieces covers about
 * half a square foot that would otherwise be flats.
 */
const CORNER_COVERS_SQFT_PER_LNFT = 0.5;

/** Standard cutting/breakage allowance quoted on manufacturer coverage charts. */
export const WASTE_ALLOWANCE = 0.1;

export type Estimate = {
  grossSqft: number;
  openingsSqft: number;
  netSqft: number;
  cornerLnft: number;
  /** Flats still needed once corner pieces have covered their share. */
  flatSqft: number;
  flatSqftWithWaste: number;
  cornerLnftWithWaste: number;
  flatBoxes: number | null;
  cornerBoxes: number | null;
};

export function estimateRegion(region: Region, stone: StoneSwatch | undefined): Estimate {
  const grossSqft = (region.realWidthIn * region.realHeightIn) / 144;

  const openingsSqft = region.holes.reduce((total, hole) => {
    const w = (hole.wPct / 100) * region.realWidthIn;
    const h = (hole.hPct / 100) * region.realHeightIn;
    return total + (w * h) / 144;
  }, 0);

  const netSqft = Math.max(0, grossSqft - openingsSqft);

  const cornerLnft =
    ((region.cornerEdges.top ? region.realWidthIn : 0) +
      (region.cornerEdges.bottom ? region.realWidthIn : 0) +
      (region.cornerEdges.left ? region.realHeightIn : 0) +
      (region.cornerEdges.right ? region.realHeightIn : 0)) /
    12;

  const flatSqft = Math.max(0, netSqft - cornerLnft * CORNER_COVERS_SQFT_PER_LNFT);

  const flatSqftWithWaste = flatSqft * (1 + WASTE_ALLOWANCE);
  const cornerLnftWithWaste = cornerLnft * (1 + WASTE_ALLOWANCE);

  return {
    grossSqft,
    openingsSqft,
    netSqft,
    cornerLnft,
    flatSqft,
    flatSqftWithWaste,
    cornerLnftWithWaste,
    flatBoxes: stone?.flatSqftPerBox ? Math.ceil(flatSqftWithWaste / stone.flatSqftPerBox) : null,
    cornerBoxes: stone?.cornerLnftPerBox
      ? Math.ceil(cornerLnftWithWaste / stone.cornerLnftPerBox)
      : null,
  };
}

export function totalEstimate(
  regions: Region[],
  stones: Map<string, StoneSwatch>,
): Estimate & { regions: number } {
  const zero: Estimate = {
    grossSqft: 0,
    openingsSqft: 0,
    netSqft: 0,
    cornerLnft: 0,
    flatSqft: 0,
    flatSqftWithWaste: 0,
    cornerLnftWithWaste: 0,
    flatBoxes: null,
    cornerBoxes: null,
  };

  const summed = regions.reduce<Estimate>((acc, region) => {
    const e = estimateRegion(region, stones.get(region.stoneId));
    return {
      grossSqft: acc.grossSqft + e.grossSqft,
      openingsSqft: acc.openingsSqft + e.openingsSqft,
      netSqft: acc.netSqft + e.netSqft,
      cornerLnft: acc.cornerLnft + e.cornerLnft,
      flatSqft: acc.flatSqft + e.flatSqft,
      flatSqftWithWaste: acc.flatSqftWithWaste + e.flatSqftWithWaste,
      cornerLnftWithWaste: acc.cornerLnftWithWaste + e.cornerLnftWithWaste,
      flatBoxes: sumNullable(acc.flatBoxes, e.flatBoxes),
      cornerBoxes: sumNullable(acc.cornerBoxes, e.cornerBoxes),
    };
  }, zero);

  return { ...summed, regions: regions.length };
}

const sumNullable = (a: number | null, b: number | null) =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

function parsePoint(v: unknown, fallback: Point): Point {
  if (typeof v !== "object" || v === null) return fallback;
  const p = v as Record<string, unknown>;
  return { x: clamp(num(p.x, fallback.x), -50, 150), y: clamp(num(p.y, fallback.y), -50, 150) };
}

/** Validates whatever came back from the database or a client save. */
export function parseRegions(value: unknown): Region[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_REGIONS).flatMap((raw): Region[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.stoneId !== "string") return [];

    const base = newRegion(r.stoneId);
    const corners = Array.isArray(r.corners) && r.corners.length === 4 ? r.corners : base.corners;
    const edges = (typeof r.cornerEdges === "object" && r.cornerEdges !== null
      ? r.cornerEdges
      : {}) as Record<string, unknown>;

    return [
      {
        id: typeof r.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(r.id) ? r.id : base.id,
        stoneId: r.stoneId,
        corners: [
          parsePoint(corners[0], base.corners[0]),
          parsePoint(corners[1], base.corners[1]),
          parsePoint(corners[2], base.corners[2]),
          parsePoint(corners[3], base.corners[3]),
        ],
        realWidthIn: clamp(num(r.realWidthIn, DEFAULT_REAL_WIDTH_IN), 6, 1200),
        realHeightIn: clamp(num(r.realHeightIn, DEFAULT_REAL_HEIGHT_IN), 6, 1200),
        // Mock-ups saved before this flag existed were always typed in by hand.
        measured: r.measured === undefined ? true : r.measured === true,
        holes: Array.isArray(r.holes)
          ? r.holes.slice(0, MAX_HOLES).flatMap((h): Hole[] => {
              if (typeof h !== "object" || h === null) return [];
              const hole = h as Record<string, unknown>;
              return [
                {
                  id:
                    typeof hole.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(hole.id)
                      ? hole.id
                      : `h-${Math.random().toString(36).slice(2, 9)}`,
                  xPct: clamp(num(hole.xPct, 25), 0, 100),
                  yPct: clamp(num(hole.yPct, 45), 0, 100),
                  wPct: clamp(num(hole.wPct, 50), 1, 100),
                  hPct: clamp(num(hole.hPct, 35), 1, 100),
                },
              ];
            })
          : [],
        cornerEdges: {
          top: edges.top === true,
          right: edges.right === true,
          bottom: edges.bottom === true,
          left: edges.left === true,
        },
        brightness: clamp(num(r.brightness, 1), 0.4, 1.8),
        contrast: clamp(num(r.contrast, 1), 0.4, 1.8),
        opacity: clamp(num(r.opacity, 1), 0.2, 1),
      },
    ];
  });
}
