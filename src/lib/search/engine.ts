import "server-only";

import { brandBySlug, brandContent } from "@/content/brands";
import { NOT_SOLD_FUELS, pageForType, typeLabel } from "@/content/lineup";
import { pages } from "@/content/pages";
import { business } from "@/content/site";
import { listPublicLineup } from "@/lib/catalog";

import { LIMITS, type SearchChoice, type SearchRequest, type SearchResponse, type SearchSource } from "./contract";
import { fold } from "./fold";
import { EMERGENCY_MESSAGE, REFUSAL_MESSAGE, screen } from "./guard";
import { getIndex, type Entry, type IndexModel, type NameIndex } from "./names";
import { recognize, STOP, type Hit, type Recognition } from "./recognize";
import { guidesFor, searchManualPages, searchSections, searchWords, type PageHit, type SectionHit } from "./retrieve";

/**
 * Phase 1 of the site search: no AI (docs/smart-search-plan.md section 4).
 *
 * Guard → recognize → decide → execute → answer. Code decides everything here
 * from what the recognizer found and the data; nothing names a brand, model or
 * phrase. Every reply says what was searched and what couldn't be checked.
 */

// --- building the response ------------------------------------------------------------

function respond(
  kind: SearchResponse["kind"],
  reply: string,
  sources: SearchSource[],
  choices: SearchChoice[] = [],
  filters: Record<string, string> | null = null,
): SearchResponse {
  return {
    kind,
    reply: reply.length > LIMITS.reply ? `${reply.slice(0, LIMITS.reply - 1)}…` : reply,
    filters,
    choices: choices.slice(0, LIMITS.choices),
    sources: dedupe(sources).slice(0, LIMITS.sources),
  };
}

function dedupe(sources: SearchSource[]): SearchSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const k = `${s.kind}|${s.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const quote = (s: string) => `“${s}”`;
const list = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const PUBLIC_AVAILABILITY = new Set(["available", "temporarily_unavailable", "temporarily_unavailable_us"]);
const notSold = (m: IndexModel) => NOT_SOLD_FUELS.has(m.fuel ?? "");
const isPublic = (m: IndexModel) =>
  m.lineup_status === "current" &&
  PUBLIC_AVAILABILITY.has(m.us_availability ?? "") &&
  m.carry_status !== "not_carried" &&
  !notSold(m);

const brandLabel = (slug: string) => brandBySlug(slug)?.name ?? slug;
const modelTitle = (m: IndexModel) => `${brandLabel(m.brand_slug)} ${m.name}`;

function modelNote(m: IndexModel): string {
  if (m.carry_status === "on_floor") return "On our showroom floor";
  if (m.carry_status === "not_carried" || notSold(m)) return "Not carried here: ask us about similar models";
  if (m.lineup_status === "discontinued" || m.us_availability === "discontinued") return "Discontinued by the maker";
  if (m.us_availability?.startsWith("temporarily_unavailable")) return "Temporarily unavailable from the maker";
  return "";
}

function modelSource(m: IndexModel): SearchSource {
  const note = modelNote(m);
  return {
    kind: "model",
    id: m.id,
    title: modelTitle(m),
    // A model in the public lineup has a card on its brand page; otherwise its guide is its page.
    url: isPublic(m) || !m.guide_id ? `/brands/${m.brand_slug}/#${m.id}` : `/guides/${m.guide_id}/`,
    detail: [typeLabel(m.form, m.fuel), note].filter(Boolean).join(" · "),
  };
}

function sectionSource(h: SectionHit): SearchSource {
  return {
    kind: "guide_section",
    id: `${h.guide_id}#${h.key}`,
    title: h.title,
    url: `/guides/${h.guide_id}/${h.link}`,
    ...(h.page ? { page: h.page } : {}),
    detail: `${h.guide_title} guide${h.audience === "installer" ? " · installer information" : ""}`,
    ...(h.snippet && !h.safety ? { snippet: h.snippet.replace(/<<|>>/g, "").replace(/\s+/g, " ").trim() } : {}),
    audience: h.audience,
  };
}

function manualSource(p: PageHit): SearchSource {
  return {
    kind: "manual_page",
    id: `${p.document_id}#${p.page}`,
    title: `${p.guide_title ?? "Maker's"} manual, page ${p.page}`,
    url: `/files/${p.document_id}#page=${p.page}`,
    page: p.page,
    detail: "The maker's manual (PDF)",
  };
}

