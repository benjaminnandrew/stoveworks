"""Build owner & installer guides from their content files.

    python3 scripts/build_guide.py <guide id> [<guide id> ...]
    python3 scripts/build_guide.py --all
    options: --manual-base <url or relative path>   where the PDFs are served
             (default ../../var/brain-assets/, i.e. the download folder next to brain/)
             --check   validate only, don't write

Each guide = guides/template/guide-template.html (logic, styles, page shell — identical in every
guide) + guides/content/<id>.json (the plain-language content) + the plan entry in
build/guide_plan.json (which manual PDFs the guide is built from) + those manuals' page text.
Writes guides/<id>.html.
"""
import datetime
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "guides" / "template" / "guide-template.html"
ICONS = ROOT / "guides" / "template" / "icons.json"
PLAN = ROOT / "build" / "guide_plan.json"
CONTENT = ROOT / "guides" / "content"
OUT = ROOT / "guides"
DEFAULT_BASE = "../../var/brain-assets/"

ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
ALLOWED_TAGS = {"p", "h4", "ol", "ul", "li", "div", "span", "b", "strong", "i", "em", "br", "small", "sup", "sub"}
PAIRED = ["p", "h4", "ol", "ul", "li", "div", "span", "b", "strong", "i", "em", "small", "sup", "sub"]

DEFAULTS = {
    "gas": ("lighting, pilot flame, glass, gas smell", "orifice, clearance, pressure"),
    "wood": ("starting a fire, air control, ash, glass", "clearance, chimney, hearth pad"),
    "electric": ("heat settings, remote, flame colors", "circuit, clearance, mounting"),
}


class Bad(Exception):
    pass


def load_plan():
    return {u["id"]: u for u in json.load(open(PLAN, encoding="utf-8"))["units"]}


CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_page(t, ocr=False):
    t = CTRL.sub(" ", t)
    if ocr:
        t = re.sub(r"[ \t]{2,}", " ", t)
    t = "\n".join(line.rstrip() for line in t.splitlines())
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def page_texts(doc):
    src = doc["layout_path"] if doc["text_source"] == "ocr" else doc["raw_path"]
    pages = json.load(open(ROOT / src, encoding="utf-8"))
    return [clean_page(p["t"], ocr=doc["text_source"] == "ocr") for p in pages]


def check_html(where, s, errs):
    if re.search(r"<\s*script|\son\w+\s*=|javascript:", s, re.I):
        errs.append(f"{where}: no scripts or event handlers in drawer html")
    if re.search(r"https?://", s):
        errs.append(f"{where}: no web links in drawer html (the manual deep link is added automatically)")
    for tag in re.findall(r"<\s*/?\s*([a-zA-Z0-9]+)", s):
        if tag.lower() not in ALLOWED_TAGS:
            errs.append(f"{where}: tag <{tag}> isn't part of the guide's building blocks ({', '.join(sorted(ALLOWED_TAGS))})")
            break
    for tag in PAIRED:
        opened = len(re.findall(rf"<{tag}(\s[^>]*)?>", s, re.I))
        closed = len(re.findall(rf"</{tag}\s*>", s, re.I))
        if opened != closed:
            errs.append(f"{where}: {opened} <{tag}> vs {closed} </{tag}>")
    if "${" in s:
        errs.append(f"{where}: '${{' isn't allowed in html")


def is_text(v):
    return isinstance(v, str) and v.strip() != ""


