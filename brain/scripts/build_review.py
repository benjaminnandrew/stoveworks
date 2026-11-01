"""Build the catalog review page (single self-contained HTML) from build/ outputs."""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "review" / "catalog-review.html"
BUILD = ROOT / "build"

PKGDATA = ROOT / "package" / "stoveworks-brain" / "data"   # the brain: manufacturer information only
models = json.load(open(PKGDATA / "models.json", encoding="utf-8"))
brands = json.load(open(PKGDATA / "brands.json", encoding="utf-8"))
candidates = json.load(open(PKGDATA / "candidates.json", encoding="utf-8"))
plan = {u["id"]: u for u in json.load(open(BUILD / "guide_plan.json", encoding="utf-8"))["units"]}


def page_label(gid, pg):
    if pg is None:
        return ""
    d, n = (pg if isinstance(pg, list) and len(pg) == 2 else (1, pg))
    docs = plan.get(gid, {}).get("docs") or []
    if len(docs) > 1:
        lab = (docs[d - 1].get("label") or "") if 0 < d <= len(docs) else ""
        short = "Owner's" if "owner" in lab.lower() else "Install"
        return f"{short} p. {n}"
    return f"p. {n}"

ROLE_ORDER = ["primary_cutout", "cutout", "lifestyle", "detail", "line_drawing", "other"]
DOC_ORDER = ["installation_manual", "owners_manual", "spec_sheet", "brochure", "epa_report", "parts_list", "warranty", "other"]


def trim(s, n):
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def compact(m):
    specs = {k: v for k, v in m["specs"].items() if v is not None}
    imgs = sorted(m["images"], key=lambda i: ROLE_ORDER.index(i.get("role")) if i.get("role") in ROLE_ORDER else 9)
    docs = sorted(m["documents"], key=lambda d: DOC_ORDER.index(d.get("type")) if d.get("type") in DOC_ORDER else 9)
    return {
        "id": m["id"], "b": m["brand"], "bs": m["brand_slug"], "n": m["name"], "on": m["official_name"],
        "mn": m["model_numbers"], "form": m["form"], "fuel": m["fuel"], "inst": m["install_type"], "vent": m["venting"],
        "avail": m["us_availability"], "an": m["availability_note"], "ev": trim(m.get("availability_evidence"), 700),
        "h": m["headline"], "s": specs,
        "sz": [{"n": z.get("name"), "s": {k: val for k, val in (z.get("specs") or {}).items() if val is not None}} for z in m["sizes"]],
        "g": [{"id": g["id"], "t": g["title"], "c": g.get("configuration"),
               "d": [f"{d.get('label') or 'Manual'}: {d['storage_key'].split('/')[-1]}" + (f" ({d['revision']})" if d.get("revision") else "")
                     for d in g["manuals"]]} for g in m.get("guides") or []],
        "md": [{"f": x["field"], "w": trim(str(x.get("website") or ""), 160), "m": trim(str(x.get("manual") or ""), 220),
                "p": page_label(x.get("guide"), x.get("manual_page")), "s": (x.get("kind") or x["rule"]).startswith("installation"), "b": x["rule"].startswith("recorded both"), "n": x.get("note")}
               for x in m.get("manual_differences") or []],
        "sh": ({"n": m["shape"]["name"], "g": m["shape"]["group"], "b": m["shape"].get("basis"), "u": m["shape"].get("source")}
               if m.get("shape") else None),
        "fl": ({"n": m["flame_pattern"]["name"], "u": m["flame_pattern"].get("source"), "nt": m["flame_pattern"].get("note")}
               if m.get("flame_pattern") else None),
        "vw": ({"o": m["viewing"]["options"], "b": m["viewing"].get("basis"), "u": m["viewing"].get("source")}
               if m.get("viewing") else None),
        "url": m["product_url"], "hero": m["hero_image"],
        "im": [{"r": i.get("role"), "u": i["url"], "v": i.get("variant"), "a": trim(i.get("alt"), 80)} for i in imgs[:16]],
        "imn": len(m["images"]), "imr": dict(Counter(i.get("role") for i in m["images"])),
        "dc": [{"t": d.get("type"), "ti": trim(d.get("title"), 90), "u": d["url"], "l": d.get("language")} for d in docs[:14]],
        "dcn": len(m["documents"]),
    }


data = {
    "checked": "2026-10-07",
    "models": [compact(m) for m in models],
    "brands": [{"slug": b["slug"], "name": b["name"], "web": b["website"], "n": b["model_count"], "cats": b["categories"],
                "site": b["current_site_lists"], "status": b.get("status"),
                "about": trim(b.get("about"), 420), "bw": b.get("browse")} for b in brands],
    "shapes": json.load(open(PKGDATA / "shapes.json", encoding="utf-8")) if (PKGDATA / "shapes.json").exists() else {},
    "cand": [{"b": c.get("brand"), "n": c.get("name"), "u": c.get("url"), "c": c.get("category"), "nt": trim(c.get("note"), 220)} for c in candidates],
    "stats": {
        "photos": len({i["url"] for m in models for i in m["images"]}),
        "guides": len({g["id"] for m in models for g in m.get("guides") or []}),
        "docs": len({d["url"] for m in models for d in m["documents"]}),
        "manuals": len({d["url"] for m in models for d in m["documents"] if d.get("type") in ("installation_manual", "owners_manual")}),
    },
}
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

TEMPLATE = Path(ROOT / "scripts" / "review_template.html").read_text(encoding="utf-8")
html = TEMPLATE.replace("/*__DATA__*/null", payload)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB, data {len(payload)/1024:.0f} KB)")
