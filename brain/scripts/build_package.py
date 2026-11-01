"""Assemble the Stoveworks brain package from build/ outputs."""
import csv
import json
import shutil
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
BUILD = ROOT / "build"
PKG = ROOT / "package" / "stoveworks-brain"
VERSION = sys.argv[2] if len(sys.argv) > 2 else "v1"

if PKG.exists():
    shutil.rmtree(PKG)
for sub in ("data", "assets", "scripts"):
    (PKG / sub).mkdir(parents=True, exist_ok=True)

models_all = json.load(open(BUILD / "models.json", encoding="utf-8"))
# Ben, Oct 8: models the maker says are not for sale in the US are set aside (kept in archive/, not deleted)
SET_ASIDE_AVAIL = ("not_for_sale_us",)
set_aside_models = [m for m in models_all if m["us_availability"] in SET_ASIDE_AVAIL]
models = [m for m in models_all if m["us_availability"] not in SET_ASIDE_AVAIL]
kept_ids = {m["id"] for m in models}
brands = json.load(open(BUILD / "brands.json", encoding="utf-8"))
candidates = json.load(open(BUILD / "candidates.json", encoding="utf-8"))
# Shapes and flame patterns (Ben, Oct 8): Mendota sorts its gas fireplaces by shape, then flame pattern.
# build/shapes.json records those, plus other makers' shapes where their own name, page or specs state one.
SHAPES_PATH = BUILD / "shapes.json"
shapes = (json.load(open(SHAPES_PATH, encoding="utf-8")) if SHAPES_PATH.exists()
          else {"models": {}, "brands": {}, "groups": {}, "viewing_options": {}, "rule": "", "checked_on": None})
# Extra maker documents read after the research pass (e.g. the True North wood brochure Ben uploaded Oct 9):
# their printed values go into specs_raw, and notes say where they side with the website or the manual.
DOCADD_PATH = BUILD / "doc_additions.json"
doc_add = json.load(open(DOCADD_PATH, encoding="utf-8")) if DOCADD_PATH.exists() else {}
# Ben, Oct 9: decided spec values (e.g. True North log lengths, where both the recommended and the max
# length are recorded) replace the normalized figure; the difference stays listed with a note.
for m in models_all:
    ov = (doc_add.get("spec_overrides") or {}).get(m["id"])
    if ov:
        m["specs"] = {**m["specs"], **ov}
        for k, val in ov.items():
            if k in (m.get("headline") or {}):
                m["headline"][k] = val

# ---- The brain keeps the manufacturer's information only (Ben, Oct 8). Everything about the old
# Stoveworks portal (its values, the portal-vs-maker check, Steve's portal uploads, the corrections
# log) goes to archive/, not into the brain's records.
PORTAL_FIELDS = ("portal", "verification", "steve_uploads")

# guides: one per manual set (build/guide_plan.json), content in guides/content/<id>.json
plan = json.load(open(BUILD / "guide_plan.json", encoding="utf-8"))["units"]
guide_of, guide_rows, guide_of_all, set_aside_guides = {}, [], {}, []
for u in plan:
    cp = ROOT / "guides" / "content" / f"{u['id']}.json"
    if not cp.exists():
        continue
    c = json.load(open(cp, encoding="utf-8"))
    rv = c.get("review") or {}
    g = {"id": u["id"], "title": c["shell"]["title"], "configuration": u.get("configuration"), "file": f"guides/{u['id']}.html",
         "manuals": [{"storage_key": d["storage_key"], "label": d.get("label"), "revision": d.get("revision"),
                      "pages": d.get("pages")} for d in u["docs"]]}
    for mid in u["model_ids"]:
        guide_of_all.setdefault(mid, []).append(g)
    kept = [mid for mid in u["model_ids"] if mid in kept_ids]
    c["_mm"] = rv.get("catalog_mismatches") or []
    u["_content"] = c
    if not kept:                                 # serves only set-aside models
        set_aside_guides.append(u["id"])
        continue
    for mid in kept:
        guide_of.setdefault(mid, []).append(g)   # several when versions have their own manuals
    guide_rows.append({**g, "model_ids": kept, "configuration": u.get("configuration"),
                       "conflicts_flagged": len(rv.get("conflicts") or []),
                       "conflicts_by_class": dict(Counter(x.get("class") or "unclassed" for x in rv.get("conflicts") or [])),
                       "manual_differences": len(rv.get("catalog_mismatches") or [])})

