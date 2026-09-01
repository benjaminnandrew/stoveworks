# Stove Works

Next.js rebuild of [stoveworksinc.com](https://stoveworksinc.com) — The Stove Works, Inc., Hayward WI.

Phase 1 replicates every page of the live WordPress site on a modern, server-rendered
stack. Customer accounts and the internal tooling come later.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router, TypeScript | Server components, no client framework tax |
| Rendering | Static prerender at build, served by the Node server | Fast, cacheable; ready for dynamic routes when accounts land |
| Styling | Plain CSS + custom properties (`src/app/globals.css`) | No build-time CSS framework; tokens mirror the old The7 theme |
| Fonts | `next/font` (Merriweather, Noto Sans, Open Sans) | Self-hosted, no third-party requests |
| Output | `output: "standalone"` | Self-contained bundle for the reserved VM |

## Running it

```bash
npm install
npm run dev        # http://localhost:3014
npm run build
npm start
```

Other scripts: `npm run typecheck`, `npm run lint`.

## Layout

```
src/
  app/
    layout.tsx              site chrome, metadata, LocalBusiness JSON-LD
    page.tsx                home
    [...slug]/page.tsx      every content page, from src/content/pages.ts
    contact-us/page.tsx     hand-built: structured address, hours, map
    sitemap.ts, robots.ts
    globals.css             design tokens + all component styles
  components/               SiteHeader, MobileNav, SiteFooter, PageSections, Gallery, ToTop
  content/
    site.ts                 business info (NAP), nav tree, associations
    pages.ts                page copy, mirrored from WordPress
    home.ts                 home page blocks
    types.ts                the Section union that PageSections renders
public/images/              61 images pulled from the old site
_source/                    scrape + parser used to build content/ (not shipped)
```

## Editing content

Copy lives in `src/content/`. Editing `pages.ts` is how page text and brand
blurbs change — no CMS yet. Business details (address, phone, hours) live in one
place, `site.ts`, and feed the header, footer, contact page and JSON-LD.

A page is a list of sections. The section kinds are in `types.ts`:
`prose`, `prose-aside`, `brand`, `media-grid`, `embed`.

## Deploying

Build, then run the standalone server behind a reverse proxy:

```bash
npm run build
SITE_URL=https://stoveworksinc.com node .next/standalone/server.js
```

Copy `public/` and `.next/static/` next to `.next/standalone/` — Next does not
bundle them. Set `SITE_URL` so canonicals, the sitemap and JSON-LD use the real
origin.

## Notes on the migration

- Legacy trailing-slash URLs (`/services/`) 308-redirect to the clean path, so
  existing links and search rankings carry over.
- Two pages exist that the old nav never linked — Refrigerators & Cook Stoves and
  Hot Tubs / Sauna Stoves. Both are now in the Specialty Hearth menu.
- The old Stoves page linked to `/stoves/gas/` and `/stoves/wood/`, which 404'd.
  They now point at the real Gas Stoves and Wood Stoves pages.
- Refrigerators & Cook Stoves is image-only on the live site and remains thin
  here; it wants copy.
