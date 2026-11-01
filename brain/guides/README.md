# Owner & installer guides

**54 of 199 guides built** (8 Oct 2026). Each is one self-contained page: double-click any `.html`
file here to open it in your browser. Its "Official PDF" buttons and page links open the manuals
you downloaded into `var/brain-assets` (they need that folder next to `brain/`).

- `*.html` — the finished guides, one per manual set (a few cover several models or one configuration).
- `content/` — the plain-language content of each guide (what was written from the manual).
- `template/` — the shared page design and logic; every guide is built from it.
- `v2-originals/` — the three Jøtul guides as first built by hand, before the shared template.
- `tools/` — how the rest get built: `GUIDE_SPEC.md` (the writing rules), `guide_plan.json`
  (which manuals each of the 199 guides uses), and the build and check scripts.

Still to build: the remaining guides listed in `tools/guide_plan.json` that have no file in `content/`.
