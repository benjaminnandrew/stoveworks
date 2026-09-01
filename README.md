# Stove Works

Next.js rebuild of [stoveworksinc.com](https://stoveworksinc.com) — The Stove Works, Inc., Hayward WI.

**Phase 1** replicated every page of the live WordPress site on a modern, server-rendered stack.
**Phase 2** added customer accounts, a product inventory, and a room visualizer.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router, TypeScript | Server components, no client framework tax |
| Marketing pages | Prerendered at build | Fast and cacheable; the app routes stay dynamic |
| Styling | Plain CSS + custom properties | `globals.css` = marketing, `app.css` = signed-in surface |
| Fonts | `next/font` (Merriweather, Noto Sans, Open Sans) | Self-hosted, no third-party requests |
| Database | Postgres | PGlite in dev so nothing needs installing |
| Auth | Magic links, own sessions | No passwords to forget, no third-party dependency |
| Images | `sharp` | Re-encodes uploads, which also strips EXIF/GPS |
| Output | `output: "standalone"` | Self-contained bundle for the reserved VM |

## Running it

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev        # http://localhost:3014
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`,
`npm run db:reset`, `npm run db:grant <email> [role]`.

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
db/schema.sql               all eight tables, idempotent
scripts/                    migrate, seed, reset, grant  (plain node, no Next)
src/
  app/
    layout.tsx              chrome, metadata, LocalBusiness JSON-LD
    page.tsx                home
    [...slug]/page.tsx      every marketing page, from src/content/pages.ts
    contact-us/             hand-built: structured address, hours, map
    visualizer/             the tool — public, works signed out
    sign-in/, auth/verify/  magic-link request and redemption
    account/                saved designs, profile, design editor
    admin/                  staff inventory: products, cutouts, dimensions
    d/[slug]/               read-only shared design
    api/photos, api/designs upload + serve photos, persist designs
  components/visualizer/    Visualizer, ProductPicker, DesignPreview, export, stash
  content/                  site.ts (business info + nav), pages.ts, home.ts
  lib/                      db, auth, storage, products, designs, design-types
public/products/            product cutouts + category placeholder silhouettes
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

## Data model

`users` → `login_tokens`, `sessions` — magic-link auth; only token *hashes* are stored.
`brands` → `products` — the inventory the visualizer draws from.
`room_photos` → `designs` → `design_enquiries` — customer work, all scoped by `user_id`.

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
