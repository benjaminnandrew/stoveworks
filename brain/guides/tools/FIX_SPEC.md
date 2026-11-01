# Apply the spot-check findings to one guide (Oct 12)

An independent reviewer checked this guide against its manual and wrote its findings to
`build/spotcheck/<id>.json`. Your job is to apply the findings that hold up, and only those.
The guide is otherwise finished and passes every check: change only what the findings touch.

**Read first** (in /home/claude/brain): `GUIDE_SPEC.md`, the section "The rules that matter most"
(rules 1–10; rules 9 and 10 are new and are what most findings are about) and the section "When
the maker's website and the manual disagree". Nothing else in GUIDE_SPEC, and no scripts,
template or other guides.

**Inputs:** `build/spotcheck/<id>.json`; `guides/content/<id>.json` (the guide);
`build/guide_inputs/<id>/doc1.txt` (doc2…; find a page with `grep -n "PAGE 14 of"
build/guide_inputs/<id>/doc1.txt` and Read with offset/limit); `build/guide_inputs/<id>/website.json`;
`python3 scripts/find_in_manual.py <id> "term" …`.

## For each finding
1. Open the cited page(s) and confirm the manual says what the finding quotes. Critical and major
   findings have already been confirmed; still read the page so your wording is right.
2. If it holds up, apply it. The finding's `fix` is a suggestion: keep the guide's voice (plain,
   second person for owners; terse for installers), numbers exactly as printed, the manual's own
   units. Use the building blocks the guide already uses: an amber
   `<div class="note"><b>Note:</b> …</div>` for two printed figures or statements that disagree
   (written for the reader; never "confirm", "check" or "verify" aimed at us), a
   `<div class="note small">…</div>` for a corrected plain misprint or a `<b>Maker's website:</b>`
   figure (safety values end "Install to the manual."), and `<div class="note danger">` only for a
   warning the manual itself gives.
3. If it doesn't hold up, or the fix would break a rule, skip it and say why in your final message.
4. If the finding asks for a page-image check and the text can't settle it, skip it and list it.

## Records
- New amber note → add an entry to `review.conflicts` (`where`, `issue`, `pages`, `"class":
  "substantive"`). A finding that turns a clerical correction into a substantive note → change that
  entry's class and remove its `corrected_to`. New misprint note → `"class": "clerical"` with
  `"corrected_to"`. Reworded non-conflict → `"class": "not_a_conflict"` with `"reason"`.
- New website note → add to `review.catalog_mismatches` (`field`, `catalog` = the website's value,
  `manual`, `page`, `"shown": "<drawer key>"`).
- If a finding removes a to-do aimed at Stoveworks from `review.notes`, rewrite that note as a plain
  record.

## Don't
- Don't change anything the findings don't touch. Keep every `pageref` key and every spec card's
  `tap`. Steps stay `[title, summary, drawer HTML]`; a step without a drawer may get one as a third
  element.
- Don't add links, and don't compute numbers (no unit conversions in the guide's text).

## Checks
Run in one command and fix anything reported, then rerun until clean:
`python3 scripts/build_guide.py <id> && node guides/qa-guide.js guides/<id>.html | tail -25; python3 scripts/check_numbers.py <id>`

## Final message (80 words or fewer)
The id; findings applied / skipped (with the reason for each skip); any page-image checks needed.
