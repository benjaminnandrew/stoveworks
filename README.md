# Hayward Stoveworks

Next.js rebuild of [stoveworksinc.com](https://stoveworksinc.com) — Hayward Stoveworks, Hayward WI.

The business rebranded from "The Stove Works, Inc." to **Hayward Stoveworks** during the
rebuild. The display name lives in one place, `business.name` in `src/content/site.ts`, and
flows from there into the header, footer, page titles, sign-in emails and JSON-LD.

**Phase 1** replicated every page of the live WordPress site on a modern, server-rendered stack.
**Phase 2** added customer accounts, a product inventory, and a room visualizer.
**Phase 3** added a stone veneer mock-up studio with material estimating.
**Phase 4** applied the Hayward Stoveworks rebrand — name, logo and type scheme.

Picking this up cold? Start with **[HANDOFF.md](HANDOFF.md)** — project state, the
decisions behind it, what's unfinished, and the things that will bite you. This file is the
reference manual.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router, TypeScript | Server components, no client framework tax |
| Marketing pages | Prerendered at build | Fast and cacheable; the app routes stay dynamic |
| Styling | Plain CSS + custom properties | `globals.css` = marketing, `app.css` = signed-in surface |
| Fonts | `next/font` (Calistoga, Source Serif 4, Source Sans 3) | Self-hosted, no third-party requests, no layout shift |
| Database | Postgres | PGlite in dev so nothing needs installing |
| Auth | Magic links, own sessions | No passwords to forget, no third-party dependency |
| Images | `sharp` | Re-encodes uploads, which also strips EXIF/GPS |
| Files | Local folders, or Replit App Storage | One interface (`src/lib/file-store.ts`); a published Replit app has no lasting disk |
| Hosting | Replit Reserved VM, run with `npm run start:live` | Brings the database up to date, then serves; see [docs/replit.md](docs/replit.md) |

## Running it

```bash
npm install
cp .env.example .env.local
npm run db:setup       # tables, brands, stone profiles, the catalog and Hearth Studio's cutouts
npm run dev            # http://localhost:3014
```

`db:setup` is `db:migrate`, `db:seed` (the site's brands), the Cultured Stone profiles (first
time only), `brain:load` (the manufacturer catalog, its guides and the products) and
`studio:load` (Hearth Studio's cutouts and sizes, from `db/hearth-studio/`), each safe to re-run.

Other scripts: `npm run build`, `npm start`, `npm run start:live` (the published site: brings
the database up to date, then starts), `npm run typecheck`, `npm run lint`,
`npm run db:reset`, `npm run db:seed:stone`, `npm run db:grant <email> [role]`,
`npm run brain:load -- --dry-run` (shows what a catalog load would change),
`npm run stone:tiles` (regenerates the placeholder stone textures).

### The database in development

With no `DATABASE_URL`, the app runs **PGlite** — Postgres 18 compiled to WASM — against
`var/pgdata`. Same schema, same SQL, same migrations as production; nothing to install.

> **PGlite is single-process.** Stop `npm run dev` before running any `db:*` script, or the
> two processes get divergent views of the data. The scripts detect a running dev server and
> refuse, which is the guard rail — heed it rather than reaching for `--force`.

Set `DATABASE_URL` and this all goes away; `pg` takes over and concurrent access is fine.

### Signing in locally

Without `SMTP_URL`, sign-in emails are **printed to the server console** rather than sent.
Request a link at `/sign-in`, copy the URL out of the terminal, and paste it in.

To make yourself staff (needed for `/admin`):

```bash
npm run db:grant -- you@example.com admin
```

## Layout

```
db/schema.sql               the site's tables, idempotent
db/catalog.sql              the catalog's tables (filled by brain:load), idempotent
db/hearth-studio/           Hearth Studio's sized products and their cutouts (studio:load)
scripts/                    migrate, seed, seed-stone, reset, grant, tile + logo tooling,
                            load-brain (the catalog loader) + store-driver, set-stove-cutout
                            (a stove, its pipe's top outlet, a built-in fireplace or an insert
                            into Hearth Studio locally, until the admin's sizing step; it also
                            writes db/hearth-studio/), load-studio (puts that folder in a
                            site's database and file store)
brain/                      the manufacturer catalog: data, photo/PDF lists, guides
src/
  app/
    layout.tsx              chrome, metadata, LocalBusiness JSON-LD
    (src/proxy.ts)          trailing-slash redirect, pages only
    page.tsx                home
    [...slug]/page.tsx      every marketing page, from src/content/pages.ts
    contact-us/             hand-built: structured address, hours, map
    hearth-studio/          Hearth Studio, the stone visualizer (static app in public/hs/; docs/hearth-studio.md)
    showroom/               the same app for the shop's touch screen
                            (/visualizer/ and /veneer/ are retired and redirect to /hearth-studio/,
                            28 Oct 2026; their editors live on under account/)
    sign-in/, auth/verify/  magic-link request and redemption
    account/                saved designs and mock-ups, profile, both editors
    admin/                  staff inventory: products, cutouts, dimensions
    admin/stone/            staff catalogue: profiles, swatches, coverage
    admin/carry/            staff mark which catalog models the store carries
    brands/, brands/[slug]/ brand hub + each maker's current lineup, from the catalog
    d/[slug]/               read-only shared design
    api/photos              upload + serve private room photos
    guides/[id]/            owner & installer guides, served from the database in the site theme
    files/[...key]/         catalog photos + PDFs, staff cutouts + swatches
    api/designs, api/veneer-designs   persist each tool's work
  components/visualizer/    Visualizer, ProductPicker, DesignPreview, export, stash
  components/veneer/        VeneerStudio, StoneRegion, StonePicker, EstimatePanel, export
  content/                  site.ts (business info + nav), pages.ts, home.ts,
                            brands.ts (the brands sold: one spelling each, slugs, sites)
  lib/                      db, auth, storage, file-store, catalog, products, designs,
                            stone, veneer, homography (the projective maths both tools share)
public/products/            category placeholder silhouettes
public/stone/               generated placeholder stone tiles
var/                        pgdata, uploads, brain-assets (gitignored)
_source/                    the scrape and parser that generated content/
```

## How the visualizer works

A customer uploads a room photo. It is downscaled in the browser before it ever hits the
network, then re-encoded server-side by sharp — which drops the GPS coordinates phones
attach by default.

Products are placed as transparent cutouts, anchored at their **bottom centre** so scaling
grows a stove upward off the floor rather than through it. Every position is stored as a
**percentage of the photo**, so a design renders identically in the editor, in a 480px
thumbnail, and in a full-resolution PNG export.

**Scale** is the part that makes it honest. The customer drags a line across something they
know the size of — a door is 80″ tall, 32″ wide — and enters that measurement. From then on
every product is sized from its real width in the database, and the panel reports what the
customer is actually looking at ("28″ wide in the room"). Uncalibrated, sizes are a sensible
guess and nothing claims otherwise.

Signing in mid-design does not lose the work: the photo and placement are stashed in
`sessionStorage` before the redirect and restored on return.

### Products without photography

Any product with no `cutout_path` renders a category silhouette from `public/products/`,
badged "Photo coming" in the picker, with a notice on the page. The tool is usable from day
one and never pretends a placeholder is the real unit.

## How the veneer studio works

Veneer is a *surface*, not an object, so the mechanic is different from the stove tool.

The customer places an upright box over the wall and resizes it from its sides and corners,
like any image editor. (Until 8 Oct 2026 they dragged four free corners to match the wall's
perspective; Ben found the warping off-putting and asked for plain resize handles. Both
tools now share the same eight-handle frame.)

A region is still stored as four corners, and the stone is still drawn through a
**homography**, a projective map from a rectangle onto that quadrilateral. For an upright
box that map is a plain scale, so nothing warps. Keeping the mechanism means saved mock-ups
and the export path didn't change, and perspective could come back as an option without a
data migration. The solver is in `src/lib/homography.ts` and has one job, which means the
live editor and the PNG export cannot disagree:

- **On screen**, the matrix goes to CSS `matrix3d`. The browser rasterises it on the GPU, so
  resizing stays smooth and the texture stays sharp.
- **On export**, the same matrix drives a triangle mesh on a 2D canvas (a 2D context can only
  do affine transforms, so the quad is subdivided until the error is sub-pixel). Triangles are
  grown a hair before clipping, or antialiasing leaves a grid of seams across the wall.

**Scale comes from the customer, not from guesswork.** They enter how wide and tall the area
really is. That single pair of numbers does three jobs: it sizes the stone courses correctly
(each swatch declares the real area one tile covers), it sets the region's internal aspect,
and it is what the material estimate is computed from.

**Openings** — a firebox, a mantel, a window — are punched with a CSS mask on screen and
`destination-out` on export, both applied *before* the warp, so a hole rides the perspective
and the room shows through it.

### The material estimate

From the entered dimensions: gross area, minus openings, minus the flat area that outside-corner
pieces will cover (the usual half a square foot per linear foot), plus a 10% cutting allowance,
divided by the per-box coverage on each profile. It is a starting point for a quote and the UI
says so; staff confirm against the current coverage chart before anything is ordered.

## Navigation

The bar has five items: **Shop** and **Visualize** open panels, and Services, Cabin Decor and
Visit are plain links. The menus are defined in `src/content/site.ts` (`primaryNav`, `shopMenu`,
`visualizeMenu`) and drawn by `src/components/MegaMenu.tsx`.

- **Shop** is a full-width panel organised the way people arrive: the situation they're in
  ("What are you working with?", four picture links), then stoves, inserts and fireplaces by
  fuel, then hearth, sauna and outdoor, then the tools ("Plan it": the visualizer, the stone
  studio and the showroom). Shop has no page of its own, so its bar item is a button.
- **Visualize** is a small panel under its own item, with the two tools.

Each stove, insert and fireplace link carries the brands stocked on that page (under "Wood
stoves": "Pacific Energy · True North · HearthStone +4"). Those are **derived from the page
content itself** in `src/content/nav-data.ts`, not kept in a second list — a hand-maintained
copy would drift from the pages the moment anyone edited one. It is computed at module load
from the same static `pages.ts` the pages render from, so there is no database call and the
marketing pages stay statically prerendered.

Behaviour worth knowing:

- Hover opens, with a short close delay so crossing the gap to the panel does not snap it shut.
- Keyboard: focus on a menu item opens its panel, tabbing continues into it, Escape closes.
  `onFocus`/`onBlur` rather than the capture variants — React maps those to `focusin`/`focusout`,
  which bubble from the links inside.
- Closed panels are `inert`, so the tab order does not run through every hidden menu.
- `.nav-item` is `position: static` on purpose: the Shop panel's containing block has to be the
  header bar for it to span the full width. `.menu-visualize` is `position: relative`, so the
  small Visualize panel sits under its own item.
- Below 992px the panels are hidden entirely; the mobile drawer takes over.

## Colour

Tokens at the top of `globals.css`. The accent is **oxblood `#96382c`** — warmer and far less
bright than the `#d63d45` inherited from the old WordPress theme, and it takes white-on-accent
contrast from 4.55:1 (only just AA) to 7.24:1 (AAA), which matters wherever white text sits on
an accent fill, such as the header's "Visit the showroom" button.

| Token | Value | Used for |
| --- | --- | --- |
| `--accent` | `#96382c` | Links, buttons (the header's call to action), focus outlines, small accents |
| `--accent-dark` | `#7b2d23` | Hover on accent-filled controls |
| `--danger` | `#8a2318` | Destructive actions only — deliberately distinct now the accent is itself a red |
| `--accent-wash` | `#f6e7e2` | Error panel fill, the Shop menu's showroom card, the selected tile in the home chooser |
| `--accent-wash-soft` | `#faf1ec` | Card hover fill |
| `--gold` | `#e0b64a` | Link hover in the top bar and footer, the mobile drawer's current page, the back-to-top button |
| `--highlight` | `var(--gold)` | Kept as an alias; nothing uses it directly now |

The redesign added a paper-and-pine palette around these: `--paper` (the page background),
`--birch` (surfaces), `--pine` (the top bar), `--gold` and the `--ink` greys. The top of
`globals.css` has the full set.

Emails cannot use custom properties, so `src/lib/mail.ts` inlines the accent — change it in
both places if the accent moves again.

## Typography

Three faces, no others — the scheme is in [docs/type-scheme.md](docs/type-scheme.md) and the
tokens live at the top of `globals.css`:

| Token | Face | Used for |
| --- | --- | --- |
| `--font-display` | Calistoga | Hero words and short display lines only. Never body, nav, buttons or forms, and never italic — Calistoga has no italic. On this site: the home hero line, the two dark-band headings, and the feature-tile titles. |
| `--font-serif` | Source Serif 4 | Page titles and all reading copy. This is the `body` default. |
| `--font-sans` | Source Sans 3 | Nav, buttons, labels, prices, forms, captions, tables. |

Two things worth knowing before editing:

- **Body copy is serif.** `body` is Source Serif 4 at 1rem/1.6. Any UI control that wants the
  sans face has to say so — `font: inherit` on a button now inherits the *serif*, which is why
  every control sets `font-family: var(--font-sans)` explicitly.
- **Labels are a style, not just a size.** Uppercase, 0.75rem, weight 600, tracking 0.2em.
  Form field labels, the contact-page section headings and admin table headers all use it.
  There is a `.label` utility in `globals.css` for new cases.

## The manufacturer catalog

`brain/` is the verified manufacturer catalog: 200 US-sold models from 13 brands, every
published spec, the photos and PDFs, and an owner & installer guide per manual set (see
`brain/README.md`). `npm run brain:load` loads it into the `catalog_*` tables. It's safe to
re-run: it creates its tables if needed (`db/catalog.sql`), brings them in line with the brain
inside one transaction without changing any table's structure outside its own, and never overwrites a
`carry_status` staff have set. A model staff have marked is kept, with `retired_at` set, if it
drops out of the brain; `listCatalogModels` skips those.

The photos and PDFs themselves live in the file store, at the brain's storage keys
(`images/<brand>/…`, `documents/<brand>/…`): `var/brain-assets` locally, App Storage on
Replit. The loader records which files are actually there (`object_path`); when one isn't,
pages fall back to the maker's URL.

| URL | Serves |
| --- | --- |
| `/guides/<id>/` | A guide page, from `catalog_guides`, with its manual links pointed at `/files/` |
| `/files/documents/…`, `/files/images/…` | Catalog PDFs (inline, byte ranges locally, so `#page=N` works) and photos |
| `/files/media/products/…`, `/files/media/stone/…` | Cutouts and swatches staff upload at `/admin` |

`src/lib/catalog.ts` has typed queries (`listCatalogModels`, `getCatalogModel`, `fileUrl`,
`listPublicLineup`) for building pages on the catalog.

### Brand pages and what we carry

`/brands/` lists the 14 brands sold (`src/content/brands.ts`: the brain's 13 plus Majestic,
which is sold but isn't in the catalog). `/brands/<slug>/` shows the maker's **current US
lineup** from the catalog (Ben, 20 Oct: show the lineups now, worded as the maker's lineup, not
as stock), grouped by type, with the maker's own figures: heating area, efficiency with its
basis, wood burn time. No BTU and no prices. Each card links to the model's owner & installer
guide, the maker's page and an "Ask about it" email. The intro and logo come from the brand's
card on the product pages; Majestic gets an "ask us" note instead of a lineup.

Which models the store actually has is Steve's call, never inferred. Staff mark it at
**`/admin/carry/`**: *On our showroom floor*, *We carry it*, *Not carried* or unmarked
(`catalog_models.carry_status`, with who set it and when). Floor and carried models get a badge
and list first; *Not carried* takes a model off the public site; unmarked models show as part of
the lineup. Discontinued models and ones the maker doesn't sell in the US never show.
`brain:load` never overwrites a mark.

**The product pages list the models too.** `LINEUP_TYPES` in `src/app/[...slug]/page.tsx` maps
each product page to the catalog types it shows (Wood Stoves → wood stoves; Pellet Stoves →
pellet stoves and inserts; Electric Fireplaces → electric fireplaces and inserts…). Each brand's
models sit under its card, with a jump strip of maker logos above. A brand's models fold after
ten, and brands with models but no card on the page get one built from their other pages. The
content route is `force-dynamic` for this; without the database a page renders its copy without
the models. Cook Stoves & Refrigerators is left out: it's Heartland ranges, not the catalog's
wood cook stove.

**Navigation:** Brands is a top-nav item with a logo panel (`BrandsMenu` in `MegaMenu.tsx`), and
the mobile drawer has a Brands group.

**The guides wear the site's theme.** `/guides/<id>/` serves the brain's guide page through
`themeGuide()` (`src/lib/guide-theme.ts`): site fonts, `public/styles/guide-theme.css` after the
guide's own styles, favicon, title, and the badge linking home. The brain's files are never
edited; see HANDOFF for what the theme depends on.

## Site search

One search behind every box: the home page hero (type or talk), the header button, the mobile
drawer and `/search/`. It all goes through `POST /api/search` or the same function. Phase 1 has
no AI.

- **Names:** names and model numbers are generated from the catalog, the brand list and
  `src/content/search-terms.ts`. Typos, plain letters ("jotul") and unfinished names
  ("bellin") are handled.
- **Answers:** these come from `catalog_guide_sections` and `catalog_manual_pages`, which
  `brain:load` builds from the guides. Each one cites the manual page. Clearance, venting and gas
  sections are linked, never quoted.
- **Safety screen:** gas smells, CO alarms, chimney fires and smoke get a fixed message first.
- **Tests:** run `npm run dev`, then `npm run test:search`. They're generated from the brain and
  checked against the marks in docs/smart-search-plan.md.

The rules the search keeps are in [CLAUDE.md](CLAUDE.md). The plan and the results are in
[docs/smart-search-plan.md](docs/smart-search-plan.md).

`src/content/brands.ts` is also where brand names are spelled: the mega-menu brand lines and
the "See the … lineup" links on product pages resolve the pages' older spellings through it.

**The visualizer's products are the catalog's models** (Ben, 13 Oct: the 200 real models
replace the old placeholder rows). The loader keeps `products` in step: one row per model
(`products.catalog_model_id`), named "Brand Model". It updates the name, type, brand and
maker link on every run. It never touches what staff own: the cutout, whether it's live, and
the summary and sizes once set. Discontinued models start hidden. A product whose model leaves
the catalog is hidden, never deleted, so saved designs keep working. Sizes come from the
catalog only for freestanding stoves that publish a width (56 of the 83); staff enter the rest
with the cutout. For inserts and fireplaces the catalog gives the unit or framing width, not
the visible front, so staff enter that too.
Moving everything to Replit: [docs/replit.md](docs/replit.md).

## Data model

`users` → `login_tokens`, `sessions` — magic-link auth; only token *hashes* are stored.
`brands` → `products` — the hearth inventory the stove visualizer draws from: one row per
catalog model (`catalog_model_id`), kept in step by `npm run brain:load`.
`brands` → `stone_products` — the veneer catalogue.
`catalog_brands` → `catalog_models` → photos, documents and guides (`catalog_*`) — the
manufacturer catalog, loaded from `brain/` by `npm run brain:load`.
`room_photos` → `designs` / `veneer_designs` → `design_enquiries` — customer work, all scoped
by `user_id`. The two tools save into separate tables for now; `/d/[slug]` resolves either, so
links a customer has already sent keep working when the editors eventually merge.

Access rules, all enforced server-side:

- Room photos are **never** served from `/public`. `/api/photos/[id]` allows the owner,
  staff, and anyone holding the design's unguessable share slug. Everyone else gets 404 —
  not 403, which would confirm the photo exists.
- Every design read and write is scoped by `user_id` in the SQL itself.
- `/admin` 404s for non-staff rather than advertising itself.

## Deploying

```bash
npm run build
npm run start:live
```

`start:live` is the published site's run command. It brings the tables up to date, starts the
site on port 3014, then loads the brands, the stone profiles (first time only), the
manufacturer catalog and Hearth Studio's cutouts. With Postgres those data steps run in the background once the site
answers, because Replit marks an app live as soon as its homepage responds. Every step is safe
to repeat. `npm start` starts the site without the database steps.

Required environment (see `.env.example`):

| Variable | Needed | Notes |
| --- | --- | --- |
| `SITE_URL` | Yes | Sign-in links are built from this. Deliberately **not** taken from request headers — a forged Host header would otherwise mint links pointing at an attacker's domain. |
| `DATABASE_URL` | Yes | Without it the app runs PGlite against local disk (on Replit it refuses to start instead). |
| `SMTP_URL`, `MAIL_FROM` | Yes | Without `SMTP_URL`, sign-in emails go to the console and **nobody can sign in**. |
| `FILE_STORE` | On Replit, automatic | `replit` keeps every file in App Storage (the default on Replit); `local` uses the folders below (the default elsewhere). |
| `UPLOAD_DIR` | Recommended with `local` | Point at a persistent volume; defaults to `var/uploads` inside the app directory. |
| `BRAIN_ASSETS_DIR` | With `local` | The catalog's photos and PDFs; defaults to `var/brain-assets`. |

`var/uploads` holds customer photos and must be on persistent, backed-up storage —
it is not reconstructible. With `FILE_STORE=replit` they live in App Storage instead.

On Replit, follow [docs/replit.md](docs/replit.md): database, App Storage, loading the
catalog, and publishing.

## Still to do

- **Product photography.** All 200 products (the catalog's models) need transparent cutouts
  before the visualizer shows the real unit. Inserts and fireplaces need their visible width,
  and 27 freestanding stoves need a width (their makers publish none). Staff upload both at
  `/admin`.
- **Stone swatches.** The 10 seeded Cultured Stone profiles all render a generic placeholder
  tile, labelled as a sample. Each needs a seamlessly tiling photograph of the real product and
  the real area that image covers, uploaded at `/admin/stone`.
- **The rest of the stone catalogue.** Cultured Stone publishes 21+ textures and 100+ colours;
  only the profile families are seeded, with no colour variants, and coverage figures are
  typical rather than published. All of it wants confirming against the current catalogue.
- **Merging the two tools.** A customer doing a full fireplace currently mocks the facing and
  the insert separately and cannot see them together. `veneer_designs` becomes a layer type on
  `designs` when that happens.

### Rebrand loose ends

The name, logo and all on-site copy are done. These sit outside the codebase or need a
decision:

The logo is the round badge (`public/images/logo-badge.png`, 19 Oct 2026), which replaced the
cast nameplate in the header, footer, JSON-LD, share image and favicon. Its sizes are set in
`globals.css` (`.header-logo`, `.footer-logo`). The showroom-card plates are still styled after
the nameplate and work as plain black plates.

`scripts/logo-resize-tagline.mjs` belongs to the earlier pencil-sketch mark, which is not
currently in use — its pixel bounds are measured against that artwork and mean nothing for
the round badge.

| Item | State |
| --- | --- |
| Favicon / apple-touch icon | **Done (19 Oct).** `src/app/icon.ico` and `apple-icon.png` are the round badge's stove-and-flame glyph. |
| Domain (`SITE_URL`) | Still `stoveworksinc.com`. Unchanged deliberately; the site lives there and the links work. |
| Email address | Still `stoveworksstorefront@gmail.com`. Renaming a business does not rename its mailbox. |
| Google Business Profile | The map embed on the footer and contact page shows "Stove Works & Fireplace Center" — that is Google's listing data and has to be changed in the Business Profile, not here. |
| Home-page sign photo | **Closed.** Nothing on the site uses `stove-works-sign.jpg` (the old sign) any more; the file is still in `public/images/`. |
| Legal entity | Copy uses "Hayward Stoveworks" throughout, including the copyright line. If the registered entity is still "The Stove Works, Inc.", the footer and JSON-LD may want the legal name alongside the trading name. |
- **Design enquiries.** The `design_enquiries` table exists and is wired into the schema, but
  there is no UI yet for a customer to send a design to Steve or for staff to work the queue.

## Notes on the phase-1 migration

- **URLs end in a slash**, as they did on WordPress (`/services/`). `trailingSlash: true` is set
  in `next.config.ts`; the redirect from the slashless form is done in `src/proxy.ts` for pages
  only, so `/api/` and `/auth/` calls don't take a 308 hop. Write every internal link with the
  trailing slash, because `<Link>` does not add it.
- Pages renamed per `docs/seo-plan.md` (8 Oct 2026) 301 from their old URLs (`redirects()` in
  `next.config.ts`): `specialty-hearth/*` → `hearth-accessories/*`, `/outdoor/`,
  `/cook-stoves/`, `/sauna-stoves/` + `/wood-fired-hot-tubs/` (split), and `facings` →
  `fireplace-walls-mantels` (it was `stonework-mantels` from 8 to 19 Oct, and that URL
  redirects too). The old WordPress hello-world post returns 410.
- Two pages the old nav never linked (cook stoves and the hot tub / sauna page, since split
  into sauna stoves and hot tubs) are in the Shop menu's "Hearth, sauna & outdoor" column.
- The old Stoves page linked to `/stoves/gas/` and `/stoves/wood/`, which 404'd. Fixed.
- Cook Stoves & Refrigerators is image-only on the live site and remains thin here.
