# Independent check of one Stoveworks guide against its manual (v2, Oct 12, 2026)

You are a second pair of eyes on a guide someone else wrote. The guides are for a hearth dealer's
customers and installers, so mistakes in safety content matter most. Your job is to find what is
**wrong**, not to rewrite what is fine. Read the manual yourself and judge the guide against it.

## How the guides work (Ben, Oct 12: report everything the maker prints and posts)
- Every fact comes from the manual (the newest US edition), with numbers exactly as printed.
- **The manual disagrees with itself:** the guide shows both figures in an amber note,
  `<div class="note"><b>Note:</b> p. 12 says …; p. 30 says …</div>`, and doesn't pick a side.
- **A plain misprint** (a metric figure that doesn't match its inch figure, a part number the parts
  list settles, a typo the manual's other pages settle): the guide shows the correct figure, with a
  `<div class="note small">` saying what was printed where.
- **The maker's website differs:** a small `<b>Maker's website:</b> …` note quotes the website's
  figure next to the manual's. Installation-safety ones end "Install to the manual."
- Content that exists only in a drawing or check-mark table is not transcribed; the guide links
  the page instead.
- The notes are written for customers and installers. They never ask anyone at Stoveworks to
  confirm, check or verify something.

## What you read (all under /home/claude/brain)
- `GUIDE_SPEC.md`: only "The rules that matter most" (lines 41–92) and "When the maker's website
  and the manual disagree" (line 225 up to "### review").
- `build/guide_inputs/<id>/unit.json`: the models, configuration and manuals the guide covers.
- `build/guide_inputs/<id>/doc1.txt` (and doc2…): the manual text, with a marker before every
  physical page (`=== DOC 1 · PAGE 14 of 27 ===`). Find a page's line with
  `grep -n "PAGE 14 of" build/guide_inputs/<id>/doc1.txt`, then Read with offset/limit.
- `build/guide_inputs/<id>/website.json`: what the maker's website prints for each model.
- `guides/content/<id>.json`: the guide.
  - `detail`: drawer bodies (HTML).
  - `specs`: installer cards (`rows` of label/value; `tap` names the drawer the card opens).
  - `steps`: install steps as [title, summary, drawer HTML]; their keys are `step0`, `step1`…
  - `home_primary` / `home_secondary`: owner tiles, each opening `detail[<key>]`.
  - `faults`, `codes`.
  - `pageref`: maps each key to a physical page (`n` = manual 1, `[d, n]` = manual d).
  - `review`: the writer's records (conflicts with their class, catalog_mismatches, notes).
- Tool: `python3 scripts/find_in_manual.py <id> "term" ["term"…]` lists the pages that mention a
  term.
- Don't open other guides, the scripts or the template.

## How to work
Read the whole content file first. Then go drawer by drawer, opening the manual pages each one
rests on (its pageref page, plus the pages find_in_manual gives for its numbers). Read the
manual's safety sections in full: lighting, shutdown and what to do if you smell gas (gas);
burning and over-firing (wood and pellet); clearances; venting or chimney; electrical; and the
warnings pages. Pages the guide doesn't touch (parts lists, warranty fine print) only need a look
when you suspect the guide got something wrong.

## What to check, in this order
1. **Safety and operation:** the lighting or ignition procedure (the right kind for this
   configuration: standing pilot, IPI, millivolt…), shutdown, gas-smell steps, burn instructions,
   clearances, venting limits, gas pressures, electrical ratings, mobile-home rules. Is each step
   and value what this manual says, for this configuration and fuel?
2. **Every number** in specs, drawers, steps, faults and codes: value, unit, and what it belongs
   to (NG vs LP, max vs min, US vs Canada, which model of a shared guide).
3. **Claims the manual doesn't support:** general knowledge, another model's information, or a
   guess (including catalog facts presented as manual facts).
4. **The notes:**
   - Each amber "Note:": do both pages really say what it says? Is it a real disagreement? Is
     either side misquoted, or worded so it misleads?
   - Each small correction note: is it truly a plain misprint, and is the corrected figure one the
     manual (or the website) prints? A safety value (clearance, venting, gas pressure, electrical,
     procedure, warranty) "corrected" without the manual settling it beyond doubt is a finding.
   - Each "Maker's website:" note: does it match website.json (label and value)? Does a
     safety-value note end "Install to the manual."?
   - Any "confirm", "check" or "verify" aimed at Stoveworks rather than an instruction the manual
     gives (the manual's "confirm with a manometer" is fine).
   - **Silent picks:** a place where the manual gives two different values for the same thing and
     the guide shows only one, with no note.
5. **Page links:** spot-check at least 10 `pageref` entries, safety ones first. Does that page
   actually cover the topic?
6. **Owner wording** that could mislead: a softened warning, a dropped "never", a step out of
   order.

Not findings: style preferences, topics the guide chose not to include, drawing-only content the
writer correctly left out, and website rows on topics the guide doesn't cover.

## Output
Write `build/spotcheck/<id>.json`:
```json
{"id": "<id>", "checked_pagerefs": 12,
 "notes_checked": {"amber": 6, "correction": 2, "website": 3},
 "findings": [
   {"severity": "critical|major|minor", "where": "detail.light | specs.inlet row 2 | step3 | pageref.glass",
    "guide_says": "…", "manual_says": "… (quote)", "pages": [[1, 23]], "fix": "what the text should say"}
 ],
 "verdict": "one sentence: is this guide safe to publish after the fixes?"}
```
Severity: **critical** = could cause unsafe installation or use, or a wrong safety number or
procedure; **major** = a wrong number, an unsupported claim, a wrong model or fuel attribution, a
misreported note, or a wrong page link; **minor** = a small inaccuracy or misleading wording.
Quote the manual for every finding, with its page. If the text is garbled at that spot, say so
and give the page (it will be checked against the page image) instead of guessing.
Put an empty `findings` list if you find nothing wrong. Don't modify any other file.
Final message (60 words or fewer): counts by severity and the single most important finding.
