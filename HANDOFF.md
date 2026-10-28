# Hayward Stoveworks — handoff

Written 2026-10-02, at the end of the build sessions of 1–3 September 2026.
Repo: `~/Projects/stoveworks`. Dev preview: **port 3014**.

This is the "pick it up cold" document. [README.md](README.md) is the reference manual —
stack, how to run it, how each tool works, the data model. This file is what the README
can't tell you: what state things are actually in, which decisions were made and why, and
what will bite you.

---

## Where it stands

As first written: four phases, ten commits, working tree clean, `tsc` and `next build` both
passing with zero warnings. Everything since 8 Oct is uncommitted on the checked-out branch,
`redesign-up-north` (it and `main` both point at `1c7f29a`): the redesign, the 12–13 Oct
catalog and Replit work, and the 19 Oct changes below. **No git remote** — this has never
been pushed anywhere.

| Phase | What | State |
| --- | --- | --- |
| 1 | Rebuild all 22 live pages on Next.js | Done |
| 2 | Customer accounts, product inventory, room visualizer | Done |
| 3 | Stone veneer mock-up studio + material estimating | Done |
| 4 | Hayward Stoveworks rebrand — name, logo, type, colour | Done |

Nothing is deployed. Nothing is live. The old WordPress site is still what the public sees
at stoveworksinc.com.

**12–13 Oct 2026 (uncommitted when delivered):** the manufacturer catalog now loads into the
database (`npm run brain:load` → the `catalog_*` tables), guides are served at
`/guides/<id>/` and the makers' photos and PDFs at `/files/…`, and every file the site keeps
can live in Replit App Storage. The visualizer's products are now the catalog's 200 real
models; the placeholder rows are gone. The move to Replit is written up in
[docs/replit.md](docs/replit.md).