function brandSource(slug: string): SearchSource {
  const b = brandBySlug(slug);
  return {
    kind: "brand",
    id: slug,
    title: b?.name ?? slug,
    url: `/brands/${slug}/`,
    detail: b?.inCatalog === false ? `Ask us about ${b.name}'s current lineup` : "The maker's current lineup",
  };
}

const STATIC_PAGES: Record<string, { title: string; detail: string }> = {
  "/contact-us/": { title: "Visit the showroom", detail: `${business.street}, ${business.city} · ${business.phoneDisplay}` },
  "/hearth-studio/": { title: "Hearth Studio", detail: "Try stone on your wall, and stoves on the hearth" },
  "/brands/": { title: "Brands we carry", detail: "Every maker's current lineup" },
};

function pageSource(href: string): SearchSource {
  const fixed = STATIC_PAGES[href];
  if (fixed) return { kind: "page", id: href, title: fixed.title, url: href, detail: fixed.detail };
  const p = pages.find((x) => `/${x.slug}/` === href);
  return { kind: "page", id: href, title: p?.title ?? href, url: href, ...(p?.description ? { detail: p.description } : {}) };
}

const hoursLine = business.hours.map((h) => `${h.days} ${h.time}`).join(", ");

// --- the site's own pages, searched by their words ----------------------------------------

let pageText: { href: string; words: Set<string> }[] | null = null;

function sitePages(words: string[], limit = 3): string[] {
  pageText ??= pages.map((p) => ({
    href: `/${p.slug}/`,
    words: new Set(
      fold(
        [
          p.title,
          p.description ?? "",
          ...p.sections.map((s) =>
            s.type === "prose" || s.type === "prose-aside" || s.type === "intro"
              ? s.html
              : s.type === "brand"
                ? `${s.name} ${s.body}`
                : s.type === "fuels"
                  ? (s.intro ?? "")
                  : "",
          ),
        ]
          .join(" ")
          .replace(/<[^>]+>/g, " "),
      ).split(" "),
    ),
  }));
  const need = Math.max(1, Math.ceil(words.length * 0.6));
  return pageText
    .map((p) => ({ href: p.href, n: words.filter((w) => p.words.has(w)).length }))
    .filter((p) => p.n >= need)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((p) => p.href);
}

/**
 * The question in the visitor's own words, for quoting back: what they typed,
 * minus the names the search recognized and the filler at either end.
 * "how do I clean the glass on my Ashford 20.2" → "clean the glass".
 */
function askedText(text: string, rec: Recognition): string {
  const covered = new Set<number>();
  for (const h of rec.hits) for (let i = h.start; i < h.end; i++) covered.add(i);
  const out: { w: string; stop: boolean }[] = [];
  let pos = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const toks = fold(w).split(" ").filter(Boolean);
    const held = toks.length > 0 && toks.every((_, k) => covered.has(pos + k));
    if (!held) out.push({ w, stop: toks.every((t) => STOP.has(t)) });
    pos += toks.length;
  }
  while (out.length && out[0].stop) out.shift();
  while (out.length && out[out.length - 1].stop) out.pop();
  return out.map((x) => x.w).join(" ").replace(/[?.!,;:]+$/, "");
}

// --- answering from the guides --------------------------------------------------------------

async function answerFromGuides(
  modelIds: string[],
  words: string[],
  about: string,
  lead: SearchSource[],
  phrase: string,
): Promise<SearchResponse | null> {
  const guideIds = await guidesFor(modelIds);
  if (!guideIds.length) return null;
  const sections = await searchSections(words, guideIds, 8);
  // Manual pages fill in when the guides say little, skipping pages a section already cites.
  const cited = new Set(sections.map((x) => `${x.document_id}#${x.page}`));
  const manual =
    sections.length < 3
      ? (await searchManualPages(words, guideIds, 6)).filter((p) => !cited.has(`${p.document_id}#${p.page}`)).slice(0, sections.length ? 3 : 5)
      : [];
  const asked = quote(phrase || words.join(" "));
  if (!sections.length && !manual.length) return null;

  const notes: string[] = [];
  if (sections.some((s) => s.audience === "installer")) {
    notes.push("Sections marked installer information are for a certified installer.");
  }
  if (sections.some((s) => s.safety)) {
    notes.push("Clearance, venting and gas figures aren't repeated here: open the section or the manual page to read them where they're printed.");
  }
  const found = sections.length
    ? `${plural(sections.length, "section")} about ${asked}`
    : `${plural(manual.length, "manual page")} that mention ${asked}`;
  return respond(
    "answer",
    [`From ${about}: ${found}.`, ...notes].join(" "),
    [...sections.map(sectionSource), ...manual.map(manualSource), ...lead],
  );
}

