# Write one Stoveworks owner & installer guide from its manual(s)

Stoveworks (a hearth dealer in Hayward, Wisconsin) gives every model it sells a two-sided guide:
homeowners get plain-language answers ("how do I light it?"), installers get a field reference
(specs, clearances, install sequence, faults). Both link to the exact page of the official
manual, which stays the legal source of truth.

You write **one guide's content file**. The page itself (layout, styles, search, PDF links) is a
shared template; you never write HTML pages, only the JSON content.

## Your inputs (all under /home/claude/brain)
- `build/guide_inputs/<id>/unit.json` — which model(s) the guide covers, the configuration (if
  any), the manual(s) it is built from (`docs`, numbered 1, 2…), and the catalog record of each
  model (`catalog`: specs and features gathered from the manufacturer's website).
- `build/guide_inputs/<id>/doc1.txt` (and `doc2.txt`, `doc3.txt`…) — each manual's full text, laid
  out as on the page. Every physical PDF page starts with a marker line:
  `=== DOC 2 · PAGE 14 of 27 ===`. **Page numbers in your file always mean these physical pages**
  (cover = 1), never the page numbers printed in the manual's footer.
- `guides/content/jotul-gi-635-dv-ipi-newcastle.json` — a finished example (a gas insert) showing
  the shape, tone and length we want. Read it first.
- `guides/template/icons.json` — the icon names you can use on owner tiles.
- Tools: `python3 scripts/find_in_manual.py <id> "term" ["term"…] [--doc N]` lists the pages that
  mention a term (with the surrounding lines); `python3 scripts/build_guide.py <id>` validates
  your file and builds the page; `node guides/qa-guide.js guides/<id>.html` checks the result.

Read the manual(s) completely before writing (use Read with offset/limit; the files are long).

## Working efficiently (many guides are being written at the same time)
- This spec tells you everything you need about the tools. Don't open the scripts, the template,
  `qa-guide.js` or other guides' content files. Read only the one example and `icons.json`.
- Read each doc file straight through in large chunks (about 800 lines per Read), not small slices.
- Confirm pages with a few `find_in_manual.py` calls, each passing many terms at once.
- Write the whole content file in one pass (Write, or a short Python script that dumps the JSON,
  kept in a scratch folder named after your guide id). Then run all three checks in one command:
  `python3 scripts/build_guide.py <id> && node guides/qa-guide.js guides/<id>.html | tail -40; python3 scripts/check_numbers.py <id>`
- Fix everything they report in one round of edits, rerun, and stop once they pass. Skip the
  browser smoke test; it is run centrally afterwards.
- Other writers work in the same folder at the same time. Ignore files you didn't write. Don't
  list, compare or check the timestamps of other files.

## The rules that matter most
1. **Only the manual.** Every fact, number, part number, procedure, warranty term and warning
   comes from the manual text in your doc files. Never fill a gap from general knowledge or from
   another model. If the manual doesn't cover a topic, leave the topic out.
2. **Numbers exactly as printed** (with units). Re-check every number against the page before you
   finish: BTU rates, gas pressures, clearances, vent lengths, dimensions, log length, flue size,
   electrical ratings, battery types, part numbers.
3. **Report everything; correct only plain misprints (Ben, Oct 12).** We report what the maker
   prints and posts, and more information is better: never drop a figure.
   - **The manual disagrees with itself** (two pages, a table vs a label, install vs owner's
     manual) on anything that matters, and the manual doesn't settle which is right: show both in
     the drawer as a plain note for the reader, `<div class="note"><b>Note:</b> p. 24 suggests
     window cleaner or a commercial stove glass cleaner, then says to use only a cleaner made
     specifically for woodstoves.</div>`, and record it in `review.conflicts` with `"class":
     "substantive"`. Don't pick one. The note reports what each page says, in a sentence that
     names its topic; it never asks anyone to confirm, check or verify (Ben, Oct 12: these notes
     are for our people and customers, not a to-do list for us).
   - **A plain misprint** (a metric figure that doesn't match the inch figure printed with it, a
     part number printed two ways where the parts list settles it, a digit or year typo that the
     manual's other pages settle): show the correct figure and add a small note saying what was
     printed where, e.g. `<div class="note small">The manual also prints 437 mm here (p. 9); its
     spec page gives 18" (457 mm).</div>`. Record it in `review.conflicts` with `"class":
     "clerical"` and `"corrected_to"`. The correct figure must be one the manual (or the maker's
     website) prints; never compute one.
   - **Not really a conflict** (on a second read both statements fit, e.g. a recommended and a
     maximum length): word it so both are clear and record `"class": "not_a_conflict"` with a
     `"reason"`.
   - Procedures, clearances, venting, gas pressures, electrical ratings, burn instructions and
     warranty terms are never treated as misprints unless the manual itself settles it beyond
     doubt: keep the note.
   - Two numbering systems are not a misprint (an OEM number on the label and the maker's own part
     number, a kit number and a component number): show both, saying what each is.
4. **Don't reconstruct what the text can't show.** Some content lives only in figures, photos or
   check-mark tables (lighting diagrams, warranty grids, clearance drawings with lettered
   dimensions). If the text doesn't make it unambiguous, don't transcribe values or steps from it
   — say in one sentence that the manual shows it as a diagram on that page, link the page, and
   note it in `review.notes`. No unit conversions either: use the manual's own numbers and units.
5. **Get the ignition right.** Hand-lit standing pilot, push-button piezo, intermittent pilot
   (IPI) on a remote or switch, continuous pilot (CPI) option, millivolt, electronic — these change
   how people light the unit. Describe exactly what this manual describes, for this configuration.
6. **PAGEREF honestly.** For every owner tile, spec card and install step, give the physical page
   where that topic actually lives (confirm with `find_in_manual.py`). If you can't confirm a
   page, omit that key — no link beats a wrong link.
7. **Plain language for owners**: second person, short sentences, no unexplained jargon, no ALL
   CAPS, no marketing. Installer text is terse and technical.
8. **French or garbled text.** If the standard "what to do if you smell gas" block exists only in
   French (Canadian cover text), translate it faithfully and say so in `review.notes`. Don't
   translate anything else that is French-only: link the page and note it. Some pages have
   stretches of scrambled text from a font that is offset by 29 code points ("pet the _urner
   pwitch" = "Set the Burner Switch", "QK" = "4."). You may decode those with that rule; say so
   in `review.notes`. Never guess at text you can't decode.
9. **Safety statements keep their force (spot-check, Oct 12).** You may shorten wording, but never
   drop an instruction, a "never", an "immediately", a "stop", a limit or the consequence from a
   safety block. Keep every step of: what to do if you smell gas; the lighting label's retry limits
   and waits ("wait 5 minutes", "after three attempts, stop"); the turn-off steps (including "turn
   off all electric power if service is to be performed"); "use only your hand… don't try to repair
   it… force or attempted repair may cause a fire or explosion"; "if any part has been under water";
   over-firing warnings; the do-not-burn list (wet, green or unseasoned wood included); and
   stop-using conditions ("discontinue operation until…"). A summary elsewhere (a fault line, a
   search hint, a step summary) keeps the stop condition too ("if you still smell gas, stop").
10. **Figures printed in two units that don't match** (a clearance of 7 3/8" printed with 178 mm, a
   pressure of 11.0 WC printed with 3.0 kPa): show the figure as printed and say in a short note that
   the two don't match, unless another page settles it (then rule 3's misprint note applies, but
   never for a safety value the manual doesn't settle). Don't silently drop the second unit or pick
   one of two printed figures for the same thing.

## The content file: `guides/content/<id>.json`
```json
{
  "id": "<id>",
  "schema": 3,
  "shell": {
    "brand_mark": "TOWN & COUNTRY",
    "brand_line": "TC36 · Direct vent gas fireplace",
    "kicker": "Direct vent gas fireplace",
    "title": "Town & Country TC36",
    "model_line": "Model TC36D2 · Direct Vent · IPI / CPI electronic ignition",
    "owner_noun": "fireplace",
    "owner_card": "Light it, use the remote, decode a sound, clean the glass, check the warranty.",
    "installer_card": "Specs, clearances, venting, the install sequence and fault diagnosis.",
    "certification": "ANSI Z21.88-2017 · CSA 2.33-2017",
    "owner_search_hint": "lighting, remote, glass, gas smell",
    "manual_search_hint": "clearance, vent, pressure"
  },
  "home_primary":   [ {"id":"light","icon":"flame","title":"Light the fireplace","blurb":"…"} ],
  "home_secondary": [ {"id":"glass","icon":"glass","title":"Clean the glass","blurb":"…"} ],
  "specs": [ {"id":"input","lab":"Input rate · BTU/hr","tap":"specInput",
              "rows":[["Natural gas","47,000 / 35,000"],["Propane","47,000 / 35,000"]],"note":"max / min"} ],
  "specs_label": "Critical specs",
  "steps": [ ["Gas connection + leak test","Pipe to code with a manual shut-off; test joints with soap solution."],
             ["Vent connection","…","<p>optional: richer drawer html for this step</p>"] ],
  "faults": {"label":"Gas pressure faults","panels":[{"title":"Insufficient pressure","items":["…","…"]},
                                                     {"title":"Excessive pressure","items":["…"]}]},
  "codes": [[3,"Lockout","Ignition failed three times — see service"]],
  "codes_label": "IFC LED flash codes",
  "detail": {
    "light": {"tag":"Owner · operation","title":"Lighting the fireplace","cool":false,"html":"<p>…</p><ol><li>…</li></ol>"},
    "specInput": {"tag":"Installer · spec","title":"Input rates","cool":true,"html":"<div class=\"kv\"><div class=\"r\"><span>NG max / min</span><span>47,000 / 35,000 BTU/hr</span></div></div><p>…</p>"}
  },
  "pageref": {"light": [2, 4], "specInput": 5, "step0": 3},
  "index_extra": [ {"k":"h","id":"safety","t":"gas smell","p":"What to do if you smell gas"} ],
  "review": {
    "conflicts": [ {"where":"specInput","issue":"…","pages":[[1,5],[2,3]]} ],
    "catalog_mismatches": [ {"model":"town-country-tc36","field":"efficiency_pct","catalog":"26.8","manual":"…","page":[1,5]} ],
    "notes": "anything a human reviewer should know (unreadable pages, OCR doubts, topics the manual doesn't cover)"
  }
}
```

### shell (the page's headings)
- `brand_mark`: the brand in capitals as the maker writes it (JØTUL, MAJESTIC, KOZY HEAT, ENVIRO…).
- `title`: brand + model as people say it, **30 characters or fewer** if at all possible (it is
  the big headline). Use the catalog's model name (`catalog[].name`, the name Stoveworks sells it
  under), even when the manual only uses a model number. If brand + name runs long, drop
  the brand rather than abbreviate it, since `brand_mark` shows it above the title: "Tofino Z25
  Premium", not "PE Tofino Z25 Premium". Add the configuration when the guide is one of several for a model ("Kozy
  Heat Chaska 34 Glass"). For a guide shared by several models, use the family name ("Pacific
  Energy Super LE", "Mendota ML Series") and list every model in `model_line`.
- `brand_line`: model + a short descriptor for the header. `kicker`: the appliance type
  ("Direct vent gas fireplace", "Wood stove", "Electric fireplace insert"…).
- `model_line`: model numbers from the manual's cover or rating information · venting · ignition.
- `owner_noun`: fireplace | stove | insert | heater — what an owner calls it.
- `owner_card` / `installer_card`: one line each naming what's inside that side, matching your tiles/sections.
- `certification`: the listing standard(s) the manual names (omit the key if it names none).
- `owner_search_hint` / `manual_search_hint`: 3–4 example search words for this model.

### home_primary / home_secondary (owner tiles)
4 "Start here" tiles and 4–6 "Good to know" tiles: what owners of this kind of appliance actually
ask, and only topics the manual covers. Each tile `id` needs a `detail` entry with the same key.
Typical picks:
- **Gas**: light it (the real procedure), remote / wall switch / app, turn it off, first fire —
  sounds, smells & foggy glass, clean the glass, what the flame/pilot should look like, blower,
  power & batteries (outages), safety & gas smell, annual service, warranty (only if the manual
  includes warranty terms).
- **Wood**: start a fire / break-in fires, air control, reloading & burn times, what wood to burn,
  ash removal, glass cleaning, chimney & creosote, door gasket / maintenance, signs of over-firing,
  safety, blower, warranty.
- **Pellet**: start-up & ignition, filling the hopper & pellet quality, heat / feed settings,
  daily and weekly cleaning (burn pot, ash, heat exchanger), shutdown, power outages, error
  codes / troubleshooting, safety.
- **Electric**: turn on & heat settings, remote, flame effects, thermostat/timer, cleaning,
  safety, troubleshooting.
- **Outdoor**: lighting, weather & covers, cleaning, seasonal shutdown, safety.

`icon`: a name from icons.json (flame, pilot, remote, off, sound, glass, adjust, fan, power,
battery, safety, service, warranty, logs, air, ash, chimney, thermometer, brush, door, droplet,
light, clock, alert, wifi, phone, dial, screen, question, leaf, plug, pot, tree, gauge, spark…).

### specs (installer cards) — 5 to 8 cards
Rows are `[label, value]` text pairs, values exactly as printed. Choose by category:
- **Gas**: input BTU (NG/LP max/min), inlet pressure, manifold pressure, venting (pipe size, runs
  or chart), clearances (incl. mantel), framing / cavity or firebox minimums for inserts,
  electrical (if any), fuel conversion kit.
- **Wood**: firebox volume, max log length, emissions (g/hr) & efficiency, flue size / chimney,
  clearances to combustibles, floor protection / hearth, weight, outside air.
- **Pellet**: heat output / burn rate, hopper capacity, electrical rating, pellet vent (size,
  type, maximum runs, outside air), clearances, floor protection.
- **Electric**: volts / amps / watts, heat output, circuit requirement, dimensions / rough-in, clearances.
When a guide covers several sizes or models whose numbers differ, give one row per model.
Each card's `tap` (camelCase, e.g. `specClear`) opens a `detail` drawer with the fuller picture
(kv rows + a sentence or two) — `cool: true`, `tag: "Installer · spec"`.

### steps (install sequence) — 6 to 10 steps
In the manual's order. `[title, one or two sentences]`, optionally a third element with richer
drawer html. Step drawers are generated as `step0`, `step1`… (don't add them to `detail`).

### faults
Up to 4 panels of symptoms → causes, **taken from the manual's troubleshooting chart or fault
descriptions**. Gas models usually get the pressure pair or the pilot/ignition pair; wood gets
draft/smoke vs over-firing; pellet gets won't-ignite vs goes-out / feed problems; electric gets
no-heat / no-power. If the manual has no
troubleshooting content, set `"faults": null` — don't write generic panels.

### codes
Only when the manual publishes a code table (LED blink codes, display error codes):
`[blink count or code text, title, short description]`. Otherwise `[]`.

### detail (drawer bodies)
`{tag, title, cool, html}`. `cool: false` for owner drawers, `true` for installer drawers.
Owner drawers: 80–250 words. Tags: "Owner · operation", "Owner · maintenance", "Owner · safety",
"Owner · warranty", "Owner · reassurance", "Installer · spec".
HTML building blocks only: `<p>`, `<h4>`, `<ol>`/`<ul>` with `<li>`, `<b>`, `<i>`, `<br>`,
`<div class="note">` (tip, or a "Note:" reporting two figures), `<div class="note danger">`
(a warning the manual gives),
`<div class="note small">` (a corrected misprint, or the maker's website figure), and
key/value rows `<div class="kv"><div class="r"><span>Label</span><span>Value</span></div></div>`.
No links (each drawer automatically ends with a link to its PAGEREF page), no tables, no scripts.
Use straight quotes for inches (24") and the same units as the manual.

### pageref
`"key": page` for manual 1, or `"key": [n, page]` for manual n (e.g. the owner's manual). Keys:
tile ids, spec taps and `step0`… Prefer the owner's manual for owner topics and the installation
manual for installer topics when there are two.

### index_extra
3–8 words people type that aren't titles, pointing at a drawer: "gas smell", "pilot light",
"creosote", "won't light", "propane conversion"… (`k`: "h" owner, "i" installer).

### When the maker's website and the manual disagree (Ben, Oct 12: report both)
- The guide follows the manual, so the manual's figure stays in the card or drawer row, with its
  page link, and a small note right after it gives the website's figure in the website's own
  words: `<div class="note small"><b>Maker's website:</b> Heat Output, Cord Wood 60,000 BTU.</div>`.
  Take the wording from `build/guide_inputs/<id>/website.json`. This applies to every
  difference, small ones too (a rounded or truncated figure), and to installation-safety values;
  for those, end the note with "Install to the manual."
- **Where the manual has no figure the website prints, but covers the topic:** if the manual
  gives it only in a drawing (lettered clearances, for example), put the website's figures where
  the guide points to the drawing, ending "Install to the clearance diagrams in the manual."; if
  the guide says the manual prints no figure (an efficiency percentage, say), add the website's
  figure in a small note right there. Website rows on topics the guide doesn't cover at all
  (heating area, burn time, production runs) stay in the catalog, not the guide.
- When the figure comes from a maker's brochure or spec sheet rather than its web page, label the
  note with that: `<b>Maker's brochure:</b>`.
- If the manual's figure is a plain misprint and the website or the manual's other pages show the
  correct one, follow rule 3: show the correct figure and note what the manual printed.
- **Log length where the website gives one "max" that is the manual's ideal length (Ben, Oct 9):**
  show both, recommended and maximum, and note that the website labels the recommended length as
  its max. So far this is True North: TN10 12 / 14 in., TN20 stove and insert 18 / 20 in., TN25c
  18 / 20 in.
- Record each difference in `review.catalog_mismatches` with `"shown": "<drawer key>"`. (The
  catalog keeps the website's figure as its headline number and lists the manual's separately;
  that is the brain's business, not the guide's.)

### review (not shown on the page — for Stoveworks' records)
- `conflicts`: every in-manual disagreement you flagged.
- `catalog_mismatches`: compare the manual with each `catalog[].specs` entry you can check
  (BTU, efficiency, dimensions, log length, flue size, emissions, heating area…). List real
  differences only, with the manual's page.
- `notes`: anything a reviewer should know.

## Finish
1. `python3 scripts/build_guide.py <id>` must print `OK`. Fix every error it lists.
2. `node guides/qa-guide.js guides/<id>.html` must end with `0 fail`. For each "worth
   re-checking" warning, open that page again: fix the page number, or drop the key if the topic
   isn't there. Add page links for drawers it lists as unlinked when you can confirm a page.
3. `python3 scripts/check_numbers.py <id>` lists any number in your guide it can't find in the
   manual text. Fix each one (typo, conversion, a figure you inferred) or, if it is genuinely in the
   manual but written differently, leave it and mention it in `review.notes`.
4. Final message (≤ 80 words): guide id, tiles/specs/steps counts, conflicts flagged, catalog
   mismatches, anything you weren't sure about.