# Where the manufacturer's website (the catalog's figures) and its manual disagree.
# Ben, Oct 8: the catalog keeps the website figure and flags the manual's. In the guides, product
# specs follow the website; installation-safety values follow the manual.
SAFETY = ("clearance", "btu_input", "mobile_home", "flue_diameter", "outside_air", "ignition", "vent_size")
diffs = {}
for u in plan:
    c = u.get("_content")
    if not c:
        continue
    for mm in c["_mm"]:
        targets = [mm["model"]] if mm.get("model") in u["model_ids"] else u["model_ids"]
        field = str(mm.get("field") or "")
        safety = any(k in field for k in SAFETY)
        for mid in targets:
            d = {"field": field, "website": mm.get("catalog"), "manual": mm.get("manual"), "manual_page": mm.get("page"),
                 "guide": u["id"],
                 "kind": "installation-safety value" if safety else "product spec",
                 # Ben, Oct 12: report both. The catalog leads with the website's figure; the guide
                 # shows the manual's and notes the website's right beside it.
                 "rule": "both reported: the catalog shows the website's figure; the guide shows the manual's with the website's noted beside it"}
            note = ((doc_add.get("difference_notes") or {}).get(mid) or {}).get(field)
            if note:
                d["note"] = note
            rule = ((doc_add.get("difference_rules") or {}).get(mid) or {}).get(field)
            if rule:
                d["rule"] = rule
            diffs.setdefault(mid, []).append(d)


def no_portal(text):
    """Drop passing mentions of the old portal from free-text notes (parentheticals, then sentences)."""
    if not isinstance(text, str) or "portal" not in text.lower():
        return text
    import re as _re
    t = text
    # a portal link that still points at a live maker page is just an old product link
    for pat, rep in ((r"\b[Tt]he portal link", "The old product link"), (r"\bPortal links\b", "Old product links"),
                     (r"\bPortal link\b", "Old product link"), (r"\bportal links\b", "old product links"),
                     (r"\bportal link\b", "old product link"), (r"\bportal URL", "old product URL")):
        t = _re.sub(pat, rep, t)
    t = _re.sub(r"\s*\([^()]*portal[^()]*\)", "", t, flags=_re.I)
    parts = _re.split(r"(?<=[.;])\s+", t)
    t = " ".join(x for x in parts if "portal" not in x.lower()).strip()
    return t or None


def brain_record(m):
    r = {k: v for k, v in m.items() if k not in PORTAL_FIELDS}
    v = m.get("verification") or {}
    # Steve uploaded some of the maker's own manuals to the portal; the source is still the maker's manual
    strip = lambda x: x.replace("Steve's portal upload: ", "") if isinstance(x, str) else x
    r["specs_raw"] = [{**e, "source": strip(e.get("source"))} if isinstance(e, dict) else e for e in (m.get("specs_raw") or [])]
    v = {**v, "sources": [strip(x) for x in (v.get("sources") or [])]}
    r["checked_on"] = v.get("checked_on")
    r["sources"] = v.get("sources") or []
    have = {(e.get("label"), e.get("value")) for e in r["specs_raw"] if isinstance(e, dict)}
    for e in (doc_add.get("specs_raw") or {}).get(m["id"], []):
        if (e.get("label"), e.get("value")) not in have:
            r["specs_raw"].append(e)
        if e.get("source") and e["source"] not in r["sources"]:
            r["sources"].append(e["source"])
    r["availability_evidence"] = no_portal(v.get("status_evidence")) or None
    r.pop("guide", None)
    r["guides"] = guide_of.get(m["id"], [])
    r["manual_differences"] = diffs.get(m["id"], [])
    # shape, flame pattern and viewing sit right after `style`, each with the maker page it rests on
    sh = shapes["models"].get(m["id"]) or {}
    extra = {"shape": sh.get("shape"), "flame_pattern": sh.get("flame_pattern"), "viewing": sh.get("viewing")}
    for x in extra.values():
        if x and x.get("source") and x["source"] not in r["sources"]:
            r["sources"].append(x["source"])
    out = {}
    for k, val in r.items():
        out[k] = val
        if k == "style":
            out.update(extra)
    if "shape" not in out:
        out.update(extra)
    return out