// --- the search -----------------------------------------------------------------------------

type Found = {
  models: IndexModel[];
  groups: Entry[];
  brands: string[];
  categories: Entry[];
  pages: string[];
};

function sort(hits: Hit[], index: NameIndex): Found {
  const entries = hits.flatMap((h) => h.entries);
  const brands = [...new Set(entries.filter((e) => e.kind === "brand").map((e) => e.ref))];
  const modelIds = [...new Set(entries.filter((e) => e.kind === "model" || e.kind === "model_number").map((e) => e.ref))];
  let models = modelIds.map((id) => index.models.get(id)).filter((m): m is IndexModel => Boolean(m));
  // A brand named beside a model name settles which maker's model it is.
  if (brands.length && models.some((m) => brands.includes(m.brand_slug))) {
    models = models.filter((m) => brands.includes(m.brand_slug));
  }
  let groups = entries.filter((e) => e.kind === "family" || e.kind === "series");
  if (brands.length && groups.some((g) => brands.includes(g.brand!))) groups = groups.filter((g) => brands.includes(g.brand!));
  return {
    models,
    groups,
    brands,
    categories: entries.filter((e) => e.kind === "category"),
    pages: [...new Set(entries.filter((e) => e.kind === "page").map((e) => e.ref))],
  };
}

/** form and fuel from every product word named: "gas" and "insert" make gas inserts. */
function typeOf(categories: Entry[]): { form: string | null; fuel: string | null } {
  let form: string | null = null;
  let fuel: string | null = null;
  for (const c of categories) {
    const [f, u] = c.ref.split("/");
    if (f !== "*") form ??= f;
    if (u !== "*") fuel ??= u;
  }
  return { form, fuel };
}

/** "Jøtul F 500 V3 Oslo", without the " · wood stove" a label carries. */
const nameOf = (label: string) => label.split(" · ")[0];

