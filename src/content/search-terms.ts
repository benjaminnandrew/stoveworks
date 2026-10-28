/**
 * The search's own vocabulary: the words people use for product types and for
 * the site's pages. Data, not rules: the search code never names a word itself.
 * Brand and model names come from the brain and src/content/brands.ts; staff
 * add other names later as search aliases.
 */

/** Words for each fuel. Every fuel word is combined with every form word below. */
export const FUEL_WORDS: Record<string, string[]> = {
  wood: ["wood", "wood burning", "wood fired", "woodburning"],
  gas: ["gas", "natural gas", "propane", "lp"],
  pellet: ["pellet", "pellets"],
  electric: ["electric", "electrical"],
};

/** Words for each form, singular and plural. */
export const FORM_WORDS: Record<string, string[]> = {
  stove: ["stove", "stoves", "heater", "heaters", "burner", "burners"],
  insert: ["insert", "inserts", "fireplace insert", "fireplace inserts"],
  fireplace: ["fireplace", "fireplaces", "zero clearance fireplace", "zero clearance fireplaces", "built in fireplace"],
  cook_stove: ["cook stove", "cook stoves", "cookstove", "cookstoves", "cooking stove"],
};

/**
 * Words that lead to a page of the site. A page answers only when the search
 * is about it alone; inside a question about a stove they're ordinary words.
 */
export const PAGE_WORDS: { href: string; words: string[] }[] = [
  {
    href: "/contact-us/",
    words: ["hours", "store hours", "open", "opening hours", "when are you open", "directions", "address", "location", "phone", "phone number", "contact", "contact us", "visit", "showroom", "where are you"],
  },
  { href: "/services/", words: ["installation", "install", "installer", "installers", "service", "services", "repair", "repairs"] },
  { href: "/brands/", words: ["brands", "brand", "makers", "manufacturers", "what brands"] },
  { href: "/visualizer/", words: ["visualizer", "room visualizer", "see it in my room", "try it in my room"] },
  { href: "/veneer/", words: ["stone visualizer", "stone mock up", "stone mockup", "veneer", "stone veneer"] },
];