def validate(c, unit, icons, page_counts):
    errs = []
    need = ["brand_mark", "brand_line", "kicker", "title", "model_line", "owner_noun", "owner_card", "installer_card"]
    shell = c.get("shell") or {}
    for k in need:
        if not is_text(shell.get(k)):
            errs.append(f"shell.{k} is required")
    tiles = (c.get("home_primary") or []) + (c.get("home_secondary") or [])
    if len(c.get("home_primary") or []) < 2:
        errs.append("home_primary needs at least 2 tiles")
    for t in tiles:
        for k in ("id", "icon", "title", "blurb"):
            if not is_text(t.get(k)):
                errs.append(f"tile {t.get('id')}: '{k}' is required")
        if t.get("icon") and t["icon"] not in icons and not str(t["icon"]).startswith("M"):
            errs.append(f"tile {t.get('id')}: unknown icon '{t['icon']}' (use a name from guides/template/icons.json)")
    specs = c.get("specs") or []
    if len(specs) < 3:
        errs.append("specs needs at least 3 cards")
    for s in specs:
        for k in ("id", "lab", "tap"):
            if not is_text(s.get(k)):
                errs.append(f"spec {s.get('id')}: '{k}' is required")
        rows = s.get("rows")
        if not rows or not all(isinstance(r, list) and len(r) == 2 and all(is_text(x) for x in r) for r in rows):
            errs.append(f"spec {s.get('id')}: rows must be [label, value] pairs of text")
    steps = c.get("steps") or []
    if len(steps) < 3:
        errs.append("steps needs at least 3 install steps")
    for i, s in enumerate(steps):
        if not (isinstance(s, list) and len(s) in (2, 3) and all(is_text(x) for x in s)):
            errs.append(f"steps[{i}] must be [title, text] or [title, text, drawer html]")
        elif len(s) == 3:
            check_html(f"steps[{i}] html", s[2], errs)
    for i, cd in enumerate(c.get("codes") or []):
        if not (isinstance(cd, list) and len(cd) == 3 and (isinstance(cd[0], int) or is_text(cd[0])) and is_text(cd[1]) and isinstance(cd[2], str)):
            errs.append(f"codes[{i}] must be [blink count or code text, title, description]")
    f = c.get("faults")
    if f is not None:
        panels = f.get("panels") if isinstance(f, dict) else None
        if not panels or not (1 <= len(panels) <= 4):
            errs.append("faults.panels must hold 1-4 panels (or set faults to null)")
        else:
            for p in panels:
                if not is_text(p.get("title")) or not p.get("items") or not all(is_text(x) for x in p["items"]):
                    errs.append("each fault panel needs a title and a list of items")
    detail = c.get("detail") or {}
    for k, d in detail.items():
        if not ID_RE.match(k):
            errs.append(f"detail key '{k}' must be letters/digits/underscore, starting with a letter")
        if re.fullmatch(r"step\d+", k):
            errs.append(f"detail key '{k}' is reserved for the generated step drawers")
        for kk in ("tag", "title", "html"):
            if not is_text(d.get(kk)):
                errs.append(f"detail.{k}: '{kk}' is required")
        if not isinstance(d.get("cool"), bool):
            errs.append(f"detail.{k}: 'cool' must be true (installer) or false (owner)")
        if is_text(d.get("html")):
            check_html(f"detail.{k}", d["html"], errs)
    ids = [t.get("id") for t in tiles]
    for i in ids:
        if ids.count(i) > 1:
            errs.append(f"duplicate tile id '{i}'")
            break
    for i in ids:
        if i and i not in detail:
            errs.append(f"tile '{i}' has no detail entry")
    for s in specs:
        if s.get("tap") and s["tap"] not in detail:
            errs.append(f"spec tap '{s['tap']}' has no detail entry")
    drawers = set(detail) | {f"step{i}" for i in range(len(steps))}
    n_docs = len(page_counts)
    for k, v in (c.get("pageref") or {}).items():
        if k not in drawers:
            errs.append(f"pageref '{k}' doesn't match a drawer")
            continue
        d, p = (v[0], v[1]) if isinstance(v, list) and len(v) == 2 else (1, v)
        if not (isinstance(d, int) and 1 <= d <= n_docs):
            errs.append(f"pageref '{k}': manual {d} doesn't exist (this guide has {n_docs})")
        elif not (isinstance(p, int) and 1 <= p <= page_counts[d - 1]):
            errs.append(f"pageref '{k}': page {p} is outside manual {d} (1-{page_counts[d - 1]})")
    for x in c.get("index_extra") or []:
        if x.get("k") not in ("h", "i") or x.get("id") not in drawers or not is_text(x.get("t")):
            errs.append(f"index_extra entry {x} needs k 'h'|'i', a drawer id and a term t")
    if errs:
        raise Bad("\n  ".join(errs))


def js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def rev_display(doc):
    r = re.sub(r"\s*\(.*?\)", "", doc.get("revision") or "").strip()
    return r


