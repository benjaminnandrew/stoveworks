/**
 * Room Studio's editing rules, kept free of React and of the server so they can
 * be checked on their own (scripts/check-studio.ts) and shared by the editor,
 * the export and the read-only share page.
 *
 * Coordinates are percentages of the room photo throughout. "Width units" means
 * percent of the photo's *width* on both axes — what `pctPerInch` is measured
 * in — so a vertical length is converted with the photo's aspect ratio.
 */

import {
  NOMINAL_WIDTH_IN,
  clamp,
  type CompareView,
  type DesignState,
  type PlaceableProduct,
  type PlacedItem,
} from "./design-types";
import { isConvex, pointInPolygon, quadArea, unproject, type Point, type Quad } from "./homography";
import {
  DEFAULT_REAL_HEIGHT_IN,
  type Region,
  type StoneSwatch,
} from "./veneer-types";

/** 0 is view A (the design itself), 1 is view B of a comparison. */
export type ViewIndex = 0 | 1;

export type Corners = Region["corners"];

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

/**
 * Before the customer sets the scale, sizes are read off a rough guess: that a
 * room photo shows about ten feet from top to bottom. It keeps a stove and the
 * stone courses behind it in believable proportion until there is a real
 * measurement, and every size derived from it is labelled as a guess.
 */
export const GUESSED_PHOTO_HEIGHT_IN = 120;

export function guessedPctPerInch(photoAspect: number): number {
  return 100 / photoAspect / GUESSED_PHOTO_HEIGHT_IN;
}

export function effectivePctPerInch(design: DesignState, photoAspect: number): number {
  return design.pctPerInch ?? guessedPctPerInch(photoAspect);
}

/** Distance between two photo points, in width units. */
function widthUnits(a: Point, b: Point, photoAspect: number): number {
  return Math.hypot(b.x - a.x, (b.y - a.y) / photoAspect);
}

/**
 * Real size of a marked area, read off the photo at the given scale. Averages
 * opposite edges, which is right for a wall shot roughly square-on and a fair
 * reading for one at a modest angle.
 */
export function dimsFromShape(
  corners: Corners,
  photoAspect: number,
  pctPerInch: number,
): { widthIn: number; heightIn: number } {
  const [tl, tr, br, bl] = corners;
  const w = (widthUnits(tl, tr, photoAspect) + widthUnits(bl, br, photoAspect)) / 2;
  const h = (widthUnits(tl, bl, photoAspect) + widthUnits(tr, br, photoAspect)) / 2;
  return {
    widthIn: clamp(Math.round(w / pctPerInch), 6, 1200),
    heightIn: clamp(Math.round(h / pctPerInch), 6, 1200),
  };
}

/** Re-reads an unmeasured area's size from its shape. Measured areas keep theirs. */
export function withShapeDims(region: Region, photoAspect: number, pctPerInch: number): Region {
  if (region.measured) return region;
  const { widthIn, heightIn } = dimsFromShape(region.corners, photoAspect, pctPerInch);
  return widthIn === region.realWidthIn && heightIn === region.realHeightIn
    ? region
    : { ...region, realWidthIn: widthIn, realHeightIn: heightIn };
}

/** Applies `withShapeDims` across the design, after the scale or a shape changes. */
export function refreshDims(design: DesignState, photoAspect: number): DesignState {
  const pct = effectivePctPerInch(design, photoAspect);
  let changed = false;
  const regions = design.regions.map((r) => {
    const next = withShapeDims(r, photoAspect, pct);
    if (next !== r) changed = true;
    return next;
  });
  return changed ? { ...design, regions } : design;
}

// ---------------------------------------------------------------------------
// Products and views
// ---------------------------------------------------------------------------

const realOrNominalWidth = (p: PlaceableProduct | undefined) =>
  p ? (p.widthIn ?? NOMINAL_WIDTH_IN[p.category]) : null;

