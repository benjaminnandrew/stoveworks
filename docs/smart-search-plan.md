# Smart search: the blueprint fitted to Stoveworks

Ben, 20 Oct 2026: build a smart search, with [SMART-SEARCH-BLUEPRINT.md](SMART-SEARCH-BLUEPRINT.md)
as the guide. This is the answer to its kickoff prompt (section 14): what's here, what's missing,
the name generator, the shapes fitted to this codebase, and Phase 1. **Phase 1 is built** (same
day, see section 5), with the obvious type-or-talk box on the home page that Ben asked for.

Like the SEO brief, the blueprint is a guide to work from and test against. Where it and this
site differ, the brain and the site's standing rules win (no prices, Steve decides what's
carried, the brain is never public or edited).

---

## 1. What the search can use, and what's missing

Measured from `brain/` on 20 Oct.

### Already here

| Need | What exists |
|---|---|
| Models | 200 (197 current, 2 discontinued, 1 unclear), 13 catalog brands, plus Majestic on the site only |
| Names | `name` on all 200; `official_name` differs from it on 142; `series` on 152 (Bellingham, ML-Series…) |
| Model numbers | 128 numbers on 119 models. Five are shared by Mendota Décor/Timberline pairs: the same unit with two flame looks |
| Typed filters | form, fuel, install_type, venting, style, shape group, viewing, flame pattern; heating area, efficiency (with basis), burn time, log length; width/height/depth on about 136; flue diameter on 95 |
| Manual, layer 1 | The PDFs, served at `/files/…` with `#page=N` |
| Manual, layer 2 | Per-page text for 9,804 manual pages (19 MB), already extracted. It's inside each guide page as `PAGES`, which is what the guide's own "search the manual" uses |
| Manual, layer 3 | 186 guide content files (`brain/guides/content/*.json`) with 3,325 sections (1,857 owner, 1,468 installer). Each has a title, body and manual page; plus 116 error codes, 3,068 fault lines and 1,482 extra index terms |
| Site pages | 22 content pages, contact, the two tools, the brand pages |
| Stock signal | `carry_status`: *On our showroom floor* is the only "in stock" the site has |

### Missing, and what to do about it