def brain_brand(b):
    r = {k: v for k, v in b.items() if k not in ("steve_uploads", "source")}
    mine = [m for m in models if m["brand_slug"] == b["slug"]]
    r["model_count"] = len(mine)
    r["categories"] = dict(Counter(f"{m['fuel']} {m['form']}" for m in mine))
    if isinstance(r.get("research_notes"), list):
        r["research_notes"] = [x for x in (no_portal(n) for n in r["research_notes"]) if x]
    r["about"] = no_portal(r.get("about"))
    r["browse"] = shapes["brands"].get(b["slug"])   # how the maker sorts its fireplaces on its own site
    return r


brain_models = [brain_record(m) for m in models]
set_aside_records = []
for m in set_aside_models:
    r = brain_record(m)
    r["guides"] = [{**g, "file": f"archive/set-aside-guides/{g['id']}.html"} if g["id"] in set_aside_guides else g
                   for g in guide_of_all.get(m["id"], [])]
    set_aside_records.append(r)
(PKG / "data" / "models.json").write_text(json.dumps(brain_models, indent=1, ensure_ascii=False), encoding="utf-8")
(PKG / "data" / "brands.json").write_text(json.dumps([brain_brand(b) for b in brands], indent=1, ensure_ascii=False), encoding="utf-8")
(PKG / "data" / "candidates.json").write_text(json.dumps(
    [{**c, "note": no_portal(c.get("note"))} for c in candidates], indent=1, ensure_ascii=False), encoding="utf-8")
# the shared shape groups and viewing options, for filter labels on the site
(PKG / "data" / "shapes.json").write_text(json.dumps(
    {k: shapes.get(k) for k in ("checked_on", "rule", "groups", "viewing_options")}, indent=1, ensure_ascii=False), encoding="utf-8")

# ---- archive/: kept for reference outside the brain
ARC = PKG / "archive"
ARC.mkdir(parents=True, exist_ok=True)
(ARC / "set-aside-not-for-us.json").write_text(json.dumps({
    "about": "Models the manufacturer says are not for sale in the US, set aside from the brain on Oct 8, 2026 "
             "(Ben's call). Full maker records; their guides are in archive/set-aside-guides/.",
    "models": set_aside_records}, indent=1, ensure_ascii=False), encoding="utf-8")
