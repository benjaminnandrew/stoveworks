# Hayward Stoveworks — handoff

Written 2026-10-02, at the end of the build sessions of 1–3 September 2026.
Repo: `~/Projects/stoveworks`. Dev preview: **port 3014**.

This is the "pick it up cold" document. [README.md](README.md) is the reference manual —
stack, how to run it, how each tool works, the data model. This file is what the README
can't tell you: what state things are actually in, which decisions were made and why, and
what will bite you.

---

## Where it stands

Four phases, ten commits, working tree clean, `tsc` and `next build` both pass with zero
warnings. **No git remote** — this has never been pushed anywhere.

| Phase | What | State |
| --- | --- | --- |
| 1 | Rebuild all 22 live pages on Next.js | Done |
| 2 | Customer accounts, product inventory, room visualizer | Done |
| 3 | Stone veneer mock-up studio + material estimating | Done |
| 4 | Hayward Stoveworks rebrand — name, logo, type, colour | Done |

Nothing is deployed. Nothing is live. The old WordPress site is still what the public sees
at stoveworksinc.com.

---

## The engagement, for context

Ben's contact at the business is **Steve**. The website is explicitly **step one of a
larger "company brain" engagement** — so the architecture was chosen to leave room for
internal tooling, not just a brochure site. That's why there's a real database, real auth
and a staff admin area behind a marketing site that could have been static.

The business **rebranded from "The Stove Works, Inc." to "Hayward Stoveworks"** during the
build (confirmed by Ben on 3 Sep). Everything on the site reflects that. Things outside the
site do not — see Loose ends.

---

## Decisions Ben made, and why they matter

These were asked and answered explicitly. Don't quietly reverse them.

**Visualizer = cutout compositing, not AI inpainting.** For a dealer, a customer has to see
the actual SKU they'd buy. A generative model producing "a stove that looks a bit like a
Jotul" is worse than useless — it's misleading. This is why the tool needs real product
photography to be truthful, and why it says so on screen until it has it.

**Auth = magic links, passwordless.** No passwords to forget, no third-party dependency,
less support burden for Steve's staff. The consequence is hard: **without SMTP configured,
nobody can sign in at all.** That's the single biggest go-live blocker.

**Database = Postgres.** Dev runs PGlite (Postgres compiled to WASM) so nothing needs
installing. See the PGlite warning below — it is not a toy, but it is single-process and it
has already lost a write.

**Veneer tool = separate route now, merge later.** `/visualizer` and `/veneer` are separate
editors with separate tables. `/d/[slug]` already resolves either kind, so share links
customers have sent will survive the eventual merge.

**Stone swatches = staff upload, not scraped.** I deliberately did **not** scrape Cultured
Stone's product photography into the repo. Whether the dealer agreement covers marketing
assets is Ben's call to confirm, not mine to assume. Generated placeholder tiles ship
instead, labelled as samples everywhere they appear.

**No invented content.** Throughout: the seeded catalogue uses only brands the live site
actually names; product rows are honest placeholders at the "we carry Jotul gas stoves"
level rather than invented SKUs; coverage figures are marked as typical and flagged for
confirmation. If you add content, hold this line — it's a real business's real claims.

---

## Things that will bite you

### PGlite is single-process, and it has already lost a write

The `db:*` scripts detect a running dev server and refuse, which is the guard rail. Heed it
rather than reaching for `--force`.

More seriously: **a committed write did not survive the dev server being killed.** During
phase 2 I uploaded a product cutout through `/admin` and renamed the row to "Jotul F 500
Oslo" with a 27.5″ width. The uploaded file is still on disk at
`public/products/jotul-wood-stoves-c35535a7.png`, but the database row has lost the name,
the width and the `cutout_path`. PGlite hadn't flushed before the process ended.

Treat local dev data as disposable. This is a dev-only hazard — set `DATABASE_URL` and `pg`
takes over with none of it.

### Body copy is serif now, so `font: inherit` means something different

The type scheme puts Source Serif 4 on `body`. Any UI control using `font: inherit` now
inherits the **serif**, which the scheme explicitly forbids for nav, buttons and forms.
Every control currently sets `font-family: var(--font-sans)` explicitly. Keep doing that
when adding components.