export async function runSearch(req: SearchRequest): Promise<SearchResponse> {
  const text = req.message.trim().slice(0, LIMITS.message);
  if (!text) {
    return respond("unsupported", "Type or say what you're looking for: a brand, a model, or a question about your stove.", []);
  }

  const index = await getIndex();
  const rec = recognize(text, index);

  // Safety first, with held names already set aside.
  const screened = screen(rec.unheld);
  if (screened === "emergency") {
    return respond("answer", EMERGENCY_MESSAGE, [{ ...pageSource("/contact-us/"), detail: `When everyone is safe, call us at ${business.phoneDisplay}` }]);
  }
  if (screened === "refusal") {
    return respond("answer", REFUSAL_MESSAGE, [pageSource("/services/"), pageSource("/contact-us/")]);
  }

  const found = sort(rec.hits, index);
  const words = searchWords(rec.leftover);
  const phrase = askedText(text, rec);
  // Say how anything not typed exactly was read: the corrected words, or the name a start was taken for.
  const spelled = rec.hits.flatMap((h) => {
    if (h.match === "prefix") return [`${quote(h.typed)} as ${quote(nameOf(h.entries[0].label))}`];
    if (h.match !== "near") return [];
    const typed = h.typed.split(" ");
    const held = h.held.split(" ");
    return typed.flatMap((w, k) => (held[k] && held[k] !== w ? [`${quote(w)} as ${quote(held[k])}`] : []));
  });
  const spellNote = spelled.length ? ` (I read ${list(spelled)}.)` : "";

  // A scope from the page (a model's card, say) applies only when the search names nothing else.
  if (req.scope?.modelId && !found.models.length && !found.groups.length && !found.brands.length) {
    const m = index.models.get(req.scope.modelId);
    if (m) found.models = [m];
  }

  // 1. Particular models, by name or number.
  if (found.models.length) {
    const models = found.models;
    const lead = models.slice(0, 4).map(modelSource);
    const about = models.length === 1 ? `the ${modelTitle(models[0])} guide` : `the guides for ${list(models.slice(0, 3).map(modelTitle))}`;
    if (words.length) {
      const answer = await answerFromGuides(models.map((m) => m.id), words, about, lead, phrase);
      if (answer) return { ...answer, reply: answer.reply + spellNote };
      return respond(
        "results",
        `I found the ${list(models.slice(0, 3).map(modelTitle))}, but nothing in ${models.length === 1 ? "its guide or manual" : "their guides or manuals"} mentions ${quote(phrase || words.join(" "))}. Open the guide below, or ask us.${spellNote}`,
        [...lead, pageSource("/contact-us/")],
      );
    }
    if (models.length === 1) {
      const m = models[0];
      const note = modelNote(m);
      return respond(
        "results",
        `${modelTitle(m)}, ${typeLabel(m.form, m.fuel)}${note ? ` · ${note.toLowerCase()}` : ""}.${spellNote}`,
        [modelSource(m), brandSource(m.brand_slug)],
      );
    }
    // Several share what was typed: say which ones, with what tells them apart.
    return respond(
      "clarify",
      `${plural(models.length, "model")} match ${quote(rec.hits.map((h) => h.typed).join(" "))}. Which one?${spellNote}`,
      models.map(modelSource),
      models.slice(0, 4).map((m) => ({ label: `${modelTitle(m)} · ${typeLabel(m.form, m.fuel)}`, message: modelTitle(m) })),
    );
  }

  // 2. A family or series: Ashford, Bellingham, ML-Series.
  if (found.groups.length) {
    const ids = [...new Set(found.groups.flatMap((g) => g.modelIds))];
    const models = ids.map((id) => index.models.get(id)!).filter(Boolean);
    const what = list([...new Set(found.groups.map((g) => g.label))]);
    if (words.length) {
      const answer = await answerFromGuides(ids, words, `the ${what} guides`, models.slice(0, 4).map(modelSource), phrase);
      if (answer) return { ...answer, reply: answer.reply + spellNote };
    }
    // Current models first; discontinued ones still show, because owners need their guides.
    const ordered = [...models.filter(isPublic), ...models.filter((m) => !isPublic(m))];
    return respond(
      "results",
      `${what}: ${plural(models.length, "model")}.${words.length ? ` Nothing in their guides mentions ${quote(phrase || words.join(" "))}.` : ""}${spellNote}`,
      ordered.map(modelSource),
    );
  }

  // A name started but not finished, with more than one way to finish it: ask.
  if (rec.suggestions.length && words.length <= 1) {
    const choices = rec.suggestions.slice(0, 4).map((e) => ({ label: e.label, message: nameOf(e.label) }));
    return respond("clarify", `Did you mean ${list(choices.map((c) => quote(c.message)))}?`, [], choices);
  }

  // 3. A brand, a product type, or both: a list from the makers' current lineups.
  if (found.brands.length || found.categories.length) {
    const { form, fuel } = typeOf(found.categories);
    const brandNames = found.brands.map(brandLabel);

    // A brand and a question, with no product type: answer from that brand's guides.
    if (words.length && found.brands.length && !found.categories.length) {
      const ids = [...index.models.values()].filter((m) => found.brands.includes(m.brand_slug)).map((m) => m.id);
      const answer = await answerFromGuides(ids, words, `the ${list(brandNames)} guides`, found.brands.map(brandSource), phrase);
      if (answer) {
        return {
          ...answer,
          reply: `${answer.reply} Tell me your model for the one that fits yours.${spellNote}`,
        };
      }
    }

    const lineup = (await listPublicLineup()).filter(
      (m) =>
        (!found.brands.length || found.brands.includes(m.brand_slug)) &&
        (!form || m.form === form) &&
        (!fuel || m.fuel === fuel),
    );
    const typeText =
      form && fuel
        ? `${typeLabel(form, fuel)}s`
        : form
          ? `${form.replace("_", " ")}s`
          : `${fuel ? `${fuel} ` : ""}stoves, inserts and fireplaces`;
    const heading = `${brandNames.length ? `${list(brandNames)} ` : ""}${typeText}`;
    const notInCatalog = found.brands.filter((s) => brandBySlug(s)?.inCatalog === false);
    const unchecked = words.length ? ` I couldn't check ${quote(phrase || rec.leftover.join(" "))} yet, so the list isn't narrowed by it.` : "";
    const shown = lineup.slice(0, 48);
    const page = pageForType(form, fuel);

    const reply = fuel && NOT_SOLD_FUELS.has(fuel)
      ? `We don't sell ${fuel} ${form ? `${form.replace("_", " ")}s` : "stoves or inserts"}. Call ${business.phoneDisplay} or stop in and we'll go through the wood and gas options.${spellNote}`
      : lineup.length
      ? `${heading.charAt(0).toUpperCase()}${heading.slice(1)}: ${plural(lineup.length, "model")} in the makers' current lineups${lineup.length > shown.length ? `, the first ${shown.length} here` : ""}.${unchecked}${spellNote}`
      : notInCatalog.length
        ? `We sell ${list(notInCatalog.map(brandLabel))}, but its lineup isn't on the site yet. Call ${business.phoneDisplay} or stop in and we'll go through it.${spellNote}`
        : `None of the makers' current lineups have ${heading}.${unchecked} Ask us: we may know of one.${spellNote}`;

    const filters: Record<string, string> = {};
    if (found.brands.length === 1) filters.brand = found.brands[0];
    if (form) filters.form = form;
    if (fuel) filters.fuel = fuel;

    return respond(
      "results",
      reply,
      [
        ...found.brands.map(brandSource),
        ...(page ? [pageSource(page)] : []),
        ...shown.flatMap((m) => {
          const held = index.models.get(m.id);
          return held ? [modelSource(held)] : [];
        }),
        ...(lineup.length ? [] : [pageSource("/contact-us/")]),
      ],
      [],
      Object.keys(filters).length ? filters : null,
    );
  }

  // 4. A bare everyday-word name, confirmed only if its guide answers the question.
  if (rec.tentative.length && words.length) {
    const ids = [...new Set(rec.tentative.flatMap((h) => h.entries.flatMap((e) => e.modelIds)))];
    const answer = await answerFromGuides(
      ids,
      words,
      list([...new Set(rec.tentative.flatMap((h) => h.entries.map((e) => nameOf(e.label))))].slice(0, 3)),
      ids.slice(0, 4).map((id) => modelSource(index.models.get(id)!)),
      phrase,
    );
    if (answer) return answer;
  }

  // 5. A page of the site, asked for on its own: "hours", "installation".
  if (found.pages.length && !words.length) {
    if (found.pages.includes("/contact-us/")) {
      return respond(
        "answer",
        `${business.name} is at ${business.street}, ${business.city}, ${business.state}. Hours: ${hoursLine}. Call ${business.phoneDisplay}.`,
        found.pages.map(pageSource),
      );
    }
    return respond("answer", `${list(found.pages.map((p) => pageSource(p).title))}.`, found.pages.map(pageSource));
  }

  // 6. A question with no model: what the guides and pages say, across the board.
  const allWords = searchWords(rec.tokens);
  if (allWords.length) {
    const [sections, hrefs] = await Promise.all([searchSections(allWords, null, 8), Promise.resolve(sitePages(allWords))]);
    const pagesFound = [...new Set([...found.pages, ...hrefs])];
    if (sections.length || pagesFound.length) {
      const guides = new Set(sections.map((s) => s.guide_id)).size;
      const parts = [
        pagesFound.length ? `${plural(pagesFound.length, "page")} on our site` : "",
        sections.length ? `${plural(sections.length, "section")} from ${plural(guides, "owner & installer guide")}` : "",
      ].filter(Boolean);
      return respond(
        "answer",
        `For ${quote(text)}: ${list(parts)}.${sections.length ? " Tell me your stove's brand and model to narrow it to yours." : ""}`,
        [...pagesFound.map(pageSource), ...sections.map(sectionSource)],
        rec.suggestions.slice(0, 2).map((e) => ({ label: `Did you mean ${nameOf(e.label)}?`, message: nameOf(e.label) })),
      );
    }
  }

  // 7. Nothing at all: say so, and offer the way forward.
  return respond(
    "results",
    `Nothing on the site matches ${quote(text)}. Try a brand or model name, or ask us: call ${business.phoneDisplay}.`,
    [pageSource("/brands/"), pageSource("/contact-us/")],
    [{ label: "See all brands", message: "brands" }],
  );
}

/** For the server log and the search log: what kind of outcome a response is. */
export function outcomeOf(r: SearchResponse): "results" | "answer" | "clarify" | "nothing" | "refused" {
  if (r.kind === "unsupported") return "refused";
  if (r.kind === "results" && !r.sources.some((s) => s.kind === "model" || s.kind === "guide_section")) {
    return r.sources.some((s) => s.kind === "brand") ? "results" : "nothing";
  }
  return r.kind;
}