**28 Oct 2026 (uncommitted): the logo, front and centre.** Steve wanted the logo front and centre
on the home page; Ben chose these from mock-ups.
- **Hero badge:** the round badge sits straight (Ben: "straight rather than turned") over the point
  where the three collage prints meet, tying them together. Markup is in `src/app/page.tsx`
  (`HERO_BADGE`), styles in the collage block of `globals.css`.
  - The storefront print's caption is right-aligned so its words clear the badge. On narrower
    desktops (901–1279px) the badge sits a little lower and smaller, and that caption a size
    smaller. Measured clear from 950px to 2560px; at 901px it just grazes the first letter.
  - On phones and tablets (≤900px) the collage sits below the copy, so a second copy of the badge
    floats right of the headline instead (Ben's call), 96–140px wide.
  - It adds no height: the first screen still ends exactly at the hours strip (checked at
    1440×900, 1366×768, 1280×720).
- **One logo at a time:** on the home page the header's logo is hidden while the hero badge is on
  screen, and fades in once most of the badge has scrolled under the header (`logoAway` in
  `SiteHeader.tsx`). Other pages always show it.
- **Header logo:** the stove and "Hayward Stoveworks" side by side (Ben: "this works"), cut from the
  badge's own artwork, so no new lettering was drawn: `public/images/logo-lockup.png`, 563×134.
  - **How it was made:** cropped from `logo-badge.png` (stove 232,55–389,305; wordmark
    39,315–582,429). White was turned transparent, with solid ink at min channel ≤60 and paper at
    ≥232; the stove was scaled to 134px tall, the wordmark to 98px, with a 24px gap.
  - **Sizes:** 52px tall on desktop (Ben asked for it smaller than the first 62px). Between 993
    and 1259px the round badge stands in, because the lockup would wrap "Cabin Decor". Phones
    show it at up to 160px wide.
  - **Steve hasn't seen it.** It's a new form of his logo.
  - The footer, JSON-LD and share image still use the round badge.

**27 Oct 2026 (uncommitted): the Services page, and an owner guide hub.**

- **Services** (`/services/`) is rebuilt from Ben's service-page handoff (Steve's answers, the
  brand list, Jøtul's manuals, NFPA 211). Use its copy as written.
  - **Files:** the copy is in `src/content/services.ts`; `src/app/services/page.tsx` renders it.
    `servicePage` in the same file stands in for the old `pages.ts` entry, so the search, the
    sitemap and the page list still see the page and its words.
  - **Layout:** hero with "Call to book" (`tel:`), then the sections, with the Book service box
    and the "If you smell gas" callout beside them (first, on a phone). Yearly service links to
    `#chimneys`, Repairs and one answer to `#gas-smell`.
  - **Jump bar** (`src/components/JumpBar.tsx`; Ben: "sticky on desktop… on mobile, a little
    hamburger menu"): under the title, it sticks below the header and underlines the section
    you're in. On a phone it's one "On this page" button that opens the list. Short labels come
    from `nav` in services.ts. The guide hub uses it for its brands.
  - **Ben's wording change:** Book early ends "usually booked out many weeks", not the
    handoff's "about three weeks out".
  - **Common questions** are accordions, marked up as FAQPage.
  - **The brand list** is `brands` from `src/content/brands.ts`, which already has Majestic.
  - **Never publish:** prices; that Stoveworks sometimes services its brands bought elsewhere;
    emergency or no-heat calls, either way; shopping material (sizing, install cost, financing,
    installing it yourself). The gas-smell steps are the manufacturer's, word for word.
  - **Title** "Stove & Fireplace Service & Repair" (it was "…Installation"; the page now leads
    with service).
  - **Left out:** the handoff's "WORKS · Service" eyebrow. The site has no WORKS half, and
    the breadcrumb already says Services.
- **Header and nav (Ben, 27 Oct):**
  - **Services is now a menu**, like Visualize: "Service & installation" (`/services/`) and
    "Manuals" (`/guides/`), from `servicesMenu` in `src/content/site.ts`.
  - **Top bar:** "My account" is now **My designs** (it only holds saved visualizer and stone
    designs), with **Manuals** beside it. Both are in the phone drawer and the footer too.
  - **Logo:** the round badge was being squeezed on ~1000–1100px screens (the global
    `img { max-width: 100% }` let the grid shrink it). It now has `max-width: none`, and the
    nav tightens a step more between 993 and 1100px.
  - **Jump bar colour:** pine with light text and a gold underline, so it stands apart from the
    birch header once it sticks (Ben: "hard to see"). "If you smell gas" is an oxblood button at
    its end.
- **Manuals hub** (`/guides/`, `src/app/guides/page.tsx`; titled "Manuals & guides" to match
  the nav): every guide for a model the site
  lists, by brand and type (169 today). Linked from the Services menu, the top bar, the phone
  drawer, the footer and the Services page.
  - **Owner mode:** each "owner's manual" or "owner guide" mention on Services (Ben: link "the
    customer manual option") goes to `/guides/?for=owner`. From there each model opens on its
    homeowner side, using the guides' own `#homeowner` deep link, so there's no homeowner or
    installer choice to make. Plain `/guides/` leaves that choice in place.

**22 Oct 2026 (uncommitted): model pages, save and compare.**

- **Model pages** (Ben: "basic details for Stoveworks and the customer. Then a link to the
  manufacturer's page").
  - **Where:** every model in the public lineup (190 of the 200) has a page at
    `/brands/<brand>/<model>/`.
  - **What's on it:**
    - photos, the maker's short description, and a few facts (heats, efficiency with its basis,
      burn time, firebox, logs, size, weight, blower);
    - Save and Compare, and "See it in your room";
    - Ask about it, call, the owner & installer guide, and "Full specs on <maker>'s site".
  - **What isn't:** no installation values; they stay in the guide.
  - **Files:**
    - `src/app/brands/[slug]/[model]/page.tsx` (the route);
    - `src/lib/model-view.ts` (facts, title, description), `src/lib/model-page.ts` (loader,
      metadata, JSON-LD), `src/lib/model-url.ts` (addresses);
    - `src/components/ModelDetail.tsx` (the body).
- **Opened from a list, a model shows as a pop-up.**
  - **Behaviour:**
    - The address is the model's page.
    - Arrows step through the list underneath.
    - Escape, ✕, a click outside or Back returns to the list where it was scrolled.
    - A refresh or a shared link shows the full page.
  - **How:** Next's intercepting routes: `src/app/@modal/(.)brands/[slug]/[model]/page.tsx`
    plus `src/components/ModelModal.tsx`.
  - **Traps:**
    - The slot's catch-all must be named `[...slug]` like the site's, or the dev server won't
      start ("different slug names for the same dynamic path").
    - After adding a slot, restart the dev server; it doesn't pick one up live.
- **SEO.**
  - **Titles** follow `{Brand} {Model} {Type} | Hayward Stoveworks`. They step down to fit 59
    characters, and don't repeat a type the name already says.
  - **Descriptions** are built from the facts. All 190 were checked: titles run 44–59
    characters, no duplicates. Descriptions run 115–155; six are under 125 because the maker
    gives no heating figures.
  - **Product and BreadcrumbList JSON-LD** (no offers: no prices), canonical, and the maker's
    photo as the share image.
  - **Sitemap:** all model pages are in it.
  - **Departures from `docs/seo-plan.md`:** model pages for every public model rather than
    floor units only, and under `/brands/` rather than the category, because the pop-up needs a
    route of its own. The plan is updated to match.
- **Save and compare** (Ben: "a 5 compare set up", like the Woodland site's).
  - **Buttons:** Save (heart) and Compare are on every model card and model page. Both lists
    live in the visitor's browser (no email, no account) and stay in step across tabs.
  - **The compare tray** along the bottom shows "N of 5 picked", the five slots, Clear and
    Compare. It refuses a sixth with a note.
  - **`/compare/?ids=…`** (noindex):
    - columns with photos;
    - "The basics" (makers' figures; efficiency always with its basis and a like-with-like
      hint);
    - "At Hayward Stoveworks" (showroom, guide, maker's page);
    - "Hide rows that match", Share, Print or save as PDF, Save all;
    - two at a time on a phone;
    - "Ask about these" (an email listing the models).
  - **`/saved/`** (noindex) lists saved models, with Compare and Ask about these. The header has
    a heart with the count.
  - **Files:** `src/lib/shortlist.ts` (the store), `ShortlistButtons.tsx`, `CompareTray.tsx`,
    `CompareView.tsx`, `SavedList.tsx`, `src/lib/compare.ts` (the rows).
  - **Open:** saving to an account across devices, and whether saved lists reach Steve.
- **The home page gallery moved** (Ben: "that section is a little awkward"). It repeated nine
  photos already shown higher up the page, so each photo now sits on the page it belongs to, as
  a `{ "type": "photos" }` section: prints in loose columns, each enlarging in the site's lightbox
  with its description as the caption.
  - **Home & Cabin Decor:** "Around the store", the decor shots (lamps, signs, shelves, the cabin
    corner) plus its two original photos.
  - **Fireplace Walls & Mantels:** "In our showroom", the five stone fireplaces with log mantels.
  - **Hearth Accessories:** the accessories wall.
  - **The home page now ends with the cabin-decor band.** Its button leads to the full set. The
    band leaves paper below it so the footer's tree line still shows.
  - **`Gallery.tsx` and its styles are gone.** Captions are descriptive, no longer "showroom photo
    N".
- **Enlarged model photos link to the model** (Ben, 22 Oct).
  - **What it shows:** in the lightbox, the model's name and a "See details →" link go to its
    page. From a list, that opens the model's pop-up, and the photo closes first.
  - **How:** `ModelZoom` sets `data-href`, which `ImageLightbox` reads.
  - **Not on the model's own page:** its photos don't set it, since they would only link to
    themselves.
- **"See it in your room"** opens `/visualizer/?model=<catalog id>` with that model already
  placed (`catalogModelId` on the visualizer's products).
- **Adding or removing a model** is the brain plus `npm run brain:load`; nothing is built per
  model. See [docs/adding-a-model.md](docs/adding-a-model.md).
- **Type:** Trail + serif is now the default for every visitor (`DEFAULT_TYPE` in
  `src/lib/type-review.ts`, `data-type` on `<html>`). The review switcher stays until Ben
  confirms; see the type-review note below.

**20 Oct 2026 (uncommitted): the Big Brain wired into the site.** Ben asked to use the
brain to wire up brands and models. Each brand now has a page, `/brands/<slug>/`, showing
the maker's current US lineup from the catalog. It's worded as the maker's lineup, not our
stock (Ben's call: show it now rather than wait for Steve's marks). There's a `/brands/` hub,
and the lineup cards link to the owner & installer guides. Steve marks what the store actually
has at `/admin/carry/`. `src/content/brands.ts` is the brand list. The README section "Brand
pages and what we carry" has the detail.

Later the same day, after Ben pointed out that the product pages led nowhere and Brands was
only a text link:

- **Product pages list the models.** Wood Stoves, Gas Stoves, Pellet Stoves, Wood and Gas
  Inserts, and Wood, Gas and Electric Fireplaces each show every brand's current models of that
  type under the brand's card. A strip of maker logos at the top jumps to each brand. Past two
  rows a brand's models fold behind "Show all 29 Mendota gas fireplaces". A brand with models of
  that type but no card on the page (e.g. Pacific Energy gas fireplaces) gets a card built from
  its other pages. These pages now render per request (`force-dynamic`) so Steve's marks show at
  once. If the database is down they still render their copy, just without the models.
- **Maker bar (21 Oct, Ben: "make Jump to Maker sticky and see"):** the logo strip stays put.
  Once it scrolls under the header, a slim bar of maker names slides in below the header
  (`src/components/MakerBar.tsx`). It underlines the maker being read and leaves after the last
  maker's block. It uses `--header-h` (97px, or 73px at 992px wide and below); update that if the
  header's height changes. If Ben would rather the full logo strip stuck, it's a CSS change, but
  it's about 110px tall under a 97px header.
- **Brands is a top-nav item** (Shop · Brands · Visualize · Services · Cabin Decor · Visit; Services
  became a menu on 27 Oct). It
  opens a panel of the 14 maker logos, each with the product pages it's on. The mobile drawer
  has a two-column Brands list.
- **Model photos enlarge on click** (21 Oct): every model card's photo opens in one site-wide
  lightbox (`src/components/ImageLightbox.tsx`, mounted in the layout), with arrows through the
  other visible photos on the page. A card marks its photo with `data-enlarge`; nothing else is
  needed.
- **Home page copy restored (21 Oct, Ben noticed it):** the live site's "A History of Service"
  block had been trimmed. Restored in its own words (`src/content/home.ts`):
  - "We are more than just a fireplace store. We have cook stoves, barbeques, manufactured
    stone/brick…", word for word, in the history section after "Today we carry…" (where the live
    site had it), and out of the cabin-decor band;
  - Heartland and "and many more" at the end of the brand list;
  - the staff sentence, now closing the history section.

  Heartland comes from the live site's brand list, not Ben's 19 Oct list of stove brands. Confirm
  with Steve that they still sell it.
- **Nav hover (21 Oct, Ben):** only the words open a menu. The rest of the bar's height under an
  open menu is a bridge that keeps it open on the way down, and never opens or switches one.
  - **Click to close:** a click on Shop, Brands or Visualize while its menu is open puts it away,
    and it stays away until the pointer leaves and comes back.
  - **The exception:** a click within 350ms of the hover opening it counts as meant-to-open.
  - **Menu words are buttons, never links** (Ben: clicking Visualize must not open a page).
    `/brands/` and `/visualizer/` are reached from inside their panels.
- **The home page order (21 Oct, Ben):** hero, "Born in the energy crisis of the 1970s", "See it
  in your own room", "What's on the showroom floor", cabin decor. The gallery moved off it on
  22 Oct.
  - **Backgrounds (22 Oct, Ben):** they alternate pine green and light. History is green, the
    plan band light, the showroom green, and the cabin-decor band light, so the footer's pine
    trees rise into it.
- **Type review in progress (22 Oct, Ben: "not sold … a little AI-ish. Looking for warm,
  northwoodsy, but an established brand selling wood stoves").** Open any page with
  `?type=foundry|nameplate|trail|trail-serif` and a switcher at the bottom flips the whole site; the choice
  sticks page to page in that browser, and "Done" (or `?type=current`) puts it back. Visitors who
  never use `?type=` see the site as it was.
  - **Foundry:** Besley (a Clarendon) headings, Libre Franklin for reading and the shop.
  - **Nameplate:** Roboto Serif, condensed capitals for the big lines like the badge, full width
    for reading, with Libre Franklin for the shop.
  - **Trail sign:** Barlow, condensed capitals.
  - **Trail + serif** (Ben asked for it): Barlow condensed capitals for the big lines and Barlow
    for the shop, with Literata (a book serif) for reading and the smaller headings.
  - **How it works:** headings now have their own font slot, `--font-head` (the reading serif
    unless a direction sets it). The directions are `html[data-type]` blocks at the end of
    `globals.css`, the faces load in `layout.tsx` with `preload: false`, and the rest is
    `src/lib/type-review.ts` and `src/components/TypeSwitcher.tsx`.
  - **Once Ben picks:** fold the winner into `:root`, preload its faces, delete the other faces,
    the switcher, `type-review.ts` and the CSS section. Then re-check that the home page still
    ends at the strip at every size, since the hero's height changes with the face.
- **The hub pages filled out (21 Oct, Ben: Inserts was "basically not much", then "same on each
  of these": Stoves and Fireplaces).** The live site had nothing more to restore, so the rest
  comes from the catalog; Steve's intros are unchanged.
  - **Layout:** each intro now sits beside its photo (`prose-aside`).
  - **"Choose a fuel":** a card per fuel page (Wood, Gas and Pellet stoves; Wood, Gas and
    Electric fireplaces; Wood and Gas inserts), with a model count, four photos
    (taken in turn from each maker, click to enlarge), the makers' logos (each jumps to that
    maker on the page), and "See all 16 wood inserts".
  - **"Also in the makers' lineups"** (Inserts only): the True North pellet insert (on Pellet
    Stoves) and the Kozy Heat electric insert (on Electric Fireplaces).
  - **How it's built:** a `{ "type": "fuels" }` section in `src/content/pages.ts`, rendered by
    `src/components/FuelCards.tsx` and filled by `fuelsFor()` in `src/app/[...slug]/page.tsx`.
    `HUB_FORMS` in `lineup.ts` names the hubs.
  - **For Steve:** his intro still says "We offer inserts in either Gas or Wood", while the
    page now also shows a pellet and an electric insert.
  - **"Will it fit my fireplace?"** (researched 21 Oct, not built): 28 of the 29 inserts have
    the maker's minimum fireplace size, 26 of them from the manuals. The figures, the sources,
    the fireplace-type rules and a proposed design are in
    [docs/insert-fit-plan.md](docs/insert-fit-plan.md).
- **The owner & installer guides are in the site's style** (Ben: they only looked that way
  because he hadn't styled them). See "The guides are themed on the way out" below.

---

**20 Oct 2026 (uncommitted): site search, Phase 1.** Ben supplied a smart-search blueprint
(from the Woodland build) and asked for an obvious type-or-talk search box on the home page.
Built without AI: names, model numbers, typos, name starts, and answers from the owner &
installer guides and manuals with page numbers, plus an emergency screen. All of it is tested
from the brain through the real endpoint, and every pass mark is met. The plan, the results and
what's next are in [docs/smart-search-plan.md](docs/smart-search-plan.md). The search rules are
in [CLAUDE.md](CLAUDE.md).

**21 Oct 2026, the home page's first screen (Ben):**
- **The rule:** on desktop the first screen ends exactly at the hours/address/phone strip. The
  whole strip shows, and nothing of the section below peeks in.
- **How:** `.home-first` wraps the hero and the strip at `min-height: calc(100svh - --first-top)`,
  where `--first-top` is the address bar plus the nav (135px, or 111px at 901–992px wide). The
  hero stretches to fill, and the collage takes the hero's height.
- **Shorter windows:** two height steps (`max-height: 900px` and `760px`) tighten the hero.
- **Layout:** the search box sits below the "What are you working with?" cards. The fuel row only
  takes room once a card is picked.
- **Checked** with the strip on the bottom edge: 1280×720, 1366×768, 1440×900, 1536×740,
  1536×864, 1685×780, 1685×1000, 1920×950, 2560×1300 and 950×800.
- **If you change the hero or the header heights,** update `--first-top` and re-check.

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

**No invented content.** Throughout: the seeded brands are only those the live site actually
names; products are the manufacturer catalog's verified models (they replaced the earlier
placeholder rows on 13 Oct); coverage figures are marked as typical and flagged for
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

### The guides are themed on the way out, so the theme follows the guide template

The guides come from the brain as finished pages with their own placeholder look. The brain is
Ben's, so the site doesn't edit them. Instead `src/lib/guide-theme.ts` changes each one as it's
served from `/guides/<id>/`:

- it swaps the guide's Google Fonts for the site's type (Trail + serif since 22 Oct: Barlow,
  Barlow Condensed for the big lines, Literata for headings);
- it links `public/styles/guide-theme.css` after the guide's own styles;
- it adds the favicon and the store name to the title;
- it puts the badge (`logo-badge-112.png`) in the guide's header, linking home;
- it adds **the installer's search box** at the top of the installer view (22 Oct, Ben: "a really
  obvious and easy to type and talk search box for the installers side").

**The owner's yearly-care card comes first, with a way to book it** (22 Oct, Ben on the Morsø
6143's "Annual check & summer care": "that's something they can call Stoveworks for").
- **What it does:** `public/scripts/guide-owner-service.js` finds the guide's own care card by its
  title and moves it to the front of the owner's "Start here". There it's highlighted in the
  owner side's oxblood, beside a line taken from the Services page: "Hayward Stoveworks services
  stoves, inserts and fireplaces. Call us to set up your yearly check." Call, email and Our
  services follow, and the same box ends that card's detail.
- **How it picks the card,** in order:
  1. annual / yearly / service / inspection;
  2. upkeep / routine / maintenance / checklist;
  3. care of the chimney, combustor, catalyst or season.
  Not glass or cooktop care, which owners do themselves.
- **Coverage:** 138 of 186 guides get the card. The other 48 have no yearly-care card (their care
  is under "Chimney & creosote") and are left as they are, rather than present chimney cleaning
  as a Stoveworks service.
- **The wording** lives in `guide-theme.ts` (`SERVICE_CTA`).
- **It relies on the template's v3 names** (`HOME_PRIMARY`, `HOME_SECONDARY`, `openDrawer`).

**The installer's search box.**
- **What it is:** a large type-or-talk box, above the Specs / Install steps / Faults / Manual
  bar. It's markup from `guide-theme.ts`, wired by `public/scripts/guide-installer-search.js`.
- **What it searches:** what the guide already holds:
  - the hand-written answers (`INDEX`), installer answers first;
  - the full text of every manual page (`PAGES`).

  A result opens the guide's own answer panel (`openDrawer`), or the PDF at that page
  (`openPDF`).
- **How it matches:**
  - words in any order, with plurals, so a spoken question works ("what's the clearance to the
    side wall");
  - spoken filler words ignored;
  - a short table of trade words in the script ("tall" finds height, "stove pipe" finds
    connector, "fan" finds blower, "propane" finds LP);
  - the manual's contents page ranked after real pages.
- **Hints:** the "Try" suggestions are each guide's own manual-search hints.
- **Talk** uses the browser's speech recognition, and hides where there is none (Firefox).
- **It relies on the template's v3 names** (`PAGES`, `INDEX`, `normQ`, `openDrawer`,
  `openPDF`). If a rebuilt template drops them, the box removes itself and the guide's own
  searches carry on, so re-check after a `brain:load` that brings a new template.
- **It's the guides' own search,** the exception to "every search box uses the one endpoint" in
  CLAUDE.md, like the guide's built-in searches.

The sheet re-points the template's tokens (`--iron`, `--ember`, `--pilot`, `--display`…) and
restyles its classes (`.gate`, `.ignite`, `.tile`, `.spec`, `.seclabel`…). That covers template
v3. If Ben renames those classes or tokens in a later template, the guides fall back to their
own look in those places, so re-check a guide after a `brain:load` that brings a new template.
Owner side is oxblood, installer side pine.

### The search: things that will bite

- **The emergency wording is a draft** (`src/lib/search/guard.ts`) until Steve approves it.
- **Rate limits only run in production** (`NODE_ENV=production`). The test suite runs about
  2,500 searches against the dev server.
- **The tests need a running server.** Run `npm run dev`, then `npm run test:search`. They read
  `brain/` directly and post to `/api/search`.
- **The search rows rebuild only when the guides change.** That's the `search` hash in
  `catalog_meta`, so a normal `brain:load` skips the 20 MB of text. To force a rebuild, delete
  that row.
- **Product-type words aren't "held names"** for the safety screen. "I smell gas" must reach the
  screen whole, even though "gas" is a word the search knows. Only brand, model, family and
  series names are set aside before screening.

### `.nav-item` must stay `position: static`

The Shop panel spans the header bar. If `.nav-item` goes back to `position: relative`,
the panel anchors to a single nav item and renders as a narrow column over the hero. The
small Visualize panel is the exception: `.menu-visualize` is `position: relative`, so it sits
under its own item.

---

## What's genuinely unfinished

Ordered by what blocks going live.

### Blockers

1. **SMTP.** Without `SMTP_URL`, sign-in emails print to the server console and **no
   customer can sign in**. Needs a provider — Resend, Postmark, or the business's own SMTP.
2. **Deployment.** Never deployed. The target is a Replit Reserved VM: build with
   `npm run build`, run with `npm run start:live`, which brings the live database up to date
   and then serves on port 3014 (the standalone build was dropped on 13 Oct). Customer photos
   are not reconstructible: on Replit, `FILE_STORE=replit` (the default there) keeps them, the
   cutouts, the swatches and the catalog's files in App Storage. See
   [docs/replit.md](docs/replit.md).
3. **`DATABASE_URL`.** Without it the app runs PGlite against local disk, which on a VM means
   the database lives inside the deploy and vanishes on redeploy. On Replit the app and the
   `db:*` scripts now refuse to start without it.
4. **`SITE_URL`.** Sign-in links are built from it. Deliberately not taken from request
   headers — a forged `Host` would otherwise mint links pointing at an attacker's domain.

### Content the tools need to be truthful

**Logo (19 Oct 2026):** the round badge (`public/images/logo-badge.png`) replaced the cast
nameplate. It sits at 80px inside a 96px header bar (a version hanging below the bar was tried and
dropped as odd; nav text went up to 1.1rem at the same time). It also replaced the nameplate in the header, footer, JSON-LD, share image (`public/images/share-storefront.jpg`) and
favicon/apple icon (the badge's stove-and-flame glyph). That closes the old-favicon loose end. The
showroom-card plates were styled after the nameplate; they still work as plain black plates.

**Installation and service:** Ben confirmed on 19 Oct 2026 that the store installs *and services*
stoves, inserts and fireplaces. **Answered 27 Oct** by the service-page handoff (what service
includes, brands, chimneys, travel radius, lead time); the page is one page at `/services/`, not
the SEO brief's sub-pages. See the 27 Oct note at the top.

**Stoll Industries wall panels** (steel and aluminum shiplap facings; stollindustries.com/walls/)
were added to Stonework & Mantels on 19 Oct 2026 at Ben's request, shown as a text wordmark until
there's a logo. The page was then renamed **Fireplace Walls & Mantels**, at
`/fireplace-walls-mantels/`; `/facings/` and `/stonework-mantels/` 301 there.

**Brands sold (Ben, 19 Oct 2026):** Kozy Heat, Mendota, Kuma, Blaze King, Morsø, Jøtul,
Pacific Energy, HearthStone, True North, Renaissance, RSF, Town & Country, Wilkening. Enviro
and Thelin are no longer sold and were removed from the pages. True North (Pacific Energy's
economy line) was added to Wood Stoves, Wood Inserts and Gas Stoves. **Its logo** (21 Oct,
`public/images/true-north.png`) was rebuilt from the vector artwork in True North's own 2026
brochure (`31900010-TN-Wood-2026-06-Web.pdf`), because their website only has 214px and 142px
copies. It's the compass in blue and TRUE NORTH in red, as printed. **Majestic stays** (Ben, 19 Oct): it isn't on the list above or in the
brain, but they still sell it, on Electric Fireplaces, Gas Inserts and Wood Fireplaces.
**Pellet: not sold (Ben, 26 Oct 2026: "Stoveworks does not do pellet stoves").** The Pellet
Stoves page added on 19 Oct is gone, and `/stoves/pellet-stoves/` now 301s to `/stoves/`.
- **One rule:** `NOT_SOLD_FUELS` in `src/content/lineup.ts` keeps pellet models (True North's
  TN40 stove and insert) out of every list: the public lineup and brand counts, the model pages,
  compare, the sitemap and the visualizer.
- **Search:**
  - "pellet stove" is answered "We don't sell pellet stoves", with a call-us line.
  - A pellet model asked for by name is found, marked "not carried here".
- **Copy:** the Stoves page, the Shop menu, the home chooser, the home intro and the site
  description no longer mention pellet.
- **Left on purpose:**
  - the pellet models' owner & installer guides (`/guides/…`), for anyone who owns one;
  - the maker's own hearth-pad copy on Hearth Accessories ("for your free-standing gas, wood,
    pellet…").

5. **Product cutouts.** All 200 products render a category silhouette, badged "Photo
   coming". Each needs a transparent PNG shot square-on. Width is what the visualizer scales
   from: the catalog gives it for 56 of the 83 freestanding stoves. Staff enter it for the
   other 27 (10 Blaze King, 7 HearthStone, 6 Pacific Energy, 4 True North) and the visible
   width of inserts and fireplaces. Cutouts and widths both go in at `/admin`.
6. **Stone swatches.** All 10 Cultured Stone profiles render a generic tile labelled
   "sample image". Each needs a **seamlessly tiling** photograph plus the real area one tile
   covers. Staff upload at `/admin/stone`.
7. **Real model names.** Done 13 Oct: the visualizer's products are now the catalog's 200
   verified models, kept in step by `npm run brain:load` (Ben's call: they replace the old
   placeholder rows). Which models Stoveworks carries (`carry_status`) is Steve's to mark at
   `/admin/carry/` (built 20 Oct), and nothing waits on it: unmarked models show on the brand
   pages as part of the maker's lineup. Marking floor models is the single most useful thing
   Steve can do there: they get a badge and list first.
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
    on `designs` when that happens. Room Studio, on the `room-studio` branch, does this; it
    isn't merged yet.

**Compare and favorites: built 22 Oct** (Ben: "options to save, compare (… a 5 compare set up), link
to visualizer tool"). See the 22 Oct note near the top. Still open: whether saved models should
also follow a signed-in customer between devices, and whether they reach Steve the way a design
enquiry would.

### Rebrand loose ends

11. **Favicon: done (19 Oct).** `src/app/icon.ico` and `apple-icon.png` are now the round
    badge's stove-and-flame glyph (see the 19 Oct logo note above).
12. **Domain** is still `stoveworksinc.com`. Unchanged deliberately; links work.
13. **Email** is still `stoveworksstorefront@gmail.com`. Renaming a business doesn't rename
    its mailbox.
14. **Google Business Profile** still reads "Stove Works & Fireplace Center" — visible in
    the map embed on the footer and contact page. Has to change in the Business Profile.
15. **Home-page sign photo: closed.** Nothing on the site uses `stove-works-sign.jpg` (the
    old sign) any more; the file is still in `public/images/`.
16. **Legal entity.** Copy says "Hayward Stoveworks" throughout including the copyright
    line. If the registered entity is still "The Stove Works, Inc.", the footer and JSON-LD
    may want the legal name alongside the trading name.

### Smaller things I'd flag

17. **Highlight colour: done.** The redesign replaced the neon `#fedf32` with `--gold`,
    `#e0b64a`, the value suggested here; `--highlight` is now only an alias for it.
18. **Brand name spellings: mostly done (20 Oct).** The brand-card headings now use one
    spelling each (Kozy Heat, Jøtul, Morsø, HearthStone, Town & Country), from
    `src/content/brands.ts`. The makers' own body copy and the logo alt text still say
    "Jotul" and "Morso"; that's their text, so it was left alone.
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

**12 Oct, the catalog, routes and file store:** `brain:load` was run on PGlite and on a real
PostgreSQL 16 (fresh load, re-run with no changes, a changed model, a removed model and guide,
staff `carry_status` kept, a staff-marked model kept as retired when it left the brain and
restored when it came back, `--dry-run` writing nothing, and a load finishing while a site
write held a lock on `sessions`). The routes passed 50 checks with local files (PDF bytes and
byte ranges, HEAD, 404s, path tricks, room photos still private and still uploading) and 16
against a stand-in App Storage client, which also showed file serving recovering after a failed
storage start. An independent review found three problems, all fixed and re-tested (staff marks
lost when a model left the brain; a load locking the site's tables; a failed App Storage start
needing a restart). **Not tested:** a real Replit App Storage bucket, a real Replit deployment.

**20 Oct, brand pages and carry admin:** every `/brands/<slug>/` returns 200 and an unknown
slug 404s; the sitemap lists all 15 brand URLs. `/admin/carry/` redirects signed-out visitors
to sign-in. Signed in as a local test admin, marking Ashford 30.2 *On our showroom floor* moved
it to the top of the Blaze King page with its badge and changed the notice. Marking Boxer 24
*Not carried* took it off the page. Both marks were then cleared, so all 200 models are
unmarked again. `tsc` and `next build` pass.

**20 Oct, product-page lineups, Brands menu, guide theme:** all 15 content pages checked
return 200 and unknown paths 404. Gas Fireplaces folds Mendota (29), Kozy Heat (19) and
Town & Country (11), and adds a Pacific Energy card. Six nav items fit at 1000px. The drawer's
Brands list doesn't overflow at 375px. A guide was checked at desktop and phone width: landing,
owner side, installer side and detail drawer. `tsc` and `next build` pass.

---

## Orientation for whoever's next

Read [README.md](README.md) first — it has the stack table, the run instructions, and
sections on how each tool works internally.

Getting running from cold:

```bash
cd ~/Projects/stoveworks
npm install
npm run db:migrate && npm run db:seed && npm run db:seed:stone
npm run brain:load                           # the manufacturer catalog + guides
npm run db:grant -- you@example.com admin   # so /admin opens
npm run dev                                  # http://localhost:3014
```

Then request a sign-in link at `/sign-in` and copy the URL out of the **terminal** — in dev
the email prints to the console.

Where things live:

- `src/content/` — all copy and business info. `site.ts` is the single source for the
  business name, nav and NAP; change it there and the header, footer, titles, emails and
  JSON-LD all follow. `brands.ts` is the list of brands sold, with one spelling each.
- `src/lib/` — db, auth, storage, file-store (local folders or App Storage), catalog
  (queries on the brain's tables), products, designs, stone, veneer, and `homography.ts`
  (the projective maths both visual tools share).
- `db/schema.sql` — the site's tables; `db/catalog.sql` — the catalog's. Both idempotent.
- `_source/` — the original scrape and the parser that generated `pages.ts`. Not shipped.
- `docs/type-scheme.md` — the three-face type scheme as supplied.
- `brain/` — Ben's in-progress company-brain knowledge base (verified brand and model
  catalogue, manuals, guides). It's the source the brand, model and guide pages should build
  from. Ben owns it, so read from it but don't edit it. **It is never public:** no `/brain`
  route, nothing under `public/`. It's the base layer that compare tools, the visualizer and
  installation guides are built from. `npm run brain:load` copies it into the `catalog_*`
  tables; what's public is only what's built for customers: the guide pages (`/guides/<id>/`)
  and the makers' own photos and PDFs (`/files/…`).
- `docs/seo-plan.md` — SEO and AI-search guidelines for URLs, keywords, content and schema
  (Ben, 8 Oct 2026), with a gap analysis against the build. Work from it and test against
  it, and push back where it doesn't fit.

One script is a trap and is labelled as such: `scripts/logo-resize-tagline.mjs` belongs to
the **earlier pencil-sketch logo**, which is no longer in use. Its hardcoded pixel bounds
mean nothing for the current round badge.