with open(ARC / "portal-comparison.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["model_id", "brand", "model", "portal_category", "field", "portal_value", "result", "manufacturer_value", "source", "note"])
    for m in models_all:
        for k in (m.get("verification") or {}).get("portal_check") or []:
            w.writerow([m["id"], m["brand"], m["name"], (m.get("portal") or {}).get("category"), k.get("portal_field"),
                        k.get("portal_value"), k.get("result"), k.get("manufacturer_value"), k.get("source"), k.get("note")])
(ARC / "portal-comparison.json").write_text(json.dumps({
    "about": "The old Stoveworks portal's values and how each compared with the manufacturer (checked Oct 7, 2026; "
             "corrections approved Oct 8). Kept for reference; the brain itself uses the manufacturer's information only.",
    "models": [{"id": m["id"], "brand": m["brand"], "name": m["name"], "portal": m.get("portal"),
                "check": {k: (m.get("verification") or {}).get(k) for k in ("result", "counts", "needs_recheck", "portal_check", "notes", "qa_flags")},
                "steve_uploads": m.get("steve_uploads") or []} for m in models_all],
    "brands": [{"slug": b["slug"], "name": b["name"], "listed_from": b.get("source"), "steve_uploads": b.get("steve_uploads") or []} for b in brands],
}, indent=1, ensure_ascii=False), encoding="utf-8")
shutil.copy(BUILD / "corrections.csv", ARC / "portal-corrections.csv")
if (ROOT / "verify" / "results.json").exists():
    shutil.copy(ROOT / "verify" / "results.json", ARC / "portal-spot-check.json")
shutil.copy(BUILD / "images.csv", PKG / "assets" / "images.csv")
shutil.copy(BUILD / "documents.csv", PKG / "assets" / "documents.csv")
shutil.copy(ROOT / "scripts" / "ingest-assets.mjs", PKG / "scripts" / "ingest-assets.mjs")
if (ROOT / "guides").exists():
    shutil.copytree(ROOT / "guides", PKG / "guides")
    SAG = PKG / "archive" / "set-aside-guides"
    SAG.mkdir(parents=True, exist_ok=True)
    for gid in set_aside_guides:
        for src in (PKG / "guides" / f"{gid}.html", PKG / "guides" / "content" / f"{gid}.json"):
            if src.exists():
                shutil.move(str(src), str(SAG / src.name))
guide_index = {"about": "One owner & installer guide per manual set, built from the manufacturer's newest US manual(s).",
               "guides": guide_rows}
(PKG / "guides" / "guides.json").write_text(json.dumps(guide_index, indent=1, ensure_ascii=False), encoding="utf-8")

# JSON manifests for the ingest script (one entry per unique URL)
for name in ("images", "documents"):
    rows = list(csv.DictReader(open(BUILD / f"{name}.csv", encoding="utf-8")))
    by_url = {}
    brand_of = {m["id"]: m["brand_slug"] for m in models}
    for r in rows:
        e = by_url.setdefault(r["url"], {
            "url": r["url"],
            "storage_key": r.get("storage_key") or r.get("storage_key_base"),
            "ext_hint": r.get("ext_hint", ""),
            "kind": "image" if name == "images" else "document",
            "brand_slug": brand_of.get(r["model_id"]),
            "model_ids": [],
        })
        if name == "documents":
            e.setdefault("title", r.get("title") or "")
            for field, value in (("types", r.get("type")), ("languages", r.get("language") or "en")):
                if value and value not in e.setdefault(field, []):
                    e[field].append(value)
        if r["model_id"] not in e["model_ids"]:
            e["model_ids"].append(r["model_id"])
    (PKG / "assets" / f"{name}.json").write_text(json.dumps(list(by_url.values()), indent=1, ensure_ascii=False), encoding="utf-8")

# The download list for --manuals: each model's newest US operation & installation manual(s), no accessory sheets
man_by_url = {}
for m in models:
    for k in m.get("latest_manuals") or []:
        e = man_by_url.setdefault(k["url"], {
            "url": k["url"], "storage_key": k["storage_key"], "kind": "document", "brand_slug": m["brand_slug"],
            "title": k.get("title") or "", "role": k.get("role"), "revision": k.get("revision"), "date": k.get("date"),
            "types": ["owners_manual" if k.get("role") == "operation" else "installation_manual"], "languages": ["en"],
            "configurations": [], "model_ids": [],
        })
        if k.get("configuration") and k["configuration"] not in e["configurations"]:
            e["configurations"].append(k["configuration"])
        if m["id"] not in e["model_ids"]:
            e["model_ids"].append(m["id"])
(PKG / "assets" / "manuals.json").write_text(json.dumps(list(man_by_url.values()), indent=1, ensure_ascii=False), encoding="utf-8")
n_manuals = len(man_by_url)

# Flat CSV for spreadsheet review
spec_cols = ["firebox_cu_ft", "log_length_max_in", "flue_diameter_in", "emissions_g_hr", "weight_lb", "height_in", "width_in", "depth_in", "view_area", "vent_size", "ignition"]
with open(PKG / "data" / "models.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "brand", "name", "official_name", "form", "fuel", "install_type", "venting",
                "series", "style", "shape", "shape_group", "flame_pattern", "viewing", "lineup_status", "us_availability",
                "carry_status", "guides", "manual_differences", "heating_area_sqft_max", "btu", "btu_basis", "efficiency_pct",
                "efficiency_basis", *spec_cols, "sizes", "images", "documents", "hero_image", "product_url"])
    for m in models:
        h, s = m["headline"], m["specs"]
        sh = shapes["models"].get(m["id"]) or {}
        shp, flm, vw = sh.get("shape") or {}, sh.get("flame_pattern") or {}, sh.get("viewing") or {}
        w.writerow([m["id"], m["brand"], m["name"], m["official_name"], m["form"], m["fuel"], m["install_type"], m["venting"],
                    m.get("series"), m.get("style"), shp.get("name"), shp.get("group"), flm.get("name"), "; ".join(vw.get("options") or []),
                    m["lineup_status"], m["us_availability"], m["carry_status"],
                    "; ".join(g["id"] for g in guide_of.get(m["id"], [])), len(diffs.get(m["id"], [])), h["heating_area_sqft_max"], h["btu"], h["btu_basis"], h["efficiency_pct"],
                    h["efficiency_basis"], *[s.get(c) for c in spec_cols], "; ".join(z.get("name") or "" for z in m["sizes"]),
                    len(m["images"]), len(m["documents"]), m["hero_image"], m["product_url"]])

