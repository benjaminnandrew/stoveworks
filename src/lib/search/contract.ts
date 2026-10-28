/**
 * The one response every search box gets (docs/smart-search-plan.md section 3).
 *
 * The endpoint, the /search/ page and the tests all use these types, and the
 * browser checks a response with `isSearchResponse` before showing it: the
 * exact shape, with no extra keys. No imports, so the tests load it directly.
 */

export const SEARCH_KINDS = ["results", "answer", "clarify", "unsupported"] as const;
export const SOURCE_KINDS = ["model", "brand", "guide_section", "manual_page", "page"] as const;

export type SearchSource = {
  kind: (typeof SOURCE_KINDS)[number];
  /** model id, brand slug, "<guide id>#<section key>", "<document id>#<page>", or a page path. */
  id: string;
  title: string;
  url: string;
  /** Manual page number, where the source rests on one. */
  page?: number;
  /** One line of context: the model a section is from, a page's type… */
  detail?: string;
  /** Words around the match. Never set for safety-critical sections. */
  snippet?: string;
  audience?: "owner" | "installer";
};

export type SearchChoice = { label: string; message: string };

export type SearchResponse = {
  kind: (typeof SEARCH_KINDS)[number];
  /** Says what was searched, and what couldn't be checked. Up to 1,200 characters. */
  reply: string;
  /** Filters behind a results list (brand, form, fuel), for a results page's URL. */
  filters: Record<string, string> | null;
  /** Up to four. Each runs `message` as a new search. */
  choices: SearchChoice[];
  sources: SearchSource[];
  /** Plan and pending question, sent back with the next message. Unused until Phase 2. */
  context?: unknown;
};

export type SearchScope = { modelId?: string; brandSlug?: string; audience?: "owner" | "installer" };

export type SearchRequest = {
  message: string;
  surface: "home" | "header" | "page" | "drawer" | "test";
  scope?: SearchScope;
  context?: unknown;
};

export const LIMITS = { message: 1200, reply: 1200, choices: 4, sources: 60, context: 16_384 } as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, allowed: string[]) => Object.keys(o).every((k) => allowed.includes(k));
const optString = (v: unknown) => v === undefined || typeof v === "string";

function isSource(v: unknown): v is SearchSource {
  if (!isObject(v)) return false;
  if (!onlyKeys(v, ["kind", "id", "title", "url", "page", "detail", "snippet", "audience"])) return false;
  return (
    (SOURCE_KINDS as readonly string[]).includes(v.kind as string) &&
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.url === "string" &&
    (v.page === undefined || (Number.isInteger(v.page) && (v.page as number) > 0)) &&
    optString(v.detail) &&
    optString(v.snippet) &&
    (v.audience === undefined || v.audience === "owner" || v.audience === "installer")
  );
}

export function isSearchResponse(v: unknown): v is SearchResponse {
  if (!isObject(v)) return false;
  if (!onlyKeys(v, ["kind", "reply", "filters", "choices", "sources", "context"])) return false;
  if (!(SEARCH_KINDS as readonly string[]).includes(v.kind as string)) return false;
  if (typeof v.reply !== "string" || v.reply.length > LIMITS.reply) return false;
  if (v.filters !== null && !(isObject(v.filters) && Object.values(v.filters).every((x) => typeof x === "string"))) {
    return false;
  }
  if (!Array.isArray(v.choices) || v.choices.length > LIMITS.choices) return false;
  if (!v.choices.every((c) => isObject(c) && onlyKeys(c, ["label", "message"]) && typeof c.label === "string" && typeof c.message === "string")) {
    return false;
  }
  if (!Array.isArray(v.sources) || v.sources.length > LIMITS.sources || !v.sources.every(isSource)) return false;
  if (v.context !== undefined && JSON.stringify(v.context).length > LIMITS.context) return false;
  return true;
}
