# Update one finished guide to "report everything" (Ben, Oct 12)

Ben's rule: we report what the maker prints (manuals) and posts (its website), and more
information is better. The notes are written for our people and customers, never as a to-do list
for us: no "Confirm …" boxes. Where the manual disagrees with itself, show both. Where the website
differs from the manual, show both. Where something is a plain misprint, show the correct figure
with a small note saying what was printed. Never drop a figure.

You are updating one existing guide's content file, `guides/content/<id>.json`. It is finished and
already passes every check. Change only what the steps below touch; tiles, wording, page links and
everything else stay as they are.

**Read first** (in /home/claude/brain): `GUIDE_SPEC.md` rule 3, its section "When the maker's
website and the manual disagree", and its "Working efficiently" section. Don't read the rest of
GUIDE_SPEC, the scripts, the template or other guides.

**Inputs:** `build/guide_inputs/<id>/unit.json` (models, manuals), `doc1.txt`, `doc2.txt`… (the
manual text; open only the pages you need: `python3 scripts/find_in_manual.py <id> "term" …` and
Read with offset/limit around the `=== DOC n · PAGE p ===` markers), and `website.json` (what the
maker's website prints for each model, in its own words).

## Steps
1. **Conflicts.** For each entry in `review.conflicts`, open the cited pages and classify it by
   rule 3:
   - `substantive`: keep both figures and both pages, but rewrite the red "Confirm …:" box as a
     plain amber note for the reader: `<div class="note"><b>Note:</b> …</div>`. Report what each
     page says in a sentence that names its topic when the old label carried it (e.g. "Confirm
     who replaces the glass: p. 23 says only a qualified service person should; …" becomes
     "Note: p. 23 says only a qualified service person should replace the glass; …"). Never write
     "confirm", "check" or "verify" aimed at us; these notes are for our people and customers.
     Keep the numbers and page references exactly as they were.
   - `clerical`: put the correct figure in the drawer (and in the spec card row, if it shows
     there) and replace the old box with a `<div class="note small">` saying what was printed
     where. Add `"corrected_to"`.
   - `not_a_conflict`: reword so both statements read clearly (the old box is no longer
     needed). Add `"reason"`.
   Add `"class"` to every entry. Most conflicts about installation values are substantive; that
   is fine. Two different numbering systems are not a misprint (an OEM number on the label and
   the maker's own part number, a kit number and a component number): show both, saying what
   each is, and class it `not_a_conflict`.
2. **Website differences.** For each entry in `review.catalog_mismatches`, find where the guide
   shows that figure and add `<div class="note small"><b>Maker's website:</b> …</div>` right after
   it, quoting the website's label and value from website.json. If the guide doesn't show the
   figure, add a kv row with the manual's figure to the most relevant installer drawer and put the
   note after it. Add `"shown": "<drawer key>"`. When the website figure is an
   installation-safety value (clearances, gas input, venting, mobile-home approval, outside air),
   end the note with "Install to the manual." (or "Install to the clearance diagrams in the
   manual." when the manual shows them only as a diagram). Then compare website.json's rows with the figures
   your guide shows; for any other figure the website prints differently, do the same and add an
   entry to `catalog_mismatches` (field, catalog = the website's value, manual, page). Skip
   website rows the manual doesn't cover at all.
3. **True North log length** (TN10, TN20 stove, TN20 insert, TN25c only): show both lengths as
   GUIDE_SPEC says.
4. Keep every `pageref` key. If you change a spec card row, keep its `tap`. Don't add links.
5. Run the checks in one command and fix anything they report, then rerun until clean:
   `python3 scripts/build_guide.py <id> && node guides/qa-guide.js guides/<id>.html | tail -25; python3 scripts/check_numbers.py <id>`
   Website figures (from website.json or catalog_mismatches) are allowed by the number check.
   Skip the browser smoke test; it is run centrally.
6. Final message (60 words or fewer): the id; conflicts by class (substantive / clerical /
   not_a_conflict); website notes added; anything you weren't sure about.