/**
 * Width an item should take when its product is swapped. Keeps the ratio of
 * real widths, so a size the customer adjusted by hand (a stove further back
 * looks smaller) carries over, and a 30″ stove replacing a 20″ one grows by
 * half whether or not the photo has been calibrated.
 */
export function swappedWidthPct(
  widthPct: number,
  from: PlaceableProduct | undefined,
  to: PlaceableProduct | undefined,
): number {
  const a = realOrNominalWidth(from);
  const b = realOrNominalWidth(to);
  if (!a || !b) return widthPct;
  return clamp((widthPct * b) / a, 3, 150);
}

// Own keys only: the maps are keyed by ids from stored JSON, and an inherited
// key such as "constructor" must never be read as a choice.
export function itemProductId(design: DesignState, item: PlacedItem, view: ViewIndex): string {
  if (view === 1 && design.compare && Object.hasOwn(design.compare.products, item.id)) {
    return design.compare.products[item.id];
  }
  return item.productId;
}

export function regionStoneId(design: DesignState, region: Region, view: ViewIndex): string | null {
  if (view === 1 && design.compare && Object.hasOwn(design.compare.stones, region.id)) {
    return design.compare.stones[region.id];
  }
  return region.stoneId;
}

export type ResolvedItem = { item: PlacedItem; product: PlaceableProduct };
export type ResolvedRegion = { region: Region; stone: StoneSwatch };

/** Hearth pads go down first so a stove always stands on its pad, not under it. */
const layerOf = (p: PlaceableProduct) => (p.category === "hearth" ? 0 : 1);

/**
 * The products as one view shows them, in drawing order. In view B an item may
 * carry a different product, and its width follows that product's real width.
 */
export function resolveItems(
  design: DesignState,
  view: ViewIndex,
  products: Map<string, PlaceableProduct>,
): ResolvedItem[] {
  const out: ResolvedItem[] = [];
  for (const item of design.items) {
    const base = products.get(item.productId);
    const product = products.get(itemProductId(design, item, view));
    if (!product) continue;
    const widthPct =
      product === base ? item.widthPct : swappedWidthPct(item.widthPct, base, product);
    out.push({ item: widthPct === item.widthPct ? item : { ...item, widthPct }, product });
  }
  // Stable: equal layers keep the order they were added in.
  return out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => layerOf(a.r.product) - layerOf(b.r.product) || a.i - b.i)
    .map(({ r }) => r);
}

/** The stone areas as one view shows them; an area set to the bare wall is left out. */
export function resolveRegions(
  design: DesignState,
  view: ViewIndex,
  stones: Map<string, StoneSwatch>,
): ResolvedRegion[] {
  const out: ResolvedRegion[] = [];
  for (const region of design.regions) {
    const stoneId = regionStoneId(design, region, view);
    const stone = stoneId ? stones.get(stoneId) : undefined;
    if (!stone) continue;
    out.push({ region: stone.id === region.stoneId ? region : { ...region, stoneId: stone.id }, stone });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

/** View B starts as a copy of view A; the customer then changes what they want to compare. */
export function snapshotCompare(design: DesignState): CompareView {
  return {
    products: Object.fromEntries(design.items.map((i) => [i.id, i.productId])),
    stones: Object.fromEntries(design.regions.map((r) => [r.id, r.stoneId])),
  };
}

export function addItem(design: DesignState, item: PlacedItem): DesignState {
  return {
    ...design,
    items: [...design.items, item],
    compare: design.compare
      ? { ...design.compare, products: { ...design.compare.products, [item.id]: item.productId } }
      : null,
  };
}

export function removeItem(design: DesignState, id: string): DesignState {
  const compare = design.compare
    ? { ...design.compare, products: { ...design.compare.products } }
    : null;
  if (compare) delete compare.products[id];
  return { ...design, items: design.items.filter((i) => i.id !== id), compare };
}

export function addRegion(design: DesignState, region: Region): DesignState {
  return {
    ...design,
    regions: [...design.regions, region],
    compare: design.compare
      ? { ...design.compare, stones: { ...design.compare.stones, [region.id]: region.stoneId } }
      : null,
  };
}

export function removeRegion(design: DesignState, id: string): DesignState {
  const compare = design.compare ? { ...design.compare, stones: { ...design.compare.stones } } : null;
  if (compare) delete compare.stones[id];
  return { ...design, regions: design.regions.filter((r) => r.id !== id), compare };
}

/**
 * Puts a different product on a placed item, in one view only. In view A the
 * item's width is rescaled to the new product; view B rescales on the fly
 * (see `resolveItems`), so its geometry stays shared with A.
 */
export function setItemProduct(
  design: DesignState,
  itemId: string,
  productId: string,
  view: ViewIndex,
  products: Map<string, PlaceableProduct>,
): DesignState {
  if (view === 1 && design.compare) {
    return {
      ...design,
      compare: { ...design.compare, products: { ...design.compare.products, [itemId]: productId } },
    };
  }
  return {
    ...design,
    items: design.items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            productId,
            widthPct: swappedWidthPct(i.widthPct, products.get(i.productId), products.get(productId)),
          }
        : i,
    ),
  };
}

