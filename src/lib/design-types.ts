/**
 * Shared between the server and the browser — no server-only imports here.
 *
 * Everything positional is expressed as a percentage of the room photo's own
 * dimensions, so a design renders identically whether it is being edited at
 * 1400px wide, exported at full resolution, or shown as a thumbnail.
 *
 * A design is the whole hearth in one room photo: the products placed on it,
 * the stone areas behind them, the parts of the photo that stay in front of the
 * stone, and optionally a second view (B) for comparing choices.
 */

import type { Point } from "./homography";
import { MAX_REGIONS, parseRegions, type Region } from "./veneer-types";

export type PlacedItem = {
  /** Stable per-item id, not the product id — the same stove can be placed twice. */
  id: string;
  productId: string;
  /** Centre of the item, as a percentage of photo width / height. */
  xPct: number;
  yPct: number;
  /** Item width as a percentage of photo width. Height follows the aspect ratio. */
  widthPct: number;
  /** Degrees, clockwise. */
  rotation: number;
  flipped: boolean;
  /** Contact-shadow strength, 0–1. */
  shadow: number;
};

/**
 * A part of the photo that stays in front of the stone — a sofa, a window
 * frame, a beam. Drawn by re-painting the photo inside the polygon on top of
 * the stone. Points are percentages of the photo, like everything else.
 */
export type Occluder = { id: string; points: Point[] };

/**
 * View B of a comparison. Placement is shared with view A — one stove
 * position, one stone shape — and only the choices differ, so the two views
 * compare like with like.
 */
export type CompareView = {
  /** Placed item id → the product shown in view B. */
  products: Record<string, string>;
  /** Stone area id → the stone shown in view B, or null for the bare wall. */
  stones: Record<string, string | null>;
};

export type DesignState = {
  items: PlacedItem[];
  /** Percentage of photo width covered by one real-world inch, once calibrated. */
  pctPerInch: number | null;
  /** Stone areas, drawn behind the products. */
  regions: Region[];
  /** Parts of the photo kept in front of the stone. */
  occluders: Occluder[];
  /** The second view of a comparison, or null when not comparing. */
  compare: CompareView | null;
};

export const emptyDesign = (): DesignState => ({
  items: [],
  pctPerInch: null,
  regions: [],
  occluders: [],
  compare: null,
});

/** What the visualizer needs to draw a product. Mirrors a row of `products`. */
export type PlaceableProduct = {
  id: string;
  slug: string;
  name: string;
  category: "stove" | "insert" | "fireplace" | "hearth";
  fuel: "gas" | "wood" | "electric" | "pellet" | "multi";
  brandName: string | null;
  /** The real cutout, or a category placeholder while staff gather photography. */
  image: string;
  isPlaceholder: boolean;
  widthIn: number | null;
  heightIn: number | null;
  productUrl: string | null;
};

export const PLACEHOLDER_BY_CATEGORY: Record<PlaceableProduct["category"], string> = {
  stove: "/products/placeholder-stove.svg",
  insert: "/products/placeholder-insert.svg",
  fireplace: "/products/placeholder-fireplace.svg",
  hearth: "/products/placeholder-hearth.svg",
};

/** Typical real-world widths, used to size placeholders sensibly before calibration. */
export const NOMINAL_WIDTH_IN: Record<PlaceableProduct["category"], number> = {
  stove: 26,
  insert: 34,
  fireplace: 42,
  hearth: 48,
};

export const CATEGORY_LABEL: Record<PlaceableProduct["category"], string> = {
  stove: "Stoves",
  insert: "Inserts",
  fireplace: "Fireplaces",
  hearth: "Specialty hearth",
};

export const FUEL_LABEL: Record<PlaceableProduct["fuel"], string> = {
  gas: "Gas",
  wood: "Wood",
  electric: "Electric",
  pellet: "Pellet",
  multi: "Various",
};

export const MAX_ITEMS = 6;
export const MAX_OCCLUDERS = 24;
const MAX_OCCLUDER_POINTS = 40;

