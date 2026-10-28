/**
 * The catalog's product types, and which product page shows which.
 * Shared by the brand pages, the product pages, the carry admin and the search.
 */

export type LineupType = { form: string; fuel: string };

/**
 * Fuels Stoveworks doesn't sell (Ben, 26 Oct 2026: "Stoveworks does not do pellet stoves"). Their
 * models stay in the brain but never list on the site: no lineup, model page, compare, sitemap or
 * visualizer entry. Search still finds one asked for by name and says it isn't carried here.
 */
export const NOT_SOLD_FUELS: ReadonlySet<string> = new Set(["pellet"]);

/** Lineup sections, in the order a brand page lists them. */
export const LINEUP_GROUPS: (LineupType & { label: string })[] = [
  { form: "stove", fuel: "wood", label: "Wood stoves" },
  { form: "stove", fuel: "gas", label: "Gas stoves" },
  { form: "insert", fuel: "wood", label: "Wood inserts" },
  { form: "insert", fuel: "gas", label: "Gas inserts" },
  { form: "insert", fuel: "electric", label: "Electric inserts" },
  { form: "fireplace", fuel: "wood", label: "Wood fireplaces" },
  { form: "fireplace", fuel: "gas", label: "Gas fireplaces" },
  { form: "fireplace", fuel: "electric", label: "Electric fireplaces" },
  { form: "cook_stove", fuel: "wood", label: "Wood cook stoves" },
];

/** "wood stove", for one model. */
export function typeLabel(form: string | null, fuel: string | null): string {
  const g = LINEUP_GROUPS.find((x) => x.form === form && x.fuel === fuel);
  return g ? g.label.replace(/s$/, "").toLowerCase() : [fuel, form?.replace("_", " ")].filter(Boolean).join(" ");
}

/** The catalog types each product page lists, by page slug. */
export const LINEUP_TYPES: Record<string, LineupType[]> = {
  "stoves/wood-stoves": [{ form: "stove", fuel: "wood" }],
  "stoves/gas-stoves": [{ form: "stove", fuel: "gas" }],
  "inserts/wood-inserts": [{ form: "insert", fuel: "wood" }],
  "inserts/gas-inserts": [{ form: "insert", fuel: "gas" }],
  "fireplaces/wood-fireplaces": [{ form: "fireplace", fuel: "wood" }],
  "fireplaces/gas-fireplaces": [{ form: "fireplace", fuel: "gas" }],
  "fireplaces/electric-fireplaces": [
    { form: "fireplace", fuel: "electric" },
    { form: "insert", fuel: "electric" },
  ],
};

/** The hub pages, by slug, and the form each one gathers: /inserts/ leads to every insert page. */
export const HUB_FORMS: Record<string, string> = { stoves: "stove", inserts: "insert", fireplaces: "fireplace" };

/** The product page for a form, or a form and fuel: "/stoves/" or "/stoves/wood-stoves/". */
export function pageForType(form: string | null, fuel: string | null): string | null {
  if (form && fuel) {
    const slug = Object.entries(LINEUP_TYPES).find(([, types]) =>
      types.some((t) => t.form === form && t.fuel === fuel),
    )?.[0];
    if (slug) return `/${slug}/`;
  }
  const hub = Object.entries(HUB_FORMS).find(([, f]) => f === form)?.[0];
  return hub ? `/${hub}/` : null;
}
