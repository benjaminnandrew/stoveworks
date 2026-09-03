# Hayward Stoveworks

Next.js rebuild of [stoveworksinc.com](https://stoveworksinc.com) — Hayward Stoveworks, Hayward WI.

The business rebranded from "The Stove Works, Inc." to **Hayward Stoveworks** during the
rebuild. The display name lives in one place, `business.name` in `src/content/site.ts`, and
flows from there into the header, footer, page titles, sign-in emails and JSON-LD.

**Phase 1** replicated every page of the live WordPress site on a modern, server-rendered stack.
**Phase 2** added customer accounts, a product inventory, and a room visualizer.
**Phase 3** added a stone veneer mock-up studio with material estimating.
**Phase 4** applied the Hayward Stoveworks rebrand — name, logo and type scheme.

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
| Output | `output: "standalone"` | Self-contained bundle for the reserved VM |

## Running it

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed        # hearth brands + catalogue
npm run db:seed:stone  # Cultured Stone profiles
npm run dev            # http://localhost:3014
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`,
`npm run db:reset`, `npm run db:seed:stone`, `npm run db:grant <email> [role]`,
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
db/schema.sql               all ten tables, idempotent
scripts/                    migrate, seed, seed-stone, reset, grant, tile + logo tooling
src/
  app/
    layout.tsx              chrome, metadata, LocalBusiness JSON-LD
    page.tsx                home
    [...slug]/page.tsx      every marketing page, from src/content/pages.ts
    contact-us/             hand-built: structured address, hours, map
    visualizer/             the stove tool — public, works signed out
    veneer/                 the stone veneer tool — public, works signed out
    sign-in/, auth/verify/  magic-link request and redemption
    account/                saved designs and mock-ups, profile, both editors
    admin/                  staff inventory: products, cutouts, dimensions
    admin/stone/            staff catalogue: profiles, swatches, coverage
    d/[slug]/               read-only shared design
    api/photos              upload + serve private room photos
    api/designs, api/veneer-designs   persist each tool's work
  components/visualizer/    Visualizer, ProductPicker, DesignPreview, export, stash
  components/veneer/        VeneerStudio, StoneRegion, StonePicker, EstimatePanel, export
  content/                  site.ts (business info + nav), pages.ts, home.ts
  lib/                      db, auth, storage, products, designs, stone, veneer,
                            homography (the projective maths both tools share)
public/products/            product cutouts + category placeholder silhouettes
public/stone/               stone swatches + generated placeholder tiles
var/                        pgdata + uploads (gitignored)
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

The customer drags four corners onto the wall face. Those corners define a **homography** —
a projective map from a rectangle onto that quadrilateral — and the stone texture is pushed
through it, so courses converge with the wall instead of sitting flat on top of it. The
solver is in `src/lib/homography.ts` and has one job, which means the live editor and the
PNG export cannot disagree:

- **On screen**, the matrix goes to CSS `matrix3d`. The browser rasterises it on the GPU, so
  dragging a corner stays smooth and the texture stays sharp.
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

## Colour

Tokens at the top of `globals.css`. The accent is **oxblood `#96382c`** — warmer and far less
bright than the `#d63d45` inherited from the old WordPress theme, and it takes white-on-accent
contrast from 4.55:1 (only just AA) to 7.24:1 (AAA), which matters because the nav bar is white
text on a solid accent fill.

| Token | Value | Used for |
| --- | --- | --- |
| `--accent` | `#96382c` | Top bar and nav fill, page titles, buttons, links, focus rings |
| `--accent-dark` | `#7b2d23` | Hover on accent-filled controls |
| `--danger` | `#8a2318` | Destructive actions only — deliberately distinct now the accent is itself a red |
| `--accent-wash` | `#f9ece8` | Error panel fill |
| `--accent-wash-soft` | `#faf3f0` | Card hover fill |
| `--highlight` | `#fedf32` | Nav hover/active, the dark-band headings, editor handles |

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

## Data model

`users` → `login_tokens`, `sessions` — magic-link auth; only token *hashes* are stored.
`brands` → `products` — the hearth inventory the stove visualizer draws from.
`brands` → `stone_products` — the veneer catalogue.
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
SITE_URL=https://stoveworksinc.com DATABASE_URL=... SMTP_URL=... \
  node .next/standalone/server.js
```

Copy `public/` and `.next/static/` next to `.next/standalone/` — Next does not bundle them.

Required environment (see `.env.example`):

| Variable | Needed | Notes |
| --- | --- | --- |
| `SITE_URL` | Yes | Sign-in links are built from this. Deliberately **not** taken from request headers — a forged Host header would otherwise mint links pointing at an attacker's domain. |
| `DATABASE_URL` | Yes | Without it the app silently runs PGlite against local disk. |
| `SMTP_URL`, `MAIL_FROM` | Yes | Without `SMTP_URL`, sign-in emails go to the console and **nobody can sign in**. |
| `UPLOAD_DIR` | Recommended | Point at a persistent volume; defaults to `var/uploads` inside the app directory. |

`var/uploads` holds customer photos and must be on persistent, backed-up storage —
it is not reconstructible.

## Still to do

- **Product photography.** All 42 catalog rows need transparent cutouts and real widths
  before the visualizer is truthful. Staff upload both at `/admin`.
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

The masthead logo is pinned to 88px so it matches the business-hours block beside it. Both
are fixed pixel heights — a viewport-relative logo size would only line up at one window
width. `scripts/logo-resize-tagline.mjs` regenerates the asset with the "Since 1975" tagline
scaled (currently 1.45x): it lifts the tagline off the artwork, inpaints the hole so the
pencil-sketch flames survive, and composites it back larger on the same centre. Scaling the
existing glyphs rather than re-typesetting keeps the letterforms exactly as drawn.

| Item | State |
| --- | --- |
| Favicon / apple-touch icon | **Still the old brand's.** `src/app/icon.ico` and `apple-icon.png` came from the previous site. A new one needs the fireplace glyph isolated from the wordmark — a design call, not a crop. |
| Domain (`SITE_URL`) | Still `stoveworksinc.com`. Unchanged deliberately; the site lives there and the links work. |
| Email address | Still `stoveworksstorefront@gmail.com`. Renaming a business does not rename its mailbox. |
| Google Business Profile | The map embed on the footer and contact page shows "Stove Works & Fireplace Center" — that is Google's listing data and has to be changed in the Business Profile, not here. |
| Home-page sign photo | `stove-works-sign.jpg` is a real photo of the **old** sign outside the store. Wants reshooting once the new sign is up. |
| Legal entity | Copy uses "Hayward Stoveworks" throughout, including the copyright line. If the registered entity is still "The Stove Works, Inc.", the footer and JSON-LD may want the legal name alongside the trading name. |
- **Real model names.** The seeded rows are honest placeholders at the "we carry Jotul gas
  stoves" level, taken from what the site already says. They want replacing with actual SKUs.
- **Design enquiries.** The `design_enquiries` table exists and is wired into the schema, but
  there is no UI yet for a customer to send a design to Steve or for staff to work the queue.

## Notes on the phase-1 migration

- Legacy trailing-slash URLs (`/services/`) 308-redirect to the clean path.
- Two pages the old nav never linked — Refrigerators & Cook Stoves, Hot Tubs / Sauna Stoves —
  are now in the Specialty Hearth menu.
- The old Stoves page linked to `/stoves/gas/` and `/stoves/wood/`, which 404'd. Fixed.
- Refrigerators & Cook Stoves is image-only on the live site and remains thin here.
