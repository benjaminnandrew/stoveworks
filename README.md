# Hayward Stoveworks

Next.js rebuild of [stoveworksinc.com](https://stoveworksinc.com) — Hayward Stoveworks, Hayward WI.

The business rebranded from "The Stove Works, Inc." to **Hayward Stoveworks** during the
rebuild. The display name lives in one place, `business.name` in `src/content/site.ts`, and
flows from there into the header, footer, page titles, sign-in emails and JSON-LD.

**Phase 1** replicated every page of the live WordPress site on a modern, server-rendered stack.
**Phase 2** added customer accounts, a product inventory, and a room visualizer.
**Phase 3** added a stone veneer mock-up studio with material estimating.
**Phase 4** applied the Hayward Stoveworks rebrand — name, logo and type scheme.
**Phase 5** merged the two visual tools into **Room Studio**: stove and stone in one photo,
with an A/B comparison, a sample room to start on, and a shop mode for the showroom.

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
`npm run stone:tiles` (regenerates the placeholder stone textures),
`node scripts/make-seamless-tile.mjs <photo> <out.jpg> --width-in N` (turns a stone photo
into a seamless swatch — see [docs/stone-swatches.md](docs/stone-swatches.md)), and
`npx tsx scripts/check-studio.ts` (Room Studio's rule checks; `npx` fetches tsx on first run).

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
db/schema.sql               all ten tables, idempotent (incl. the Room Studio migration)
scripts/                    migrate, seed, seed-stone, reset, grant, tile + logo tooling
src/
  app/
    layout.tsx              chrome, metadata, LocalBusiness JSON-LD
    (src/proxy.ts)          trailing-slash redirect, pages only
    page.tsx                home
    [...slug]/page.tsx      every marketing page, from src/content/pages.ts
    contact-us/             hand-built: structured address, hours, map
    visualizer/             Room Studio — stove and stone; public, works signed out
                            (/veneer/ redirects here, opening on the stone)
    sign-in/, auth/verify/  magic-link request and redemption
    account/                saved designs, profile, the studio for a saved design
    admin/                  staff inventory: products, cutouts, dimensions
    admin/stone/            staff catalogue: profiles, swatches, coverage
    d/[slug]/               read-only shared design
    api/photos              upload + serve private room photos
    api/designs             persist a design (products, stone, comparison)
  components/studio/        RoomStudio (the editor), Scene (draws one view), Controls,
                            StoneRegion, ProductPicker, StonePicker, EstimatePanel,
                            ScenePreview (share page), export, stash
  content/                  site.ts (business info + nav), pages.ts, home.ts
  lib/                      db, auth, storage, products, designs, stone,
                            studio (editing rules), sample-room, design-types,
                            veneer-types (stone areas + estimate), homography
public/products/            product cutouts + category placeholder silhouettes
public/stone/               stone swatches + generated placeholder tiles
public/visualizer/          the sample room picture
var/                        pgdata + uploads (gitignored)
_source/                    the scrape and parser that generated content/
```

## How Room Studio works

`/visualizer/` is one editor for the whole hearth. It opens on an **illustrated sample cabin**
(the approved prototype's room) with a stove on the hearth pad and stone behind it, so there is
something to try before anyone has a photo to hand. "Upload your room" swaps in the customer's
own photo and carries their choices across.

Each view is drawn in the order a hearth is built (`components/studio/Scene.tsx`):

1. the room photo;
2. **stone areas** on the wall — the veneer mechanics below;
3. **"in front" shapes**: parts of the photo re-painted over the stone, so the stone reads as
   behind them. The sample room has hand-set shapes for its sofa, lamp, window and floor
   (`lib/sample-room.ts`); customer photos have none yet — drawing them is on the list;
4. **products** — transparent cutouts anchored at their bottom centre, hearth pads first so a
   stove always stands on its pad.

Tapping a product or the stone selects it and switches the side panel to its layer (Stove /
Stone). Stone is dragged by its surface — hit-testing is done in `lib/studio.ts`, and a tap in
an opening falls through to the room — and shaped by its four corners, which refuse to fold or
collapse. Keyboard: arrow keys move the selection (Shift for bigger steps), `+`/`-` and `[`/`]`
size and turn a product, arrow keys on a focused corner move that corner, Escape deselects.

With a product selected, tapping a model in the picker **swaps** it (keeping the position and
the ratio of real widths); with nothing selected it **adds** one. The picker says which.

**Compare** adds view B beside A. Placement is linked — one stove position, one stone shape —
and only the choices differ: B can carry a different product on each item and a different
stone, or the bare wall, on each area. Its sizes follow its own products' real widths. Saved
with the design and shown as Option A / Option B on the share page; "Download A and B" exports
them side by side.

**Shop mode** is for a shared screen in the showroom: bigger controls, remembered on that
device, no saving to accounts, and "New customer" clears everything — the design, any stashed
work, and any signed-in account.

### One scale for both layers

The customer drags a line across something they know the size of — a door is 80″ tall, 32″
wide — and enters it. From then on every product is sized from its real width in the database
and the panel reports what they're looking at ("28″ wide in the room"). The same scale reads
the **stone areas' real sizes off the photo**, which sets the size of the stone courses and the
material estimate. A size the customer types in wins over the one read off the photo; typing
one side keeps the other in proportion with the shape until it's typed too.

Before any scale is set, sizes are read off a rough guess (a room photo shows about ten feet top
to bottom — `GUESSED_PHOTO_HEIGHT_IN`), which keeps stove and stone in believable proportion.
Everything derived from it is labelled as a guess, in the editor, the estimate and the share
page. The sample room's scale is set by hand: its wall is taken as 8 ft.

### Stone areas

Veneer is a *surface*, not an object. Four corners on the wall define a **homography** — a
projective map from a rectangle onto that quadrilateral — and the stone texture is pushed
through it, so courses converge with the wall instead of sitting flat on top of it. The solver
is in `src/lib/homography.ts`:

- **On screen**, the matrix goes to CSS `matrix3d`. The browser rasterises it on the GPU, so
  dragging stays smooth and the texture stays sharp.
- **On export**, the same matrix drives a triangle mesh on a 2D canvas (a 2D context can only
  do affine transforms, so the quad is subdivided until the error is sub-pixel). Triangles are
  grown a hair before clipping, or antialiasing leaves a grid of seams across the wall.

Each swatch declares the real area one tile covers, so courses come out the right size.
"Accent panel" and "Full wall" give starting shapes. **Openings** — a firebox, a mantel, a
window — are punched with a CSS mask on screen and `destination-out` on export, both applied
*before* the warp, so a hole rides the perspective and the room shows through it.

### The material estimate

From each area's size: gross area, minus openings, minus the flat area that outside-corner
pieces will cover (the usual half a square foot per linear foot), plus a 10% cutting allowance,
divided by the per-box coverage on each profile where there is one (natural thin veneer like
Buechel's is sold by the pallet, so it gets square footage only). It is a starting point for a
quote and the UI says so — including whether the sizes were entered, read off the scale, or
guessed.

### Products without photography

Any product with no `cutout_path` renders a category silhouette from `public/products/`,
badged "Photo coming" in the picker, with a notice on the page. The tool is usable from day
one and never pretends a placeholder is the real unit.

### Saving, signing in, sharing

Photos are downscaled in the browser before they leave it, then re-encoded server-side by sharp
— which drops the GPS coordinates phones attach. A design saves products, stone areas, "in
front" shapes and the comparison together (`designs` table). Every position is a percentage
of the photo, so the editor, a thumbnail and a full-resolution export all agree.

Signing in mid-design keeps the work. "Sign in to save" stashes the design (and a small copy of
the photo) in `localStorage` under a one-time id, and the emailed sign-in link brings that id
back (`/sign-in/?next=…` → link → `/auth/verify` → `/visualizer/?resume=<id>`). It has to be
`localStorage`: the link opens in a new tab. The stash is only restored by the matching id —
never for whoever uses the device next — is cleared once restored, and expires after two
hours. `safeNextPath` (`lib/site-url.ts`) only lets sign-in return to `/visualizer/…` or
`/account/…`.

`/d/[slug]` is the read-only share page. Mock-ups saved by the old veneer tool were copied into
`designs` under their original ids and slugs, so old edit and share links still work.

## Navigation

The five top-level items with children open **mega menus** — a full-width panel under the nav
bar rather than a narrow dropdown.

The substance is the manufacturers carried on each child page ("Wood Stoves — Pacific Energy ·
HearthStone · Jotul · Blaze King · Thelin · Morso · Kuma"). Those are **derived from the page
content itself** in `src/content/nav-data.ts`, not kept in a second list — a hand-maintained
copy would drift from the pages the moment anyone edited one. It is computed at module load
from the same static `pages.ts` the pages render from, so there is no database call and the
marketing pages stay statically prerendered.

Behaviour worth knowing:

- Hover opens, with a short close delay so crossing the gap to the panel does not snap it shut.
- Keyboard: tabbing onto a parent opens its panel, tabbing continues into it, Escape closes.
  `onFocus`/`onBlur` rather than the capture variants — React maps those to `focusin`/`focusout`,
  which bubble from the links inside.
- Closed panels are `inert`, so the tab order does not run through every hidden menu.
- `.nav-item` is `position: static` on purpose: the panel's containing block has to be the nav
  bar for it to span the full width.
- The footer strip is dropped when a menu's parent page is also one of its children — that is
  the Visualizer, where "All Visualizer" would be meaningless.
- Below 992px the mega menus are hidden entirely; the mobile drawer takes over.

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
`brands` → `products` — the hearth inventory Room Studio draws from.
`brands` → `stone_products` — the stone catalogue (Cultured Stone profiles, the Buechel sample).
`room_photos` → `designs` → `design_enquiries` — customer work, all scoped by `user_id`. A
design holds `items` (products), `regions` (stone areas), `occluders` ("in front" shapes),
`compare` (view B's choices, or null) and `pct_per_inch` (the scale, or null).
`veneer_designs` is the old veneer tool's table: its rows were copied into `designs` and
stamped `migrated_at`, and it can be dropped once the merge has shipped.

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
  before Room Studio is truthful. Staff upload both at `/admin`. The Brain's catalogue
  (`brain/data/models.json`) already has a product photo *and* real dimensions for 104 current
  models — the quickest route to real stoves (see HANDOFF).
- **Stone swatches.** The 10 seeded Cultured Stone profiles all render a generic placeholder
  tile, labelled as a sample. Each needs a seamlessly tiling photograph of the real product and
  the real area that image covers, uploaded at `/admin/stone`.
- **The rest of the stone catalogue.** Cultured Stone publishes 21+ textures and 100+ colours;
  only the profile families are seeded, with no colour variants, and coverage figures are
  typical rather than published. All of it wants confirming against the current catalogue.
- **"In front" shapes on customers' own photos.** The mechanism exists (the sample room uses
  it); customers need a way to draw them, so a sofa or mantel isn't covered by stone.
- **The Buechel sample.** Product name, profile and real size are unconfirmed; the swatch size
  is an estimate (docs/stone-swatches.md).

### Rebrand loose ends

The name, logo and all on-site copy are done. These sit outside the codebase or need a
decision:

The logo is the cast nameplate — a solid dark plate with reversed type, which sits equally
well on the white masthead and the grey footer.

The masthead logo is pinned to 88px so it matches the business-hours block beside it. Both are
fixed pixel heights: a viewport-relative logo size would only line up at one window width. The
plate is 2.27:1, so that lands at 200px wide. The footer copy is width-driven instead
(`max-width: 220px`) because a height-driven plate overflows its column in the four-column
footer grid on narrower screens.

`scripts/logo-resize-tagline.mjs` belongs to the earlier pencil-sketch mark, which is not
currently in use — its pixel bounds are measured against that artwork and mean nothing for
the nameplate.

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

- **URLs end in a slash**, as they did on WordPress (`/services/`). `trailingSlash: true` is set
  in `next.config.ts`; the redirect from the slashless form is done in `src/proxy.ts` for pages
  only, so `/api/` and `/auth/` calls don't take a 308 hop. Write every internal link with the
  trailing slash, because `<Link>` does not add it.
- Pages renamed per `docs/seo-plan.md` (8 Oct 2026) 301 from their old URLs (`redirects()` in
  `next.config.ts`): `specialty-hearth/*` → `hearth-accessories/*`, `/outdoor/`,
  `/cook-stoves/`, `/sauna-stoves/` + `/wood-fired-hot-tubs/` (split), and `facings` →
  `stonework-mantels`. The old WordPress hello-world post returns 410.
- Two pages the old nav never linked (cook stoves and the hot tub / sauna page) are in the
  Specialty Hearth menu.
- The old Stoves page linked to `/stoves/gas/` and `/stoves/wood/`, which 404'd. Fixed.
- Cook Stoves & Refrigerators is image-only on the live site and remains thin here.