def build(gid, plan, icons, base, write=True):
    unit = plan.get(gid)
    if not unit:
        raise Bad(f"'{gid}' isn't in build/guide_plan.json")
    cpath = CONTENT / f"{gid}.json"
    if not cpath.exists():
        raise Bad(f"no content file guides/content/{gid}.json")
    try:
        c = json.load(open(cpath, encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise Bad(f"guides/content/{gid}.json isn't valid JSON: {e}")
    docs = unit["docs"]
    texts = [page_texts(d) for d in docs]
    validate(c, unit, icons, [len(t) for t in texts])

    def tile(t):
        out = dict(t)
        ic = icons.get(t["icon"])
        if ic:
            out["icon"] = ic["d"]
            out.setdefault("fill", bool(ic.get("fill")))
        if not out.get("fill"):
            out.pop("fill", None)
        return out

    multi = len(docs) > 1
    shell = c["shell"]
    fuel = "electric" if unit["fuel"] == "electric" else ("wood" if unit["fuel"] == "wood" else "gas")
    oh, mh = DEFAULTS[fuel]
    manuals = [{"n": d["n"], "label": d["label"], "short": d["short"], "url": d["storage_key"],
                "pages": len(texts[i]), "role": d["role"], "kit": d["integral_kit"], "revision": rev_display(d)}
               for i, d in enumerate(docs)]
    cert = f" ({html.escape(shell['certification'])})" if is_text(shell.get("certification")) else ""
    if multi:
        links = " · ".join(f'<a href="#" class="footdoc" data-doc="{m["n"]}">{html.escape(m["label"])}</a>' for m in manuals)
        foot = f'Both paths draw from the same certified manuals{cert}. <span class="docs">Open the full PDFs: {links}</span>'
    else:
        foot = f'Both paths draw from the same certified manual{cert}. <a href="#" id="pdfBtn2" class="footdoc" data-doc="1">Skip straight to the full PDF →</a>'
    # small print shown at the bottom of every view (Ben, Oct 8; "report everything", Oct 12)
    fine = ("<b>About these guides.</b> Manufacturers revise their manuals over the years, and a "
            "manual sometimes disagrees with itself or with the maker's website. We report what is "
            "printed and posted: where two figures differ, we show both right there, with links to "
            "the pages, and where the maker's website gives a different figure, we note it next to "
            "the manual's. Plain misprints, such as a metric conversion that doesn't match, are "
            "corrected with a small note saying what was printed. The official manual is the "
            "authority for installation; when two figures differ, ask us or your installer before "
            "relying on either.")
    pages = [{"d": i + 1, "p": j + 1, "t": t} for i, tx in enumerate(texts) for j, t in enumerate(tx)]
    built_from = "; ".join(f"{d['storage_key'].split('/')[-1]}" + (f" ({rev_display(d)})" if rev_display(d) else "") for d in docs)
    e = html.escape
    tokens = {
        "PAGE_TITLE": e(shell.get("page_title") or f"{shell['title']} — Owner & Installer Guide"),
        "GENERATED": e(f"built {datetime.date.today().isoformat()} from {built_from}").replace("--", "–"),
        "GUIDE_ID": gid,
        "BRAND_MARK": e(shell["brand_mark"]),
        "BRAND_LINE": e(shell["brand_line"]),
        "KICKER": e(shell["kicker"]),
        "TITLE": e(shell["title"]),
        "MODEL_LINE": e(shell["model_line"]),
        "OWNER_NOUN": e(shell["owner_noun"]),
        "OWNER_CARD": e(shell["owner_card"]),
        "INSTALLER_CARD": e(shell["installer_card"]),
        "FOOT": foot,
        "FINE": fine,
        "PDF_TITLE": e(f"The full {manuals[0]['pages']}-page manual is the legal source of truth" if not multi
                       else "The official manuals are the legal source of truth"),
        "PDF_BUTTON": "Official PDFs" if multi else "Official PDF",
        "PDF_WORD": "PDFs" if multi else "PDF",
        "MANUAL_WORD": "manuals" if multi else "manual",
        "OWNER_SEARCH_PH": e(f"Search — {shell.get('owner_search_hint') or oh}…"),
        "MANUAL_SEARCH_PH": e(f"Search every page of the official {'manuals' if multi else 'manual'} — {shell.get('manual_search_hint') or mh}…"),
        "SPECS_LABEL": e(c.get("specs_label") or "Critical specs"),
        "STEPS_LABEL": e(c.get("steps_label") or "Install sequence — tap to check off"),
        "CODES_LABEL": e(c.get("codes_label") or "Control codes"),
        "HOME_PRIMARY": js([tile(t) for t in c["home_primary"]]),
        "HOME_SECONDARY": js([tile(t) for t in c.get("home_secondary") or []]),
        "SPECS": js([{k: v for k, v in s.items() if k in ("id", "lab", "tap", "rows", "note") and v} for s in c["specs"]]),
        "STEPS": js(c["steps"]),
        "CODES": js(c.get("codes") or []),
        "FAULTS": js(c.get("faults")),
        "DETAIL": js({k: {"tag": d["tag"], "title": d["title"], "cool": d["cool"], "html": d["html"]} for k, d in c["detail"].items()}),
        "PAGEREF": js(c.get("pageref") or {}),
        "INDEX_EXTRA": js(c.get("index_extra") or []),
        "MANUAL_BASE": js(base),
        "MANUALS": js(manuals),
        "PAGES": js(pages),
    }
    out = TEMPLATE.read_text(encoding="utf-8")
    for k, v in tokens.items():
        out = out.replace("{{" + k + "}}", v)
    left = re.findall(r"\{\{[A-Z0-9_]+\}\}", out)
    if left:
        raise Bad(f"template tokens not filled: {sorted(set(left))}")
    path = OUT / f"{gid}.html"
    if write:
        path.write_text(out, encoding="utf-8")
    return path


def main(argv):
    base = DEFAULT_BASE
    write = True
    ids = []
    it = iter(argv)
    for a in it:
        if a == "--manual-base":
            base = next(it)
        elif a == "--check":
            write = False
        elif a == "--all":
            ids = None
        else:
            if ids is not None:
                ids.append(a)
    plan = load_plan()
    icons = {k: v for k, v in json.load(open(ICONS, encoding="utf-8")).items() if not k.startswith("_")}
    if ids is None:
        ids = sorted(p.stem for p in CONTENT.glob("*.json") if p.stem in plan)
    if not ids:
        print(__doc__)
        return 2
    failed = 0
    for gid in ids:
        try:
            p = build(gid, plan, icons, base, write)
            print(f"OK   {gid}" + (f" -> {p.relative_to(ROOT)}" if write else " (valid)"))
        except Bad as e:
            failed += 1
            print(f"FAIL {gid}\n  {e}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