/** Puts a different stone on an area in one view; null (view B only) shows the bare wall. */
export function setRegionStone(
  design: DesignState,
  regionId: string,
  stoneId: string | null,
  view: ViewIndex,
): DesignState {
  if (view === 1 && design.compare) {
    return {
      ...design,
      compare: { ...design.compare, stones: { ...design.compare.stones, [regionId]: stoneId } },
    };
  }
  if (stoneId === null) return design;
  return {
    ...design,
    regions: design.regions.map((r) => (r.id === regionId ? { ...r, stoneId } : r)),
  };
}

// ---------------------------------------------------------------------------
// Stone area shapes
// ---------------------------------------------------------------------------

export type ShapePreset = "accent" | "full";

/** Corners for the starting shapes, as rectangles in photo percentages. */
export type PresetRects = Record<ShapePreset, { left: number; top: number; right: number; bottom: number }>;

const rectCorners = (r: PresetRects[ShapePreset]): Corners => [
  { x: r.left, y: r.top },
  { x: r.right, y: r.top },
  { x: r.right, y: r.bottom },
  { x: r.left, y: r.bottom },
];

/**
 * Starting shapes for a customer's own photo, where the wall's position is
 * unknown: an accent panel centred on the stove, or the width of the photo.
 * Either way the bottom edge sits about where a floor usually meets the wall,
 * and the customer drags the corners from there.
 */
export function presetCorners(
  preset: ShapePreset,
  opts: { anchorX?: number; rects?: PresetRects } = {},
): Corners {
  if (opts.rects) return rectCorners(opts.rects[preset]);
  if (preset === "full") return rectCorners({ left: 1.5, top: 6, right: 98.5, bottom: 70 });
  const half = 16;
  const cx = clamp(opts.anchorX ?? 50, half + 1, 99 - half);
  return rectCorners({ left: cx - half, top: 6, right: cx + half, bottom: 70 });
}

/** The first placed product that isn't a hearth pad — what an accent panel centres on. */
export function anchorItem(design: DesignState, products: Map<string, PlaceableProduct>) {
  return design.items.find((i) => products.get(i.productId)?.category !== "hearth") ?? design.items[0];
}

/** Smallest area, in square percent of the photo, a stone shape may shrink to. */
const MIN_AREA = 4;
const BOUND_MIN = -20;
const BOUND_MAX = 120;

/** A shape the homography can render: convex, wound one way, and not collapsed. */
export function isUsableShape(corners: Corners): boolean {
  const quad = corners as unknown as Quad;
  return isConvex(quad) && quadArea(quad) >= MIN_AREA;
}