### The image optimizer caches by source path

Swapping the logo file without changing its filename serves the stale image. Clear `.next`
and restart. This cost me a confused ten minutes; it'll cost you the same.

### Every internal link needs its trailing slash

Page URLs end in `/` to match the old WordPress URLs exactly (8 Oct 2026). Next's own slash
redirect is off (`skipTrailingSlashRedirect`) and `src/proxy.ts` adds the slash for pages
only, so API calls don't take a 308 hop. `<Link href="/visualizer">` still works, but it costs
a redirect and crawlers see the slashless URL, so write `/visualizer/`. Don't add slashes to
`/api/...` or `/auth/...`. Watch out for `NextURL`: `request.nextUrl.clone()` drops a slash you
add to `pathname`, which made the proxy loop until it was switched to a plain `URL`.

### `.nav-item` must stay `position: static`

The mega menu panel spans the nav bar. If `.nav-item` goes back to `position: relative`,
the panel anchors to a single nav item and renders as a narrow column over the hero.

---

## What's genuinely unfinished

Ordered by what blocks going live.

### Blockers

1. **SMTP.** Without `SMTP_URL`, sign-in emails print to the server console and **no
   customer can sign in**. Needs a provider — Resend, Postmark, or the business's own SMTP.
2. **Deployment.** Built for `output: "standalone"` on a reserved VM, but never deployed.
   `public/` and `.next/static/` must be copied next to `.next/standalone/` — Next doesn't
   bundle them. `var/uploads` holds customer photos and must be on persistent, backed-up
   storage; it is not reconstructible.
3. **`DATABASE_URL`.** Without it the app silently runs PGlite against local disk, which on
   a VM means the database lives inside the deploy and vanishes on redeploy.
4. **`SITE_URL`.** Sign-in links are built from it. Deliberately not taken from request
   headers — a forged `Host` would otherwise mint links pointing at an attacker's domain.

### Content the tools need to be truthful

5. **Product cutouts.** All 42 catalogue rows render a category silhouette, badged "Photo
   coming". Each needs a transparent PNG shot square-on, plus a real width in inches —
   width is what the visualizer scales from. Staff upload both at `/admin`.
6. **Stone swatches.** All 10 Cultured Stone profiles render a generic tile labelled
   "sample image". Each needs a **seamlessly tiling** photograph plus the real area one tile
   covers. Staff upload at `/admin/stone`.
7. **Real model names.** The 42 rows are placeholders derived from what the site says. They
   want replacing with actual SKUs.
8. **The rest of the stone catalogue.** Cultured Stone publishes 21+ textures and 100+
   colours; only profile families are seeded, with no colour variants, and coverage figures
   are typical rather than published.

### Features designed but not built

9. **Design enquiries.** The `design_enquiries` table exists and is indexed, but there's no
   UI for a customer to send a design to Steve or for staff to work the queue. This is the
   natural next piece and was deliberately left for a decision: email, an inbox in `/admin`,
   or both.
10. **Merging the two visual tools.** A customer doing a full fireplace mocks the facing and
    the insert separately and can't see them together. `veneer_designs` becomes a layer type
    on `designs` when that happens.

### Rebrand loose ends

11. **Favicon is still the old brand's.** `src/app/icon.ico` and `apple-icon.png` came from
    the previous site. Browser tabs show the old mark. A new one needs a glyph isolated from
    the nameplate — a design call, not a crop.
12. **Domain** is still `stoveworksinc.com`. Unchanged deliberately; links work.
13. **Email** is still `stoveworksstorefront@gmail.com`. Renaming a business doesn't rename
    its mailbox.
14. **Google Business Profile** still reads "Stove Works & Fireplace Center" — visible in
    the map embed on the footer and contact page. Has to change in the Business Profile.
15. **Home-page sign photo** (`stove-works-sign.jpg`) shows the **old** physical sign. Wants
    reshooting.
16. **Legal entity.** Copy says "Hayward Stoveworks" throughout including the copyright
    line. If the registered entity is still "The Stove Works, Inc.", the footer and JSON-LD
    may want the legal name alongside the trading name.

