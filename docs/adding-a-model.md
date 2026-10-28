# Adding, changing or removing a model

Ben, 22 Oct 2026: when a maker adds or drops a model for the year, the details are kept in the
backend (the brain), and the site follows. Nothing on the site is built by hand per model.

## The one rule

**The brain is the source; the site is generated from it.** Never hand-write a model page, a
lineup card or a compare row. Change the brain, then load it. Give a Replit agent (or anyone)
this file and this rule.

## Add a model

1. **In the brain** (`brain/`, Ben's knowledge base), add the model the way the others were
   added:
   - **The record** goes in `brain/data/models.json`, with the maker's own figures and sources,
     the photos and documents, and `lineup_status` and `us_availability`.
     - The schema is in `brain/README.md` under "Model record".
     - Specs come only from the maker; a missing value is `null`, never estimated.
   - **The owner & installer guide** is built from the manual:
     `python3 brain/guides/tools/build_guide.py <id>`. Then run the guide checks the brain README
     lists.
   - **The files:** `node brain/scripts/ingest-assets.mjs --images --manuals --out var/brain-assets`.
2. **Load it into the site:**
   1. Stop the dev server (PGlite is single-process).
   2. Run `npm run brain:load`.
   3. Start the dev server again.

   `--dry-run` shows what would change first.
3. **Steve marks it** at `/admin/carry/` if it's on the showroom floor or carried. Unmarked
   models still show, as the maker's current lineup.

That's all. The load puts the model everywhere it belongs:

- **Its own page:** `/brands/<brand>/<model>/`, with its title, description, Product and
  breadcrumb data, and a sitemap entry. Opened from a list, the page shows as a pop-up over the
  list.
- **The lists:** the brand's page, and its product page (Wood Stoves, Gas Inserts…).
- **The tools:** site search, compare, saved, and the room visualizer's product list.
- **Its guide:** at `/guides/<id>/`, linked from the card and the model page.

## Change a model

Edit its record or guide in the brain and run `npm run brain:load` again. Staff marks
(`carry_status`) survive every load.

## Remove a model

- **The maker dropped it:** set `lineup_status: "discontinued"` in the brain (or remove the
  record) and load. It leaves every list, the sitemap and search, and its page returns 404.
  - A staff-marked model that leaves the brain is kept as retired, so Steve's mark isn't lost if
    it returns.
- **Stoveworks doesn't sell it:** Steve marks it **Not carried** at `/admin/carry/`. That hides
  it at once, with no load needed.

## A new brand

Brands the site sells are listed in `src/content/brands.ts`, with the logo used by the brand
pages and the Brands menu. Add the brand there as well as in the brain.

## Check after a load

- The model's page opens and its title fits (59 characters including " | Hayward Stoveworks").
- It appears on its brand page and product page.
- `npm run test:search` still meets its marks (see `docs/smart-search-plan.md`), since search
  reads the same catalog.
