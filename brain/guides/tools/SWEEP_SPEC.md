# Put back safety statements a guide left out (Oct 12 sweep)

An independent spot-check found that, when the guides were written, some safety statements were
shortened too far: a "never", an "immediately", a stop condition, a consequence, or items of the
manual's do-not-burn list went missing. A search of every guide has flagged the places where the
manual prints such a statement and the guide doesn't seem to have it. You fix the flags for the
guide(s) you're given. The guides are otherwise finished and pass every check: change only what
the flags touch.

**Read first** (in /home/claude/brain): `GUIDE_SPEC.md`, the section "The rules that matter most"
(rule 9 is the one this is about; rules 1, 3, 4 and 7 apply too). Nothing else in GUIDE_SPEC, and
no scripts, template or other guides.

**Inputs per guide:** `build/sweep/<id>.json` (the flags: what's missing and the manual pages
where it appears); `guides/content/<id>.json` (the guide); `build/guide_inputs/<id>/doc1.txt`
(doc2…; find a page with `grep -n "PAGE 14 of" build/guide_inputs/<id>/doc1.txt` and Read with
offset/limit); `python3 scripts/find_in_manual.py <id> "term" …`. To find where the guide covers a
topic, search the content file (e.g. `grep -o '.\{200\}smell gas.\{200\}' guides/content/<id>.json`)
rather than reading it all.

## For each flag
1. Open the manual page(s) given and read the statement in context. The flags come from a text
   search, so some are false alarms: the guide may already say it in other words, or the manual's
   statement may be about something the guide doesn't cover. If so, skip the flag.
2. Find where the guide covers that topic (the gas-smell steps are usually in the safety drawer,
   sometimes repeated in the lighting drawer; turn-off steps in the lighting drawer; the
   do-not-burn list in the wood or fuel drawer; vent termination rows in the venting drawer; the
   TV-above-the-fireplace advice in the mantel drawer).
3. Add the missing statement there, in the guide's voice: plain second person for owners, terse
   for installers. You may shorten wording, but keep the instruction, its force ("never",
   "immediately", "stop") and its consequence. Keep the manual's own figures and units. Add list
   items in the list's existing style; don't restructure a drawer.
   - Gas-smell steps: the main block (usually the safety drawer) carries every step the manual's
     block has. A short mention elsewhere keeps at least "don't light anything" or the stop
     condition and can point to the safety drawer by its title.
   - **Complete the block while you're there.** When a flag sends you to a do-not-burn list, bring
     the whole list in line with the manual's list (every item it names, in the guide's list
     style) and keep its stated consequence (e.g. toxic fumes). When a flag sends you to the
     gas-smell steps, the lighting label's stop lines ("if the knob doesn't pop up, stop and
     immediately call…") or the knob/under-water warnings, bring that whole block in line with
     the manual. Don't go hunting through other topics.
   - Where two pages disagree (e.g. "never burn wet wood" and "if you must burn wet wood…"), show
     both in an amber `<div class="note"><b>Note:</b> …</div>` and add a `review.conflicts` entry
     (`where`, `issue`, `pages`, `"class": "substantive"`). Notes are for customers and installers;
     never "confirm", "check" or "verify" aimed at us.
   - Use `<div class="note danger">` only for a warning the manual itself gives.
4. Don't add topics the guide doesn't cover, links, or computed numbers. Keep every `pageref` key
   and every spec card's `tap`.

## Checks (per guide)
Run in one command and fix anything reported, then rerun until clean:
`python3 scripts/build_guide.py <id> && node guides/qa-guide.js guides/<id>.html | tail -25; python3 scripts/check_numbers.py <id>`

## Final message (60 words or fewer per guide)
For each id: flags fixed / skipped as false alarms (one line on each skip), and anything odd.
