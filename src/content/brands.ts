import { pages } from "./pages";
import type { Media } from "./types";

/**
 * The hearth brands Hayward Stoveworks sells (Ben, 19 Oct 2026): the 13 in the
 * Big Brain's catalog, plus Majestic, which is sold but not in the catalog.
 * This is the one place a brand's name is spelled; the pages' older variants
 * ("KozyHeat", "Morso", "Mendota Hearth") are listed as aliases so they resolve here.
 */
export type Brand = {
  /** URL slug, and the catalog's brand slug where there is one. */
  slug: string;
  name: string;
  aliases: string[];
  /** In the Big Brain's catalog, so it has a model lineup to show. */
  inCatalog: boolean;
  website: string;
};

export const brands: Brand[] = [
  { slug: "blaze-king", name: "Blaze King", aliases: ["Blazeking"], inCatalog: true, website: "https://www.blazeking.com/" },
  { slug: "hearthstone", name: "HearthStone", aliases: ["Hearthstone"], inCatalog: true, website: "https://www.hearthstonestoves.com/" },
  { slug: "jotul", name: "Jøtul", aliases: ["Jotul"], inCatalog: true, website: "https://www.jotul.com/" },
  { slug: "kozy-heat", name: "Kozy Heat", aliases: ["KozyHeat"], inCatalog: true, website: "https://www.kozyheat.com/" },
  { slug: "kuma", name: "Kuma", aliases: [], inCatalog: true, website: "https://www.kumastoves.com/" },
  { slug: "majestic", name: "Majestic", aliases: [], inCatalog: false, website: "https://www.majesticproducts.com/" },
  { slug: "mendota", name: "Mendota", aliases: ["Mendota Hearth"], inCatalog: true, website: "https://mendotahearth.com/" },
  { slug: "morso", name: "Morsø", aliases: ["Morso"], inCatalog: true, website: "https://morsoe.com/us/" },
  { slug: "pacific-energy", name: "Pacific Energy", aliases: [], inCatalog: true, website: "https://www.pacificenergy.net/" },
  { slug: "renaissance", name: "Renaissance", aliases: [], inCatalog: true, website: "https://icc-rsf.com/fireplace/renaissance/" },
  { slug: "rsf", name: "RSF", aliases: [], inCatalog: true, website: "https://icc-rsf.com/fireplace/rsf/" },
  { slug: "town-country", name: "Town & Country", aliases: ["Town & Country Fireplaces"], inCatalog: true, website: "https://townandcountryfireplaces.com/" },
  { slug: "true-north", name: "True North", aliases: [], inCatalog: true, website: "https://truenorthstoves.com/" },
  { slug: "wilkening", name: "Wilkening", aliases: ["Wilkening Fireplace"], inCatalog: true, website: "https://www.wilkeningfireplace.com/" },
];

const bySlug = new Map(brands.map((b) => [b.slug, b]));
const byName = new Map(
  brands.flatMap((b) => [b.name, ...b.aliases].map((n) => [n.toLowerCase(), b] as const)),
);

export const brandBySlug = (slug: string) => bySlug.get(slug);

/** A brand from any spelling the pages use ("KozyHeat", "Morso"…), or undefined. */
export const brandForName = (name: string) => byName.get(name.trim().toLowerCase());

/** What each brand's own pages say about it: the first brand card's copy and logo, and every page it's on. */
type BrandContent = { body: string | null; logo: Media | null; pages: { slug: string; title: string }[] };

// Stove and insert pages first, so a brand's intro comes from its most general card.
const ORDER = ["stoves/", "inserts/", "fireplaces/"];
const rank = (slug: string) => {
  const i = ORDER.findIndex((p) => slug.startsWith(p));
  return i === -1 ? ORDER.length : i;
};

const content = new Map<string, BrandContent>();
for (const page of [...pages].sort((a, b) => rank(a.slug) - rank(b.slug))) {
  for (const section of page.sections) {
    const names =
      section.type === "brand"
        ? [section.name]
        : section.type === "prose-aside" || section.type === "media-grid"
          ? (section.type === "prose-aside" ? section.aside : section.items)
              .filter((m) => m.href?.startsWith("http"))
              .map((m) => m.alt)
          : [];
    for (const name of names) {
      const brand = brandForName(name);
      if (!brand) continue;
      const entry = content.get(brand.slug) ?? { body: null, logo: null, pages: [] };
      if (section.type === "brand") {
        entry.body ??= section.body;
        entry.logo ??= section.logo ?? null;
      }
      if (!entry.pages.some((p) => p.slug === page.slug)) entry.pages.push({ slug: page.slug, title: page.title });
      content.set(brand.slug, entry);
    }
  }
}

export const brandContent = (slug: string): BrandContent =>
  content.get(slug) ?? { body: null, logo: null, pages: [] };