/**
 * Moves one corner, refusing a position that would fold the stone over itself
 * or collapse it, so the shape can never get into a state that renders wrong.
 * Returns null when the move is refused.
 */
export function moveCorner(corners: Corners, index: number, to: Point): Corners | null {
  const next = corners.map((c, i) =>
    i === index ? { x: clamp(to.x, BOUND_MIN, BOUND_MAX), y: clamp(to.y, BOUND_MIN, BOUND_MAX) } : c,
  ) as unknown as Corners;
  return isUsableShape(next) ? next : null;
}

/** Moves the whole shape, stopping at the bounds rather than distorting it. */
export function translateCorners(corners: Corners, dx: number, dy: number): Corners {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const cdx = clamp(dx, BOUND_MIN - Math.min(...xs), BOUND_MAX - Math.max(...xs));
  const cdy = clamp(dy, BOUND_MIN - Math.min(...ys), BOUND_MAX - Math.max(...ys));
  return corners.map((c) => ({ x: c.x + cdx, y: c.y + cdy })) as unknown as Corners;
}

/**
 * The stone area under a point on the photo, if any — topmost first, and not
 * when the point falls in one of the area's openings, where the room shows
 * through.
 */
export function regionAt(regions: Region[], point: Point): Region | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const region = regions[i];
    if (!pointInPolygon(region.corners, point.x, point.y)) continue;
    const uv = unproject(region.corners as unknown as Quad, point.x, point.y);
    const inOpening =
      uv !== null &&
      region.holes.some(
        (h) =>
          uv.x * 100 >= h.xPct &&
          uv.x * 100 <= h.xPct + h.wPct &&
          uv.y * 100 >= h.yPct &&
          uv.y * 100 <= h.yPct + h.hPct,
      );
    if (!inOpening) return region;
  }
  return null;
}

/** A new stone area in a starting shape, sized from the design's scale. */
export function newRegionAt(
  stoneId: string,
  corners: Corners,
  photoAspect: number,
  pctPerInch: number,
): Region {
  const { widthIn, heightIn } = dimsFromShape(corners, photoAspect, pctPerInch);
  return {
    id: `r-${Math.random().toString(36).slice(2, 9)}`,
    stoneId,
    corners,
    realWidthIn: widthIn,
    realHeightIn: heightIn || DEFAULT_REAL_HEIGHT_IN,
    measured: false,
    holes: [],
    cornerEdges: { top: false, right: false, bottom: false, left: false },
    brightness: 1,
    contrast: 1,
    opacity: 1,
  };
}

/**
 * Carries the customer's choices onto a new photo. The scale and the
 * keep-in-front shapes belong to the old picture, so they go. Coming from the
 * sample room the positions do too — they were fitted to that picture — so
 * products are stood on a typical floor line at the guessed scale and the
 * stone becomes an accent panel behind them; between two of the customer's
 * own photos, positions are kept (it's usually the same wall, re-shot).
 */
export function fitToNewPhoto(
  design: DesignState,
  opts: { fromSample: boolean; photoAspect: number; products: Map<string, PlaceableProduct> },
): DesignState {
  const pct = guessedPctPerInch(opts.photoAspect);
  let next: DesignState = { ...design, pctPerInch: null, occluders: [] };

  if (opts.fromSample) {
    const floorY = opts.photoAspect > 1.4 ? 68 : 64;
    next = {
      ...next,
      items: next.items.map((item) => {
        const width = realOrNominalWidth(opts.products.get(item.productId));
        return { ...item, yPct: floorY, widthPct: width ? clamp(width * pct, 3, 80) : item.widthPct };
      }),
    };
    const anchor = anchorItem(next, opts.products);
    next = {
      ...next,
      regions: next.regions.map((region, i) => ({
        ...region,
        corners: presetCorners("accent", { anchorX: (anchor?.xPct ?? 50) + i * 4 }),
        measured: false,
      })),
    };
  }

  return refreshDims(next, opts.photoAspect);
}