# README with live counts
n = len(models)
avail = Counter(m["us_availability"] for m in models)
uniq_img = len({i["url"] for m in models for i in m["images"]})
uniq_doc = len({d["url"] for m in models for d in m["documents"]})
manuals = len({d["url"] for m in models for d in m["documents"] if d["type"] in ("installation_manual", "owners_manual")})
active = [b for b in brands if b.get("status") != "retired"]
brand_lines = "\n".join(f"| {b['name']} | {b['model_count']} | {b['website']} |" for b in active)
n_guides = len(guide_rows)
with_guide = sum(1 for m in models if guide_of.get(m["id"]))
n_diff = sum(len(diffs.get(m["id"], [])) for m in models)
n_diff_models = sum(1 for m in models if diffs.get(m["id"]))
_sh = [shapes["models"].get(m["id"]) or {} for m in models]
n_shape = sum(1 for x in _sh if x.get("shape"))
n_shape_mendota = sum(1 for m, x in zip(models, _sh) if x.get("shape") and m["brand_slug"] == "mendota")
n_flame = sum(1 for x in _sh if x.get("flame_pattern"))
n_view = sum(1 for x in _sh if x.get("viewing"))
group_lines = "\n".join(f"               {k:<10} {v}" for k, v in (shapes.get("groups") or {}).items())

