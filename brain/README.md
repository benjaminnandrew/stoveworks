# Stoveworks Brain — Brand & Model store (v2)

The product catalog for the Stoveworks "brain": every model Stoveworks can sell from its
13 brands, with the manufacturer's own specs, product photos, manuals, and an owner &
installer guide per manual. Everything here comes from the manufacturers (their product pages,
spec sheets, brochures and manuals). Checked against manufacturer sources on 2026-10-07.

## What's inside

| Path | What it is |
|---|---|
| `data/models.json` | 200 model records, the source of truth (schema below) |
| `data/brands.json` | 13 brands, with their websites and where the current Stoveworks site lists each |
| `data/models.csv` | Flat one-row-per-model export for spreadsheets |
| `data/candidates.json` | 32 current models seen on manufacturer sites but not in the catalog yet (unverified) |
| `data/shapes.json` | The shared shape groups and viewing options behind the `shape` and `viewing` fields, for filter labels |
| `assets/images.json` / `.csv` | 1022 unique product image URLs, mapped to models, with storage keys |
| `assets/manuals.json` | 200 manuals to download: each model's newest US operation & installation manual(s) |
| `assets/documents.json` / `.csv` | 1041 unique PDFs (354 installation/owner's manuals), mapped to models |
| `scripts/ingest-assets.mjs` | Downloads the images and PDFs into a local folder or Replit App Storage |
| `guides/` | 186 owner & installer guides (one per manual set, covering 200 models), their index `guides.json`, the template and the tools |
| `archive/` | Not part of the brain: models not for sale in the US (with their guides), and the old Stoveworks portal's values and how they compared with the manufacturer, kept for reference |

## Status at a glance

- 200 models from 13 brands. 21 more that the maker says are not for sale in the US are set aside in `archive/set-aside-not-for-us.json` (their 13 guides in `archive/set-aside-guides/`). US availability of the 200: 187 available, 3 temporarily unavailable, 2 discontinued, 8 unclear.
- `carry_status` is `unconfirmed` on every model until Stoveworks decides what it carries.
- 200 of 200 models have an owner & installer guide.
- 474 places on 171 models where the manufacturer's website and its own manual disagree are listed under `manual_differences`. The catalog shows the website's figure and the guides the manual's, each noting the other.
- 55 models carry a `shape` (29 of them Mendota, from its "Find your shape" pages; the rest where the maker's own name, page or specs state one), 30 carry Mendota's `flame_pattern`, and 9 list `viewing` options such as see-through or corner. `brands.json` → `browse` says how each fireplace maker sorts its own lineup.

| Brand | Models | Website |
|---|---|---|
| Blaze King | 13 | https://www.blazeking.com/ |
| Kozy Heat | 30 | https://www.kozyheat.com/ |
| Jøtul | 27 | https://www.jotul.com/ |
| Pacific Energy | 43 | https://www.pacificenergy.net/ |
| Hearthstone | 25 | https://www.hearthstonestoves.com/ |
| Morsø | 12 | https://morsoe.com/us/ |
| Mendota Hearth | 30 | https://mendotahearth.com/ |
| Town & Country Fireplaces | 11 | https://townandcountryfireplaces.com/ |
| RSF | 9 | https://icc-rsf.com/fireplace/rsf/ |
| Wilkening Fireplace | 2 | https://www.wilkeningfireplace.com/ |
| Renaissance | 4 | https://icc-rsf.com/fireplace/renaissance/ |
| Kuma | 8 | https://www.kumastoves.com/ |
| True North | 7 | https://truenorthstoves.com/ |

## Rules this data follows

- Specs come only from the manufacturer's own pages and PDFs. Nothing is estimated; a missing
  value is `null`.
- We report everything the makers print and post (Ben, Oct 12). Where the manufacturer's website
  and its manual disagree, the catalog shows the website's figure and records the manual's under
  `manual_differences` (with the page); the guides show the manual's figure, so it matches the page
  the link opens, with the website's noted right beside it. Each difference is tagged `kind`:
  installation-safety value (clearances, gas input, venting, mobile-home approval, outside air,
  ignition) or product spec.
- Model identity follows the manufacturer's naming (LE vs LE2, CF, BV vs DV, IPI, Classic, Décor
  vs Timberline…). Series with several sizes keep one record with a `sizes[]` array.
- One exception (Ben, Oct 9): True North's website shows a single "Log Size (max.)" that is really
  the manual's ideal length, so for the TN10, TN20 stove and insert, and TN25c the catalog records
  both, `log_length_recommended_in` (the website's figure) and `log_length_max_in` (the manual's),
  and the difference stays listed with a note.
- Efficiency figures use different test bases across brands (HHV, LHV, CSA P.4.1, AFUE, steady
  state). Always show `efficiency_basis` next to the number; don't compare across bases.
- Shapes and flame patterns use the maker's own words. A model gets a shape only where the maker
  states one (Mendota's shape pages, or another maker's model name, product page or published
  specs); nothing is judged from photos, and front or door options (an arched screen front,
  arched or rectangular doors) are options, not the model's shape. `shape.group` folds the makers'
  words into one cross-brand set for filters.
- No prices are stored.

## Model record (key fields)

```
id, brand, brand_slug, name, official_name, model_numbers[]
form           stove | insert | fireplace | cook_stove | outdoor_fireplace
fuel           wood | gas | electric | pellet
install_type   freestanding | insert | zero_clearance | masonry | outdoor
venting        chimney | direct_vent | b_vent | vent_free | none
series         the maker's product family (Bellingham, ML-Series, Green Mountain Family…)
style          broad look for filters: traditional | transitional | contemporary | rustic
               (assigned during research; not a maker term, unlike shape and flame_pattern)
shape          the maker's own shape word, where it states one, else null:
               name (Classic Arch, Landscape, Tall Linear, Widescreen…), group, basis, source
               group, for cross-brand filters (labels in data/shapes.json):
               classic    Traditional proportions: Mendota's Classic shape
               landscape  Landscape format: Mendota's Landscape shape, Kozy Heat's Bellingham series
               linear     A long, linear fire: makers call it Linear, Tall Linear or Widescreen
               arch       An arched firebox, door or glass top
               rumford    A Rumford-style firebox: shallow, with angled sides and a curved throat
flame_pattern  Mendota's flame pattern, else null: name (Traditional | FireIn | Timberline | Décor),
               source, note (e.g. a Timberline fireplace Mendota also sells as the Décor)
viewing        where the maker states it, else null: options (single_sided | see_through | corner |
               three_sided | indoor_outdoor), basis, source
lineup_status  current | discontinued | unclear            (manufacturer's lineup)
us_availability available | temporarily_unavailable_us | temporarily_unavailable | discontinued | unclear
               (models not for sale in the US are set aside in archive/)
availability_evidence  what the availability call rests on
carry_status   unconfirmed                                 (set by Stoveworks, never inferred)
headline       heating_area_sqft_max, btu + btu_basis, efficiency_pct + efficiency_basis,
               log_length_max_in, burn_time_hr_max        (for grids and the "verdict number")
specs          normalized numbers in fixed units (BTU/hr, sq ft, in, lb, cu ft, g/hr, %)
sizes[]        per-size specs for series records
specs_raw[]    every published label/value exactly as the manufacturer printed it, with source URL
images[]       url, role (primary_cutout | cutout | lifestyle | detail | line_drawing | other), variant, alt
hero_image     best single image URL (cutout first, then lifestyle)
documents[]    type (installation_manual | owners_manual | spec_sheet | brochure | epa_report | parts_list | warranty), url, language
latest_manuals[] the newest US operation & installation manual(s): url, storage_key, role, configuration, revision, date
guides[]       the owner & installer guide(s) for this model, one per configuration where versions have
               their own manuals: id, title, configuration, file, manuals[] (storage key, label, revision)
manual_differences[] field, kind, website (the catalog's figure), manual (the manual's figure), manual_page, guide, rule,
               note (where another maker document, such as a newer brochure, sides with one of them)
sources[]      the manufacturer pages and PDFs the record was checked against
checked_on     date of the check
```

## Brand record (key fields)

```
slug, name, website, about, model_count, categories, current_site_lists
browse         how the maker sorts its fireplaces on its own site (null where not checked):
               sorts_by (one or two sentences), sources[]; for Mendota also shapes[] and
               flame_patterns[] (name, group, about in our words, url), the basis for a
               "Find your shape" browse on the site
```

## Downloading the manuals and photos

The package lists every image and PDF by URL; `scripts/ingest-assets.mjs` downloads them, either
into a local folder or into Replit App Storage (its object storage).

**Into a local folder** (run from your own terminal in the site project, because the
manufacturers' sites must be reachable):

```
node brain/scripts/ingest-assets.mjs --manuals --out var/brain-assets   # newest US manual(s) per model
node brain/scripts/ingest-assets.mjs --documents --out var/brain-assets # every PDF
node brain/scripts/ingest-assets.mjs --images --out var/brain-assets    # product photos
```

`--manuals` downloads exactly the 200 files in `assets/manuals.json`: each model's newest
US-edition operation & installation manual(s), one per configuration where versions have their own
manuals. No older revisions, Canadian or French editions, or accessory sheets. Files land at
`var/brain-assets/<storage key>` (e.g. `documents/jotul/…pdf`), the same keys the catalog uses, so
moving them into object storage later is a straight copy. `var/` is git-ignored.

**Into Replit App Storage** (a bucket created in the App Storage tool). If the files are already
downloaded, as on Ben's laptop, upload those `images` and `documents` folders instead: the guides
were checked against exactly those files, and a maker can replace a PDF at the same address.

```
npm install @replit/object-storage
node scripts/ingest-assets.mjs            # images + documents
node scripts/ingest-assets.mjs --manuals  # manuals only
```

Either way it skips files already saved, retries politely on rate limits, rejects anything that
isn't really an image or a PDF, and records progress, so re-running only fetches what's missing.
`--brand jotul`, `--lang all`, `--limit N` and `--dry-run` narrow a run.

**Image rights:** these are the manufacturers' photos. Authorized dealers can normally use them
under their dealer agreement; for the best quality, use the brands' dealer media libraries where
Stoveworks has a login.

## Owner & installer guides

`guides/` has 186 guides, one per manual set: models that share a manual share a guide, and
a model sold in versions with their own manuals gets one guide per version. Each is one
self-contained HTML page with an "I own it" path (plain-language answers) and an "I install it"
path (specs, install sequence, faults, codes), search across the full manual, and links that open
the official PDF at the exact page.

- **Built from:** a shared template (`guides/template/`) plus a content file per guide
  (`guides/content/<id>.json`). Rebuild with `python3 guides/tools/build_guide.py <id>` or `--all`.
- **Checked:** every guide passes the build, the QA harness (`guides/qa-guide.js`), a number check
  (every number in the guide appears in its manual, or on the maker's website where a note quotes
  it), a browser test and a phone check.
- **Differences (Ben, Oct 12: report everything):** where a manual disagrees with itself, the guide
  shows both figures in a plain "Note:" at that spot, with the pages. Where the maker's website
  differs, a small "Maker's website:" note gives its figure next to the manual's. Plain misprints
  (a metric figure that doesn't match its inch figure, a part number the parts list settles) are
  corrected, with a small note saying what was printed. Each page ends with a short explanation.
  Each content file's `review` block records every one, classed substantive, clerical or
  not_a_conflict; `guides.json` has the counts per guide.
- **Serving:** in the site, `/guides/<id>/` serves each guide from the database and points its
  manual links at `/files/`, which serves the PDFs inline as `application/pdf` so `#page=N` opens
  the page. Opened on their own, the pages link to `../../var/brain-assets/<storage key>`
  (`MANUAL_BASE` in the page).
- `guides.json` lists every guide with its models, manuals and revision.

## Loading into the database

In the site project, `npm run brain:load` loads the whole package into the `catalog_*` tables (the
site's `db/catalog.sql` defines them): brands; models, with the classification and headline figures
as columns and the full record as JSON; one row per photo and per PDF, recording whether the file
is in storage; the guides, pages included; and the links between them. It's safe to re-run after
the brain changes or files are uploaded, and it leaves `carry_status` alone once Stoveworks staff
have set it. `--dry-run` shows what would change. The site's `docs/replit.md` covers the move to
Replit.
