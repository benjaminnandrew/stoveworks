# Stoveworks — Product Guide Build Spec (v3, Oct 12, 2026)

*v3 replaces the June build spec. Guides are no longer cloned one HTML file at a time: every guide is
built from one shared template plus a small content file, by a script, and checked automatically.
All 186 guides in the brain (plus 13 set aside with models not sold in the US) use this.*

**Where everything lives (Ben's laptop, `~/Projects/stoveworks/brain/`):**
`guides/template/guide-template.html` (the page), `guides/content/<id>.json` (one per guide),
`guides/<id>.html` (built pages), `guides/tools/` (`GUIDE_SPEC.md`, `build_guide.py`,
`check_numbers.py`, `find_in_manual.py`, `qa-guide.js`, `verify_batch.py`), and the plan
`build/guide_plan.json`. The manuals are in `var/brain-assets/documents/<brand>/`.

**To add a guide for a new model:** put its newest US manual in `var/brain-assets/documents/<brand>/`,
add the model to the catalog and the guide plan, then ask Claude to write the content file following
`guides/tools/GUIDE_SPEC.md` and run the checks. `GUIDE_SPEC.md` is the detailed writer's spec; this
document is the overview.

---

## 1. What the guide is

One self-contained `.html` page per manual set (models that share a manual share a guide; a model
sold in versions with their own manuals gets one guide per version). It solves the problem that one
PDF forces two very different audiences through each other's content, so it **splits by intent at
the front door**:

- An **ignition gate**: the visitor picks *"I own it"* or *"I install it."*
- **Homeowner path**: action tiles for what people actually ask (light it, use the remote, decode a
  sound, clean the glass…). Each opens a drawer with plain-language steps.
- **Installer path**: tappable spec cards, the install sequence, fault panels and any codes.
- **Full-text search** across every page of the manual: curated answers first, then page hits that
  **open the PDF at the exact page** (`#page=N`).
- Every drawer ends with a link to its page in the official manual, which stays the legal source of
  truth.

**Phones and tablets (Oct 8):** a slim one-row header that tucks away on scroll, an installer
section bar (Specs · Install steps · Faults · Codes · Manual) that stays pinned and shows where you
are, 44 px tap targets, a back-to-top button, and search results right under the header.

---

## 2. The three layers

1. **Template** (`guides/template/guide-template.html`): page shell, CSS, search, drawers,
   navigation. Shared by every guide. Change it once, rebuild all.
2. **Content** (`guides/content/<id>.json`): everything model-specific (headings, tiles, spec cards,
   steps, faults, codes, drawer text, page references, search extras) plus a `review` block that
   isn't shown on the page.
3. **Build** (`guides/tools/build_guide.py <id>` or `--all`): validates the content file, merges it
   into the template with the manual's page text (for search), and writes `guides/<id>.html`.

Style tokens (colors, fonts) still live in the template's `:root`, so the whole set can be re-themed
in one place when the site's visual identity is final.

---

## 3. The content file (summary; full contract in `GUIDE_SPEC.md`)

- `shell`: brand mark, title (brand + the catalog's model name, 30 characters or fewer), model line,
  certification, search hints.
- `home_primary` / `home_secondary`: 4 "Start here" and 4–6 "Good to know" owner tiles, each with a
  matching `detail` drawer.
- `specs`: 5–8 installer cards (`rows` of label/value exactly as printed, a `tap` that opens a
  drawer).
- `steps`: 6–10 install steps in the manual's order (step drawers are generated).
- `faults`: up to 4 symptom → cause panels, only from the manual's own troubleshooting content.
- `codes`: only when the manual publishes a code table.
- `detail`: drawer bodies. Building blocks: `<p>`, `<h4>`, lists, `<b>`, key/value rows,
  `<div class="note">` (a tip, or a "Note:" reporting two figures), `<div class="note small">` (a
  corrected misprint or the maker's website figure) and `<div class="note danger">` (a warning the
  manual itself gives).
- `pageref`: the physical PDF page for every tile, card and step (no link beats a wrong link).
- `review`: `conflicts` (each classed), `catalog_mismatches` (website vs manual), `notes`.

---

## 4. The rules

1. **Only the manual** for the guide's facts, numbers, procedures and warnings; nothing from general
   knowledge or another model. Numbers exactly as printed, with units.
2. **Report everything; correct only plain misprints (Ben, Oct 12).** We report what the maker
   prints and posts, and more information is better. Never drop a figure.
   - **The manual disagrees with itself** and doesn't settle it: show both in an amber note written
     for the reader, e.g. *"Note: p. 24 suggests window cleaner or a commercial stove glass cleaner,
     then says to use only a cleaner made specifically for woodstoves."* These notes are for our
     people and customers, never a to-do list for us: no "Confirm…" boxes.
   - **A plain misprint** (a metric figure that doesn't match its inch figure, a part number the
     parts list settles, a typo the manual's other pages settle): show the correct figure with a
     small note saying what was printed where. The correct figure must be one the maker prints.
   - **Not really a conflict** (a recommended and a maximum length, two numbering systems such as
     an OEM number and the maker's part number): word it so both read clearly.
   - Procedures, clearances, venting, gas pressures, electrical ratings, burn instructions and
     warranty terms are never treated as misprints unless the manual itself settles it beyond doubt.
3. **The maker's website differs from the manual:** the guide keeps the manual's figure, so it
   matches the page the link opens, and a small "Maker's website:" note gives the website's figure
   right beside it. For installation-safety values the note ends "Install to the manual." Where
   the manual gives a figure only in a drawing (lettered clearances) and the website prints
   numbers, the note goes where the guide points to the drawing and ends "Install to the clearance
   diagrams in the manual." A figure from a maker's brochure is labelled "Maker's brochure:".
   (The catalog leads with the website's figure and lists the manual's; both are always shown.)
4. **Log length** where a website's single "max" is really the manual's ideal length (True North):
   show both, recommended and maximum (Ben, Oct 9).
5. **Don't reconstruct what the text can't show** (diagrams, check-mark tables): link the page and
   say it's shown as a diagram.
6. **Get the ignition right** for the exact configuration (standing pilot, IPI, CPI, millivolt…).
7. **Plain language for owners**; terse and technical for installers.
8. **Safety statements keep their force (Oct 12 spot-check).** Wording may be shortened, but never
   an instruction, a "never", an "immediately", a "stop", a limit or a consequence. Every step of
   the gas-smell block, the lighting label's retry limits and waits, the turn-off steps, the
   gas-control and under-water warnings, over-firing warnings, the full do-not-burn list (wet,
   green and unseasoned wood included, with its consequence) and any stop-using condition stays.
   A short summary elsewhere (a fault line, a search hint) keeps the stop condition too.
9. **Figures printed in two units that don't match** are shown as printed with a short note, unless
   another page settles it; a safety value is never "corrected" unless the manual settles it.

Every page ends with the same small print, explaining that manuals sometimes disagree with
themselves or with the maker's website, that we show both, that plain misprints are corrected with
a note, and that the official manual is the authority for installation.

---

## 5. Category differences

The structure is shared; the content changes by category:

- **Spec cards**: gas (input BTU, inlet/manifold pressure, venting, clearances, framing or insert
  cavity, conversion kit); wood (firebox, log length, emissions and efficiency, flue, clearances,
  floor protection, weight, outside air); pellet (output, hopper, electrical, pellet vent,
  clearances); electric (volts/amps/watts, heat output, circuit, rough-in).
- **Faults**: gas pressure or pilot/ignition pairs; wood draft/smoke vs over-firing; pellet ignition
  and feed; electric no-heat/no-power; or none if the manual has no troubleshooting content.
- **Codes**: only where the manual has a code table (IPI boards, pellet controls).
- **Owner tiles**: the model's real questions (lighting and remote for gas; fire-building, air
  control and ash for wood; hopper and cleaning for pellet).

---

## 6. Definition of done

- [ ] `build_guide.py <id>` prints OK.
- [ ] `qa-guide.js` reports 0 failures (structure, links, page references).
- [ ] `check_numbers.py` finds every number in the manual (website figures in website notes and
      figures confirmed on the rendered page are allowed).
- [ ] The browser smoke test passes (`verify_batch.py` runs build, QA, numbers and smoke together).
- [ ] The phone check passes: slim header, section bar, no sideways scrolling, no undersized buttons.
- [ ] Every in-manual disagreement is classed (substantive, clerical, not_a_conflict) in `review`,
      and every website difference is shown at its spot.
- [ ] No "confirm" wording aimed at Stoveworks anywhere on the page.
- [ ] The safety blocks are complete (rule 8): the sweep script finds nothing the manual prints
      that the guide drops.
