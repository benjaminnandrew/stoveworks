# Hayward Stoveworks

Read [HANDOFF.md](HANDOFF.md) first (state, decisions, traps), then [README.md](README.md).
Dev preview on port 3014. PGlite is single-process: stop the dev server before `db:*` or `brain:load`.

## Smart search rules

From [docs/SMART-SEARCH-BLUEPRINT.md](docs/SMART-SEARCH-BLUEPRINT.md) section 13, fitted to this
site in [docs/smart-search-plan.md](docs/smart-search-plan.md).

- No brand-, model- or phrase-specific code in search. Fix a whole class with a general rule plus data; record exceptions as data (search_aliases, staff review answers).
- The AI only extracts what the visitor asked into the strict schema. Code resolves every model, manual, page and number against the brain.
- Names we hold beat word rules (units, safety words, numbers), exact names only.
- Safety-critical values (clearances, gas pressures, flue sizes, hearth protection) are never stated in the search's own words until they're confirmed field by field; link the guide section and manual page instead.
- No prices anywhere: a budget is read and said back, and answered "we quote in person".
- Every search box uses the same endpoint and response shape; a page's default scope never silently narrows a typed search. (The guides' built-in manual search is the one exception.)
- Tests are generated from the brain, run through the real endpoint, and block outside network calls. Pass marks are in docs/smart-search-plan.md section 4. Run them with `npm run dev`, then `npm run test:search`.
- One change at a time: finish it, test it against the marks, then start the next.