| Gap | Proposal |
|---|---|
| `search_names`, `search_aliases`, `search_log` | Build them (site tables, generated at `brain:load`) |
| Guide sections and manual pages as searchable rows | Load them (they're in the brain but not in the database as rows): `catalog_guide_sections`, `catalog_manual_pages`, each with a `tsvector` and GIN index. Built by the loader from the content files and each guide's `PAGES` |
| Prices | **Dropped.** The site stores no prices by standing rule. A budget is read, said back, and answered "we quote in person" |
| Inventory | None. "Is it in stock?" answers from `carry_status`: on the floor → say so; otherwise "call or stop in" |
| Reviewed safety values (`review_state`) | None exist. Until they do, the search **never states** a clearance, gas pressure, flue size or hearth-protection figure in its own words. It links the guide's section and the manual page, where the figure is printed |
| Typed minimum fireplace opening (inserts) | Only raw text, on 17 of 32 inserts, in about a dozen label formats. "Fits my 24-inch opening" needs typed fields in the brain (`min_opening_width_in` etc.). Until then it's named back as something we can't check, with "bring your measurements" |
| Successor models | Not in the brain; only 2 models are discontinued. Skipped for now |
| Nicknames | None beyond official names. They come from the search log, as staff-added aliases |

---

## 2. The `search_names` generator

Runs at the end of `npm run brain:load` (and alone as `npm run search:names`). It reads the
catalog tables, `src/content/brands.ts` and `src/content/pages.ts`, replaces `search_names` in
one transaction, and writes a coverage report. Nothing in it names a brand or model.

| Kind | Generated from | Example name keys |
|---|---|---|
| brand | brands.ts name + aliases, the catalog's spelling | `jotul`, `kozy heat`, `kozyheat`, `mendota hearth` |
| model | brand + name; name alone; official name; brand alias + name | `blaze king princess 32`, `princess 32`, `f 500 v3 oslo` |
| model_number | each number, folded and compact | `pe32`, `aa1104391` |
| series | `series` (covers every model in it) | `bellingham`, `ml series` |
| category | form × fuel labels and their common words | `gas insert`, `wood stove`, `woodstove`, `pellet` |
| page | page titles, meta titles, brand pages, plus a small terms file of site words (data, not code: hours → Visit, financing…) | `gas logs`, `hours` |
| error_code | each guide's codes, tied to its models | `e1` (with the model) |

- **Folding** exactly as blueprint section 3 (ø→o, æ→ae, ß→ss, then NFKD), applied to stored and typed text alike. Test: Jøtul, Morsø, Décor.
- **Ordinary-word names, as a general rule:** a model name with no digit counts only beside a brand or product word, or as the whole query. That's 30 names today (HearthStone Heritage, Lincoln, Bristol, Stowe; Mendota Chelsea…). No word list.
- **Names inside names:** "king" is both Blaze King's brand word and the King 40. The longer held name wins ("blaze king king 40").
- **Coverage report** (`var/search-coverage.json`, summary printed by the loader, later on an admin page): per model, every form it can be found by, and flags for no model number (81 models), an ordinary-word name, a shared number, or a missing guide.

---

## 3. The shapes, fitted

**Interpretation (Phase 2).** As the blueprint's, with these changes:

- `minPrice`/`maxPrice` removed. A budget goes in `unresolved`, and the reply says prices are quoted in person.
- `productTypes` uses the brain's words: `stove | insert | fireplace | cook_stove`, plus `installTypes` (`zero_clearance | masonry`) and `venting` (`chimney | direct_vent | b_vent | vent_free`).
- `minBtu` is read and said back but not filtered: makers rate BTU on different bases (the brain records which), so the reply offers heating area instead.
- `features` maps to typed fields where one exists (catalytic, blower, mobile-home approved, outside air, see-through, shape, flame pattern, style). Anything else goes in `unresolved`.
- `inStockOnly` becomes `onFloorOnly`.
- `opening` is kept, and answered as "can't check yet" until the brain has typed opening fields.

**Candidate:** as the blueprint's, with `kind` adding `series` and `category`.

**Response:** the blueprint's `SearchResponse` unchanged, with `sources[].kind` adding `brand`.
One endpoint, `POST /api/search` (with `scope: { modelId?, brandSlug?, audience? }`). One results
page, `/search/?q=…`, server-rendered so results have a URL and work without JavaScript.

**Surfaces:** the header (a search button opening a panel, like the mega menus), the mobile
drawer, `/search/`, and later "Ask about this stove" on model cards. **One deliberate exception:**
each guide's built-in "search the manual" stays as it is. It's part of Ben's guide template, works
on its own, and only ever covers its own manual.

---

## 4. Phase 1: no AI

### What gets built

1. **Tables and loader:** `search_names`, `search_aliases`, `search_log` (30 days, no visitor IDs), `catalog_guide_sections`, `catalog_manual_pages` (with `tsvector`s), the generator and coverage report.
2. **Guard:** length and shape limits, a per-visitor and overall rate limit, and the emergency screen. Gas smell, CO alarm, chimney fire and smoke filling the room get a fixed message *before* anything else. Held names are set aside first. **Steve approves the wording**; until he does, a draft is used and marked as such in the code.
3. **Recognizer:** in memory, rebuilt after each load. The loader retries after a failure rather than keeping a failed first read. Matching order: exact name or alias, then prefix, then near spelling, per the blueprint.
4. **Instant answers:** exact model, model number, brand, page or category, and error code + model.
5. **Retrieval without AI:** when the recognizer pins a model, the rest of the words search that model's guide sections, then its manual pages. Guide sections rank first, and the answer cites the page. "ashford clean glass" and "newcastle pilot" work here without an AI step.
6. **The box:** header panel, drawer field and `/search/`, all calling the one endpoint and validating the one response shape.

### Pass marks, set now

Generated from the brain and run through the real endpoint, with outside network calls blocked.
Tests use Node's built-in `node --test`, so no new test framework.

| Test | Pass mark |
|---|---|
| Findability, exact forms (full name, brand + name, model number spaced/compact/hyphenated, plain letters) | 98% on page one |
| Findability, loose forms (one typo, name start, official name) | 90% |
| Plain letters (Jøtul, Morsø, Décor typed plain) | 100% |
| Spelling: one typo gets a "Did you mean" that includes it | 95% |
| Name collisions: held names containing rule words, and shared model numbers asking "Which one?" | 100% |
| Safety: emergency phrases always get the fixed message | 100% |
| Guide retrieval: a question built from each guide section's title finds that section in the top 3, model given | 90% |
| Speed: recognizer p95 | under 20 ms |
| Speed: instant answers | under 300 ms |

### Later phases (from the blueprint, unchanged in order)

2. **Conversation:** the AI interpreter (one fast Claude call per typed search, server-side key on
   Replit), "Which one?", "Did you mean…?", refinements.
3. **Manual help:** cited answers written only from retrieved passages, with audience labels.
4. **Nothing found:** widenings with counts, "Talk to us", and the staff review loop.

---

## Decisions this plan assumes (say if any are wrong)

1. **No prices:** price filters are dropped, and budgets are answered "we quote in person".
2. **Safety figures are linked, not stated,** until someone confirms them field by field.
3. **Emergency and refusal wording:** I draft it, Steve approves it.
4. **Insert opening sizes:** typed fields belong in the brain (Ben's side), not in a site-side extraction.
5. **The guides' own manual search stays,** as the one exception to "one engine behind every box".

---

## 5. Phase 1 as built (20 Oct 2026)

**Where it shows:**
- **Home page:** a big type-or-talk box in the hero, under the opening line, with three example searches beneath it.
- **Header:** a search button on every page.
- **Mobile drawer:** a search field at the top.
- **`/search/`:** the results page. It's noindexed, and works without JavaScript because the box is a plain form.

**Talk:**
- Uses the browser's own speech recognition, at no cost.
- The button appears only where the browser supports it: Chrome, Edge and Safari, but not Firefox.
- What's said fills the box as it's heard, then searches when the speaker stops.
- Chrome does its recognition on Google's servers and Safari on Apple's, as with any site's voice search.

**The code:**

| File | What it does |
|---|---|
| `src/lib/search/fold.ts` | Folding |
| `src/lib/search/spelling.ts` | Edit distance with swaps |
| `src/lib/search/contract.ts` | Response shape and its validator |
| `src/lib/search/names.ts` | The name index, rebuilt after each brain load and retried after a failure |
| `src/lib/search/recognize.ts` | Exact names, compact numbers, near spellings, name starts, the everyday-word rule |
| `src/lib/search/guard.ts` | Safety screen and rate limits |
| `src/lib/search/retrieve.ts` | Full-text search over guide sections and manual pages |
| `src/lib/search/engine.ts` | The decisions and replies |
| `src/lib/search/run.ts` | Limits, time budget, failures, logging |
| `src/lib/search/log.ts` | The search log |
| `src/app/api/search/` | The endpoint, and `suggest/` for the type-ahead |
| `src/app/search/page.tsx` | The results page |
| `src/components/SearchBox.tsx` | The box |
| `src/content/search-terms.ts` | Product-type and page words: data, not code |
| `scripts/search-rows.mjs` | Builds the guide-section and manual-page rows at `brain:load` |

**Where it departs from the blueprint, and why:**
- **No stored `search_names` table.** The names are generated from the catalog in memory: 200 models take a few milliseconds. The index is rebuilt whenever `catalog_meta.load` changes, so it's still regenerated after every import, without a second copy to keep in step. `search_aliases` and `search_log` are tables.
- **The coverage report is the findability test** (below). It lists every model it couldn't find.
- **Several models matching what was typed:**
  - A model name or number two models share asks "Which one?" with both as choices (Mendota Décor/Timberline, Jøtul F 500 Oslo/Oslo CF).
  - A family or series ("Ashford", "Bellingham") lists its models, discontinued ones last.
  - An unfinished name with several endings offers the families first.
- **Guide sections titled about a gas smell get the emergency message,** not the section. Safety comes first by design.

**Results** (`npm run dev`, then `npm run test:search`, about 80 seconds, through the real endpoint):

| Test | Result | Mark |
|---|---|---|
| Findability, exact forms (656 searches) | 100% | 98% |
| Findability, loose forms (434) | 97.0% | 90% |
| Plain letters (44) | 100% | 100% |
| Spelling, one typo (135) | 100% | 95% |
| Guide retrieval, top 3 (1,115) | 99.2% | 90% |
| Safety: emergencies, refusals, no false alarms | 100% | 100% |
| Name collisions: rule words, shared numbers | 100% | 100% |
| Speed, p95 | names 14 ms, questions 53 ms | 300 ms, 6.5 s |

The loose-form misses are unfinished names answered with a choice of families ("Kozy Heat Osse" → the Osseo series). The retrieval misses are sibling configuration guides of the same model with identical section titles, and the gas-smell sections above.

**Not done yet:**
- **Steve approves the wording:** the emergency and refusal messages are marked as drafts in `guard.ts`.
- **Phase 2:** the AI interpreter, for numbers and wishes the names can't carry: "heats 2,000 sq ft", "quiet", "modern look". Today those are named back as not checked.
- **Staff screens:** the "found nothing" list and adding aliases have no page yet. The data is in `search_log` and `search_aliases`.
