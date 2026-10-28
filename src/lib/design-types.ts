/**
 * Shared between the server and the browser — no server-only imports here.
 *
 * Everything positional is expressed as a percentage of the room photo's own
 * dimensions, so a design renders identically whether it is being edited at
 * 1400px wide, exported at full resolution, or shown as a thumbnail.
 */

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

export type DesignState = {
  items: PlacedItem[];
  /** Percentage of photo width covered by one real-world inch, once calibrated. */
  pctPerInch: number | null;
};

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
  /** The Big Brain model this is, so a model's page can open the visualizer with it in the room. */
  catalogModelId: string | null;
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
        id: typeof it.id === "string" ? it.id : `${it.productId}-${Math.random().toString(36).slice(2, 8)}`,
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
