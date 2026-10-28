import { brandForName } from "./brands";
import { pages } from "./pages";

/**
 * The manufacturers carried on each product page, derived from the page content
 * itself rather than kept in a second list.
 *
 * That matters: the mega menus advertise which brands we carry, and if that were
 * hand-maintained it would drift from the pages the moment anyone edited one.
 * This is computed once at module load, with no database and no build step.
 */

/** The same manufacturer is spelled a few ways across the mirrored pages. */
const CANONICAL: Record<string, string> = {
  KozyHeat: "Kozy Heat",
  Hearthstone: "HearthStone",
  Morsø: "Morso",
  "Town & Country Fireplaces": "Town & Country",
  "Snorkel Hot Tubs": "Snorkel",
  "Peterson Firelogs": "Peterson",
  "Pilgrim Home and Hearth": "Pilgrim",
  "St. Croix Stone by Environmental StoneWorks": "Environmental StoneWorks",
  "TriLite Stone Company": "TriLite",
  "Dressy Log Furniture": "Dressy Log",
};

// The brand list (brands.ts) spells the brands we sell; the map covers the rest.
const canonical = (name: string) => brandForName(name)?.name ?? CANONICAL[name] ?? name;

/** Trade-association logos share the aside slots with manufacturer logos. */
const ASSOCIATION = /^(NABA|NAHB|NCHPBA)/i;

function brandsOn(slug: string): string[] {
  const page = pages.find((p) => p.slug === slug);
  if (!page) return [];

  const found: string[] = [];

  for (const section of page.sections) {
    if (section.type === "brand") {
      found.push(canonical(section.name));
      continue;
    }

    // Some pages carry their manufacturers as linked logos instead of headed
    // blocks. A manufacturer logo always links out to the manufacturer.
    const media =
      section.type === "prose-aside"
        ? section.aside
        : section.type === "media-grid"
          ? section.items
          : [];

    for (const item of media) {
      if (!item.href?.startsWith("http")) continue;
      const name = item.alt?.trim();
      if (!name || ASSOCIATION.test(name)) continue;
      found.push(canonical(name));
    }
  }

  return [...new Set(found)];
}

const cache = new Map<string, string[]>();

/** Brands carried on a page, by href (e.g. "/stoves/gas-stoves/"). */
export function brandsForHref(href: string): string[] {
  const slug = href.replace(/^\/|\/$/g, "");
  if (!cache.has(slug)) cache.set(slug, brandsOn(slug));
  return cache.get(slug)!;
}