readme = f"""# Stoveworks Brain — Brand & Model store ({VERSION})

The product catalog for the Stoveworks "brain": every model Stoveworks can sell from its
{len(active)} brands, with the manufacturer's own specs, product photos, manuals, and an owner &
installer guide per manual. Everything here comes from the manufacturers (their product pages,
spec sheets, brochures and manuals). Checked against manufacturer sources on 2026-10-07.

## What's inside

| Path | What it is |
|---|---|
| `data/models.json` | {n} model records, the source of truth (schema below) |
| `data/brands.json` | {len(active)} brands, with their websites and where the current Stoveworks site lists each |
| `data/models.csv` | Flat one-row-per-model export for spreadsheets |
| `data/candidates.json` | {len(candidates)} current models seen on manufacturer sites but not in the catalog yet (unverified) |
| `data/shapes.json` | The shared shape groups and viewing options behind the `shape` and `viewing` fields, for filter labels |
| `assets/images.json` / `.csv` | {uniq_img} unique product image URLs, mapped to models, with storage keys |
| `assets/manuals.json` | {n_manuals} manuals to download: each model's newest US operation & installation manual(s) |
| `assets/documents.json` / `.csv` | {uniq_doc} unique PDFs ({manuals} installation/owner's manuals), mapped to models |
| `scripts/ingest-assets.mjs` | Downloads the images and PDFs into a local folder or Replit Object Storage |
| `guides/` | {n_guides} owner & installer guides (one per manual set, covering {with_guide} models), their index `guides.json`, the template and the tools |
| `archive/` | Not part of the brain: models not for sale in the US (with their guides), and the old Stoveworks portal's values and how they compared with the manufacturer, kept for reference |

## Status at a glance

- {n} models from {len(active)} brands. {len(set_aside_models)} more that the maker says are not for sale in the US are set aside in `archive/set-aside-not-for-us.json` (their {len(set_aside_guides)} guides in `archive/set-aside-guides/`). US availability of the {n}: {avail.get('available', 0)} available, {avail.get('temporarily_unavailable_us', 0) + avail.get('temporarily_unavailable', 0)} temporarily unavailable, {avail.get('discontinued', 0)} discontinued, {avail.get('unclear', 0)} unclear.
- `carry_status` is `unconfirmed` on every model until Stoveworks decides what it carries.
- {with_guide} of {n} models have an owner & installer guide.
- {n_diff} places on {n_diff_models} models where the manufacturer's website and its own manual disagree are listed under `manual_differences`. The catalog shows the website's figure and the guides the manual's, each noting the other.
- {n_shape} models carry a `shape` ({n_shape_mendota} of them Mendota, from its "Find your shape" pages; the rest where the maker's own name, page or specs state one), {n_flame} carry Mendota's `flame_pattern`, and {n_view} list `viewing` options such as see-through or corner. `brands.json` → `browse` says how each fireplace maker sorts its own lineup.

| Brand | Models | Website |
|---|---|---|
{brand_lines}

## Rules this data follows

- Specs come only from the manufacturer's own pages and PDFs. Nothing is estimated; a missing
  value is `null`.
- We report everything the makers print and post (Ben, Oct 12). Where the manufacturer's website
  and its manual disagree, the catalog shows the website's figure and records the manual's under
  `manual_differences` (with the page); the guides show the manual's figure, so it matches the page
  the link opens, with the website's noted right beside it. Each difference is tagged `kind`:
  installation-safety value (clearances, gas input, venting, mobile-home approval, outside air,
  ignition) or product spec.
- Model identity follows the manufacturer's naming (LE vs LE2, CF, BV vs DV, IPI, Classic, Décor
  vs Timberline…). Series with several sizes keep one record with a `sizes[]` array.
- One exception (Ben, Oct 9): True North's website shows a single "Log Size (max.)" that is really
  the manual's ideal length, so for the TN10, TN20 stove and insert, and TN25c the catalog records
  both, `log_length_recommended_in` (the website's figure) and `log_length_max_in` (the manual's),
  and the difference stays listed with a note.
- Efficiency figures use different test bases across brands (HHV, LHV, CSA P.4.1, AFUE, steady
  state). Always show `efficiency_basis` next to the number; don't compare across bases.
- Shapes and flame patterns use the maker's own words. A model gets a shape only where the maker
  states one (Mendota's shape pages, or another maker's model name, product page or published
  specs); nothing is judged from photos, and front or door options (an arched screen front,
  arched or rectangular doors) are options, not the model's shape. `shape.group` folds the makers'
  words into one cross-brand set for filters.
- No prices are stored.

## Model record (key fields)

```
id, brand, brand_slug, name, official_name, model_numbers[]
form           stove | insert | fireplace | cook_stove | outdoor_fireplace
fuel           wood | gas | electric | pellet
install_type   freestanding | insert | zero_clearance | masonry | outdoor
venting        chimney | direct_vent | b_vent | vent_free | none
series         the maker's product family (Bellingham, ML-Series, Green Mountain Family…)
style          broad look for filters: traditional | transitional | contemporary | rustic
               (assigned during research; not a maker term, unlike shape and flame_pattern)
shape          the maker's own shape word, where it states one, else null:
               name (Classic Arch, Landscape, Tall Linear, Widescreen…), group, basis, source
               group, for cross-brand filters (labels in data/shapes.json):
{group_lines}
flame_pattern  Mendota's flame pattern, else null: name (Traditional | FireIn | Timberline | Décor),
               source, note (e.g. a Timberline fireplace Mendota also sells as the Décor)
viewing        where the maker states it, else null: options (single_sided | see_through | corner |
               three_sided | indoor_outdoor), basis, source
lineup_status  current | discontinued | unclear            (manufacturer's lineup)
us_availability available | temporarily_unavailable_us | temporarily_unavailable | discontinued | unclear
               (models not for sale in the US are set aside in archive/)
availability_evidence  what the availability call rests on
carry_status   unconfirmed                                 (set by Stoveworks, never inferred)
headline       heating_area_sqft_max, btu + btu_basis, efficiency_pct + efficiency_basis,
               log_length_max_in, burn_time_hr_max        (for grids and the "verdict number")
specs          normalized numbers in fixed units (BTU/hr, sq ft, in, lb, cu ft, g/hr, %)
sizes[]        per-size specs for series records
specs_raw[]    every published label/value exactly as the manufacturer printed it, with source URL
images[]       url, role (primary_cutout | cutout | lifestyle | detail | line_drawing | other), variant, alt
hero_image     best single image URL (cutout first, then lifestyle)
documents[]    type (installation_manual | owners_manual | spec_sheet | brochure | epa_report | parts_list | warranty), url, language
latest_manuals[] the newest US operation & installation manual(s): url, storage_key, role, configuration, revision, date
guides[]       the owner & installer guide(s) for this model, one per configuration where versions have
               their own manuals: id, title, configuration, file, manuals[] (storage key, label, revision)
manual_differences[] field, kind, website (the catalog's figure), manual (the manual's figure), manual_page, guide, rule,
               note (where another maker document, such as a newer brochure, sides with one of them)
sources[]      the manufacturer pages and PDFs the record was checked against
checked_on     date of the check
```

## Brand record (key fields)

```
slug, name, website, about, model_count, categories, current_site_lists
browse         how the maker sorts its fireplaces on its own site (null where not checked):
               sorts_by (one or two sentences), sources[]; for Mendota also shapes[] and
               flame_patterns[] (name, group, about in our words, url), the basis for a
               "Find your shape" browse on the site
```

## Downloading the manuals and photos

The package lists every image and PDF by URL; `scripts/ingest-assets.mjs` downloads them, either
into a local folder or into Replit Object Storage.

**Into a local folder** (run from your own terminal in the site project, because the
manufacturers' sites must be reachable):

```
node brain/scripts/ingest-assets.mjs --manuals --out var/brain-assets   # newest US manual(s) per model
node brain/scripts/ingest-assets.mjs --documents --out var/brain-assets # every PDF
node brain/scripts/ingest-assets.mjs --images --out var/brain-assets    # product photos
```

`--manuals` downloads exactly the {n_manuals} files in `assets/manuals.json`: each model's newest
US-edition operation & installation manual(s), one per configuration where versions have their own
manuals. No older revisions, Canadian or French editions, or accessory sheets. Files land at
`var/brain-assets/<storage key>` (e.g. `documents/jotul/…pdf`), the same keys the catalog uses, so
moving them into object storage later is a straight copy. `var/` is git-ignored.

**Into Replit Object Storage** (object storage enabled on the Repl):

```
npm install @replit/object-storage
node scripts/ingest-assets.mjs            # images + documents
node scripts/ingest-assets.mjs --manuals  # manuals only
```

Either way it skips files already saved, retries politely on rate limits, rejects anything that
isn't really an image or a PDF, and records progress, so re-running only fetches what's missing.
`--brand jotul`, `--lang all`, `--limit N` and `--dry-run` narrow a run.

**Image rights:** these are the manufacturers' photos. Authorized dealers can normally use them
under their dealer agreement; for the best quality, use the brands' dealer media libraries where
Stoveworks has a login.

## Owner & installer guides

`guides/` has {n_guides} guides, one per manual set: models that share a manual share a guide, and
a model sold in versions with their own manuals gets one guide per version. Each is one
self-contained HTML page with an "I own it" path (plain-language answers) and an "I install it"
path (specs, install sequence, faults, codes), search across the full manual, and links that open
the official PDF at the exact page.

- **Built from:** a shared template (`guides/template/`) plus a content file per guide
  (`guides/content/<id>.json`). Rebuild with `python3 guides/tools/build_guide.py <id>` or `--all`.
- **Checked:** every guide passes the build, the QA harness (`guides/qa-guide.js`), a number check
  (every number in the guide appears in its manual, or on the maker's website where a note quotes
  it), a browser test and a phone check.
- **Differences (Ben, Oct 12: report everything):** where a manual disagrees with itself, the guide
  shows both figures in a plain "Note:" at that spot, with the pages. Where the maker's website
  differs, a small "Maker's website:" note gives its figure next to the manual's. Plain misprints
  (a metric figure that doesn't match its inch figure, a part number the parts list settles) are
  corrected, with a small note saying what was printed. Each page ends with a short explanation.
  Each content file's `review` block records every one, classed substantive, clerical or
  not_a_conflict; `guides.json` has the counts per guide.
- **Serving:** PDF links point to `../../var/brain-assets/<storage key>`. Point `MANUAL_BASE` at
  wherever the manuals are stored, served inline as `application/pdf` so `#page=N` opens the page.
- `guides.json` lists every guide with its models, manuals and revision.

## Loading into the database

Suggested tables: `brands` (from brands.json), `models` (id, brand_slug, the classification fields,
headline fields as columns, `specs`/`sizes`/`specs_raw`/`manual_differences` as JSON), `model_images`
(model_id, url, storage_key, role, variant, sort), `documents` (url, storage_key, type, title,
language) with a `model_documents` join (many models share one manual), and `guides` (from
guides.json) with a `model_guides` join (a model can have one guide per configuration). Keep `carry_status` editable by Stoveworks staff.
"""
(PKG / "README.md").write_text(readme, encoding="utf-8")

shutil.make_archive(str(ROOT / "package" / "stoveworks-brain"), "zip", ROOT / "package", "stoveworks-brain")
print("package written:", PKG)
for p in sorted(PKG.rglob("*")):
    if p.is_file():
        print(f"  {p.relative_to(PKG)}  {p.stat().st_size/1024:.0f} KB")
print("zip:", (ROOT / "package" / "stoveworks-brain.zip").stat().st_size // 1024, "KB")