export function newItem(
  product: PlaceableProduct,
  photoAspect: number,
  pctPerInch: number | null,
): PlacedItem {
  const nominal = product.widthIn ?? NOMINAL_WIDTH_IN[product.category];

  // Calibrated: size it truthfully. Otherwise fall back to a sane share of the
  // frame — roughly what a stove occupies in a photo taken from across a room.
  const widthPct = pctPerInch ? nominal * pctPerInch : defaultWidthPct(product.category);

  return {
    id: `${product.id}-${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    xPct: 50,
    // Sit it on the lower third, where a floor usually is.
    yPct: photoAspect > 1.4 ? 68 : 64,
    widthPct: clamp(widthPct, 4, 90),
    rotation: 0,
    flipped: false,
    shadow: 0.45,
  };
}

function defaultWidthPct(category: PlaceableProduct["category"]): number {
  switch (category) {
    case "stove":
      return 16;
    case "insert":
      return 24;
    case "fireplace":
      return 30;
    case "hearth":
      return 32;
  }
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Validates whatever came back from the database or a client save. */
export function parseItems(value: unknown): PlacedItem[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_ITEMS).flatMap((raw): PlacedItem[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const it = raw as Record<string, unknown>;
    if (typeof it.productId !== "string") return [];

    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;

    return [
      {
        id: isPlainId(it.id) ? it.id : `i-${Math.random().toString(36).slice(2, 10)}`,
        productId: it.productId,
        xPct: clamp(num(it.xPct, 50), -20, 120),
        yPct: clamp(num(it.yPct, 65), -20, 120),
        widthPct: clamp(num(it.widthPct, 16), 2, 200),
        rotation: clamp(num(it.rotation, 0), -180, 180),
        flipped: it.flipped === true,
        shadow: clamp(num(it.shadow, 0.45), 0, 1),
      },
    ];
  });
}

/**
 * Ids of things inside a design (items, areas, openings, shapes): short and
 * plain, or a fresh one is minted. Keeps stored JSON from smuggling in keys
 * like "__proto__" that the compare maps would trip over.
 */
export const isPlainId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/** Catalog ids are uuids; anything else is dropped before it reaches a query. */
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Validates stored or submitted keep-in-front shapes. */
export function parseOccluders(value: unknown): Occluder[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_OCCLUDERS).flatMap((raw, index): Occluder[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const o = raw as Record<string, unknown>;
    if (!Array.isArray(o.points)) return [];

    const points = o.points.slice(0, MAX_OCCLUDER_POINTS).flatMap((p): Point[] => {
      if (typeof p !== "object" || p === null) return [];
      const { x, y } = p as Record<string, unknown>;
      if (typeof x !== "number" || typeof y !== "number") return [];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{ x: clamp(x, -50, 150), y: clamp(y, -50, 150) }];
    });
    if (points.length < 3) return [];

    return [{ id: isPlainId(o.id) ? o.id : `o-${index}`, points }];
  });
}

/**
 * Validates a stored or submitted comparison against the design it belongs to:
 * only ids that exist in the design survive, so a stale view B can never point
 * at an item or area that has since been removed.
 */
export function parseCompare(
  value: unknown,
  items: PlacedItem[],
  regions: Region[],
): CompareView | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const products = (typeof v.products === "object" && v.products !== null ? v.products : {}) as Record<
    string,
    unknown
  >;
  const stones = (typeof v.stones === "object" && v.stones !== null ? v.stones : {}) as Record<
    string,
    unknown
  >;

  const out: CompareView = { products: {}, stones: {} };
  for (const item of items) {
    const p = products[item.id];
    out.products[item.id] = isUuid(p) ? p : item.productId;
  }
  for (const region of regions) {
    const s = stones[region.id];
    out.stones[region.id] = s === null ? null : isUuid(s) ? s : region.stoneId;
  }
  return out;
}

/** Validates a whole design, as stored or as submitted by the editor. */
export function parseDesignState(value: {
  items?: unknown;
  regions?: unknown;
  occluders?: unknown;
  compare?: unknown;
  pctPerInch?: unknown;
}): DesignState {
  const items = parseItems(value.items);
  const regions = parseRegions(value.regions).slice(0, MAX_REGIONS);
  const pct = typeof value.pctPerInch === "string" ? Number(value.pctPerInch) : value.pctPerInch;
  return {
    items,
    regions,
    occluders: parseOccluders(value.occluders),
    compare: parseCompare(value.compare, items, regions),
    pctPerInch: typeof pct === "number" && Number.isFinite(pct) && pct > 0 && pct < 100 ? pct : null,
  };
}