### Smaller things I'd flag

17. **The highlight yellow (`#fedf32`) is now conspicuous.** It was picked against the old
    bright red; against oxblood it reads neon. It's used for nav hover/active, the dark-band
    headings, the gallery scrollbar and the veneer editor's corner handles. Something like
    `#e0b64a` would sit better. One-token change; left alone because Ben only asked about
    the red.
18. **Brand name spellings vary across pages** — "KozyHeat" vs "Kozy Heat", "Morsø" vs
    "Morso", "Hearthstone" vs "HearthStone". `src/content/nav-data.ts` normalises them for
    the mega menus, but the page bodies still show the originals. Worth a content pass.
19. **Refrigerators & Cook Stoves** is image-only, as on the live site. It wants copy.
20. **No contact form.** The old site only had a `mailto:`, and that behaviour was kept. A
    real form is a natural early add now there's a server.

---

## Verification already done

So you don't redo it, and so you know what wasn't checked.

**Access control, tested with a second real signed-in customer** (not by reading the code):
reading another customer's room photo → 404; overwriting their design → 403; deleting it →
404; reaching `/admin` as a customer → 404; reusing a sign-in link → expired. Share links
work signed-out, and a veneer slug does **not** unlock an unrelated photo.

**A real bug was found and fixed this way:** a shared veneer mock-up couldn't load its own
room photo, because `/api/photos/[id]` only resolved *stove* share slugs. An outside viewer
would have seen stone floating on a broken image.

**The homography** has 8 unit checks, including that equal real-world steps shrink
monotonically as they recede — the actual proof the perspective is right, not just that
corners land. Editor and export were confirmed to compute identical values (3 tiles across
× 6 down for a 72″×96″ area with a 24″×16″ swatch).

**The material estimate** was checked by hand: 72″×96″ → 48 sq ft; top and left edges as
outside corners → 14 lin ft, which is (72+96)÷12.

**Mega menu keyboard access** was verified with real key presses after synthetic events
proved unreliable — tab opens, tab again enters the panel, Escape closes, closed panels are
`inert`.

**Not tested:** anything on real Postgres, anything with real SMTP, any touch device, any
browser other than the Chromium in the preview pane, and any load beyond one user.

---

## Orientation for whoever's next

Read [README.md](README.md) first — it has the stack table, the run instructions, and
sections on how each tool works internally.

Getting running from cold:

```bash
cd ~/Projects/stoveworks
npm install
npm run db:migrate && npm run db:seed && npm run db:seed:stone
npm run db:grant -- you@example.com admin   # so /admin opens
npm run dev                                  # http://localhost:3014
```

Then request a sign-in link at `/sign-in` and copy the URL out of the **terminal** — in dev
the email prints to the console.

Where things live:

- `src/content/` — all copy and business info. `site.ts` is the single source for the
  business name, nav and NAP; change it there and the header, footer, titles, emails and
  JSON-LD all follow.
- `src/lib/` — db, auth, storage, products, designs, stone, veneer, and `homography.ts`
  (the projective maths both visual tools share).
- `db/schema.sql` — all ten tables, idempotent.
- `_source/` — the original scrape and the parser that generated `pages.ts`. Not shipped.
- `docs/type-scheme.md` — the three-face type scheme as supplied.
- `brain/` — Ben's in-progress company-brain knowledge base (verified brand and model
  catalogue, manuals, guides). It's the source the brand, model and guide pages should build
  from. Ben owns it, so read from it but don't edit it. **It is never public:** no `/brain`
  route, nothing under `public/`. It's the base layer that compare tools, the visualizer and
  installation guides are built from.
- `docs/seo-plan.md` — SEO and AI-search guidelines for URLs, keywords, content and schema
  (Ben, 8 Oct 2026), with a gap analysis against the build. Work from it and test against
  it, and push back where it doesn't fit.

One script is a trap and is labelled as such: `scripts/logo-resize-tagline.mjs` belongs to
the **earlier pencil-sketch logo**, which is no longer in use. Its hardcoded pixel bounds
mean nothing for the current nameplate.
