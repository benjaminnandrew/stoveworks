"""Buechel Stone building-stone veneers: clean product data for Hearth Studio.

Reads what was collected from buechelstone.com (see BUILD-NOTES, "Stone catalog"):
  catalog/raw_all.jsonl    one product page per line: name, collection, geology, colors, sizes, veneer, spec link
  catalog/spec_all.jsonl   the product's spec sheet (PDF): sizes and coverage for full and thin veneer
  catalog/tone_<x>.txt     the names Buechel files under each color tone (its own "color tone" listings)
Writes build/catalog_src.json: one record per veneer, data only (gen_stone.py adds the sample textures).

Nothing here is invented: every name, color word, size, stone type and coverage figure comes from those
sources. Where a source says nothing, the field is null and the app says so. Sizes are rewritten into one
short readable line, coverage is copied as printed.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CAT = sys.argv[1] if len(sys.argv) > 1 else (os.path.join(HERE, "catalog") if os.path.isdir(os.path.join(HERE, "catalog")) else "/home/claude/catalog")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "catalog_src.json")

TONES = ["Arctic", "Earth", "Fiery", "Honey", "Shadow", "Sky"]
STYLE_ORDER = ["Ledgestone", "Fieldledge", "Tailored Fieldledge", "Ashlar", "Castle Rock", "Dimensional", "Mosaic"]
# the part of a product name that names the cut; what's left names the stone ("Black Frost", "Chilton")
CUTS = ["Tailored Blend 50% Rockfaced", "Shabby-Chic Tailored Blend", "Tailored Fieldledge", "Tailored Blend",
        "Country Squire Jumpers", "Country Squire", "Country Castle Rock", "Castle Rock", "Custom Country Blend",
        "Kensington Blend", "Cambrian Blend", "Heritage Blend", "Colonial Blend", "Pioneer Blend", "Rustic Ledgestone",
        "Rustic No Reds", "Sedona Rustic", "Rustic", "Ledgestone", "Ashlar", "Siena", "Webwall", "Fieldstone",
        "River Rock", "Dimensional", "Splitface", "Cross"]

# Product pages that came back without their labels (checked by hand, Oct 2026). The collection follows
# from the product name; the stone type is what the page's own description says, or unknown.
FIXES = {
    "black-frost-castle-rock": dict(collection="Castle Rock", geology="Fine-grained sandstone",
        note="Buechel's page shows no collection or geology labels; 'finely grained sandstone' is from its description. No spec sheet link."),
    "black-frost-tailored-fieldledge": dict(collection="Tailored Fieldledge", geology="Fine-grained sandstone", veneer="thin",
        note="Buechel's page shows no collection or geology labels; 'finely grained sandstone' is from its description. No spec sheet link."),
    "oiled-nubuck-castle-rock": dict(collection="Castle Rock", geology=None,
        note="Buechel's page shows no collection, geology or spec sheet."),
}

GEOLOGY = {"dolomitic limestone": "Dolomitic limestone", "quartzitic sandstone": "Quartzitic sandstone", "schist": "Schist",
           "limestone": "Limestone", "sandstone": "Sandstone", "granite": "Granite",
           "gneiss (type of granite)": "Gneiss (a type of granite)",
           "quartzitic sandstone, schist": "Quartzitic sandstone and schist", "fine-grained sandstone": "Fine-grained sandstone"}


def norm_name(s):
    s = s.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def q(s):
    """Inch marks and spacing as one style."""
    if s is None:
        return None
    s = s.replace("”", '"').replace("″", '"').replace("“", '"').replace("’", "'")
    return re.sub(r"\s+", " ", s).strip()


def inches(t):
    """'2-1/4"' -> 2.25, '1/2' -> 0.5, '10' -> 10."""
    t = t.strip().rstrip('"').rstrip("'").strip()
    m = re.fullmatch(r"(\d+)-(\d+)/(\d+)", t)
    if m:
        return int(m[1]) + int(m[2]) / int(m[3])
    m = re.fullmatch(r"(\d+)/(\d+)", t)
    if m:
        return int(m[1]) / int(m[2])
    m = re.fullmatch(r"(\d+(?:\.\d+)?)", t)
    return float(m[1]) if m else None


NUM = r"\d+(?:-\d+/\d+|/\d+)?(?:\.\d+)?"


def dim(s):
    """One printed dimension -> {kind, text, lo, hi, typ, vals}. kind: range | list | dia."""
    s = q(s)
    if not s:
        return None
    typ = None
    m = re.search(r"\((" + NUM + r")[\"']?\+?\)", s)
    if m:
        typ = inches(m[1])
    body = re.sub(r"\(.*?\)", "", s).replace("can be longer", "").strip()
    dia = "dia" in body
    body = body.replace("dia.", "").replace("dia", "").strip()
    flat = re.sub(r"\s*,?\s*&\s*", ", ", body)
    if ";" in body or re.fullmatch(r"(" + NUM + r"\"?\s*,\s*)+" + NUM + r"\"?", flat):
        vals = [v.strip() for v in re.split(r";|,|&", body) if v.strip()]
        nums = [inches(v) for v in vals]
        if all(n is not None for n in nums):
            return dict(kind="list", vals=[fmt_in(n) for n in nums], nums=nums, typ=typ)
    m = re.search(r"(" + NUM + r")[\"']?\s*(?:to|up to|-|–)\s*(" + NUM + r")\"?", body)
    if m:
        lo, hi = inches(m[1]), inches(m[2])
        return dict(kind="dia" if dia else "range", lo=lo, hi=hi, typ=typ)
    return None


def fmt_in(x):
    """2.25 -> '2-1/4"', 0.5 -> '1/2"'."""
    whole = int(x)
    frac = round((x - whole) * 8) / 8
    names = {0.125: "1/8", 0.25: "1/4", 0.375: "3/8", 0.5: "1/2", 0.625: "5/8", 0.75: "3/4", 0.875: "7/8"}
    if frac == 0:
        return f'{whole}"'
    return f'{names[frac]}"' if whole == 0 else f'{whole}-{names[frac]}"'


def rng_txt(d):
    if d["kind"] == "list":
        v = d["vals"]
        return ", ".join(v[:-1]) + " and " + v[-1] if len(v) > 1 else v[0]
    return f'{fmt_in(d["lo"])}–{fmt_in(d["hi"])}'


def size_line(thin, full, page):
    """One readable line, thin veneer first (what most fireplaces get), full veneer only where it differs."""
    base = thin or full
    if not base:
        return None
    H, L = dim(base.get("height")), dim(base.get("length"))
    fH = dim(full.get("height")) if (full and thin) else None
    fL = dim(full.get("length")) if (full and thin) else None
    if H and H["kind"] == "dia":
        line = f"Pieces {rng_txt(H)} across"
        if fH and fH["kind"] == "dia" and fH["hi"] != H["hi"]:
            line += f" (full veneer up to {fmt_in(fH['hi'])})"
        return line
    parts = []
    if H:
        if H["kind"] == "list":
            parts.append(f"Sawn heights {rng_txt(H)}")
        else:
            t = f"Heights {rng_txt(H)}"
            if fH and fH["kind"] == "range" and fH["hi"] != H["hi"]:
                t += f" (full veneer up to {fmt_in(fH['hi'])})"
            parts.append(t)
    if L and L["kind"] == "range":
        t = f"lengths {rng_txt(L)}"
        if fL and fL["kind"] == "range" and fL["hi"] != L["hi"]:
            t += f" (full veneer up to {fmt_in(fL['hi'])})"
        parts.append(t)
    return ", ".join(parts) if parts else None


def page_size_line(r):
    """For the few products with no spec sheet: the product page's own sizes."""
    H, L = q(r.get("heights")), q(r.get("lengths"))
    hd = dim(H) if H else None
    ld = None
    if L:
        m = re.search(r"thin\s+(" + NUM + r"\"?\s*(?:to|up to)\s*" + NUM + r"\"?)", L)
        ld = dim(m[1] if m else L)
    parts = []
    if hd:
        parts.append(("Sawn heights " if hd["kind"] == "list" else "Heights ") + rng_txt(hd))
    if ld:
        parts.append("lengths " + rng_txt(ld))
    return ", ".join(parts) if parts else None


def gen_dims(thin, full, page):
    """Numbers the texture generator needs (inches): heights, lengths, piece sizes. Thin veneer first."""
    base = thin or full or {}
    H, L = dim(base.get("height")), dim(base.get("length"))
    if not H and page:
        H = dim(q(page.get("heights"))) if page.get("heights") else None
        if page.get("lengths"):
            Ls = q(page["lengths"]); m = re.search(r"thin\s+(" + NUM + r"\"?\s*(?:to|up to)\s*" + NUM + r"\"?)", Ls)
            L = dim(m[1] if m else Ls)
    out = {}
    if H:
        if H["kind"] == "list":
            out["heights"] = H["nums"]
        elif H["kind"] == "dia":
            out["pieces"] = [H["lo"], H["hi"]]
        else:
            out["height"] = [H["lo"], H["hi"]]
    if L and L["kind"] == "range":
        out["length"] = [L["lo"], L["hi"]] + ([L["typ"]] if L.get("typ") else [])
    return out


def colors_clean(words):
    out, seen = [], set()
    for w in words or []:
        w = re.sub(r"\s+", " ", w).strip().rstrip(".")
        k = w.lower()
        if w and k not in seen:
            seen.add(k); out.append(w)
    return out


def family_of(name):
    for c in CUTS:
        if name.endswith(" " + c):
            return name[: -len(c) - 1], c
    return name, None


def main():
    rows = [json.loads(l) for l in open(os.path.join(CAT, "raw_all.jsonl"))]
    spec = {json.loads(l)["slug"]: json.loads(l) for l in open(os.path.join(CAT, "spec_all.jsonl"))}
    by_name = {norm_name(r["name"]): r["slug"] for r in rows}
    tones = {}
    for t in TONES:
        for n in open(os.path.join(CAT, f"tone_{t.lower()}.txt")):
            s = by_name.get(norm_name(n.strip()))
            if s:
                tones.setdefault(s, set()).add(t)
    out = []
    for r in rows:
        slug = r["slug"]; fx = FIXES.get(slug, {})
        sp = spec.get(slug) or {}
        thin, full = sp.get("thin"), sp.get("full")
        notes = [fx["note"]] if fx.get("note") else []
        if sp.get("note"):
            notes.append("Spec sheet: " + sp["note"])
        collection = fx.get("collection", r.get("collection"))
        geo = fx["geology"] if "geology" in fx else r.get("geology")
        stone_type = GEOLOGY.get((geo or "").lower(), geo) if geo else None
        if sp:
            veneer = "both" if (thin and full) else "thin" if thin else "full" if full else None
        else:
            veneer = fx.get("veneer", r.get("veneer"))
            veneer = {"thin only": "thin", "full only": "full"}.get(veneer, veneer)
        # sizes: the spec sheet where there is one (the Mill Creek Castle Rock page swaps its labels; the sheet doesn't)
        if slug == "mill-creek-colonial-blend":
            sizes = 'A mix of Castle Rock (heights 4"–12"), Country Squire (heights 2"–8") and Webwall (pieces 3"–16" across)'
        elif slug == "whispering-pines-pioneer-blend":
            sizes = '75% Ledgestone (heights 1"–4", lengths 6"–24") and 25% Fieldstone (pieces 3"–16" across)'
        elif slug == "chilton-country-squire-jumpers":
            sizes = size_line(thin, None, r) + " (full veneer up to 42\")"   # its sheet prints a second, likely stray, full-veneer height
        elif sp:
            sizes = size_line(thin, full, r)
        else:
            sizes = page_size_line(r)
        if collection == "Tailored Fieldledge" and sizes and "random ends" not in sizes:
            sizes += ", random ends"
        cov = None
        if thin and thin.get("bx"):
            bx = thin["bx"]; dry_only = bx.get("standard") is None and bx.get("overgrout") is None and bx.get("dry") is not None
            cov = dict(source="Buechel spec sheet", specUrl=r.get("spec"),
                       flat_sqft_per_box={k: bx.get(k) for k in ("standard", "dry", "overgrout")},
                       corner_lnft_per_box=thin.get("bx_corner_lnft"),
                       qb_sqft={k: (thin.get("qb") or {}).get(k) for k in ("standard", "dry", "overgrout")},
                       qb_corner_lnft=thin.get("qb_corner_lnft"),
                       per_ton=(full or {}).get("per_ton"),
                       dryOnly=dry_only,
                       thickness=q(re.sub(r"\(.*?\)", "", thin.get("width") or "")).strip() or None,
                       cornerReturn=("Butt jointed" if "butt" in (thin.get("corner_return") or "").lower() else q(thin.get("corner_return"))))
        elif full and full.get("per_ton"):
            cov = dict(source="Buechel spec sheet", specUrl=r.get("spec"), flat_sqft_per_box=None, corner_lnft_per_box=None,
                       per_ton=full["per_ton"], dryOnly=False)
        fam, cut = family_of(r["name"])
        tl = [t for t in TONES if t in tones.get(slug, ())]
        out.append(dict(
            id=slug, name=r["name"], collection=collection, family=fam, cut=cut or collection,
            tones=tl, tone=(" and ".join([", ".join(tl[:-1]), tl[-1]]) if len(tl) > 1 else tl[0]) + " Tones",
            stoneType=stone_type, colorWords=colors_clean(r.get("colors")), sizes=sizes, veneer=veneer,
            url=f"https://buechelstone.com/products/{slug}/", specUrl=r.get("spec"),
            coverage=cov, dims=gen_dims(thin, full, r), notes=notes,
        ))
    # Same stone in other cuts. Most names are one stone ("Black Frost", "Spalted Oak"): every cut counts.
    # Chilton, Fond du Lac and Mill Creek name quarries with several color blends: only blends with much the
    # same color words count.
    QUARRIES = {"Chilton", "Fond du Lac", "Mill Creek"}
    def toks(c):
        words = set(re.findall(r"[a-z]+", " ".join(c["colorWords"]).lower())) - {"occasional", "of", "and", "to", "a", "possible", "small", "percentage", "streaks", "striations", "range", "accents", "tones"}
        return {re.sub(r"(ing|s)$", "", w) for w in words}
    for c in out:
        sib = []
        for d in out:
            if d is c or d["family"] != c["family"] or c["family"] == c["name"]:
                continue
            a, b = toks(c), toks(d)
            if c["family"] not in QUARRIES or (a and b and len(a & b) / len(a | b) >= 0.9):
                sib.append(d["id"])
        c["siblings"] = sorted(sib, key=lambda i: next(STYLE_ORDER.index(x["collection"]) for x in out if x["id"] == i))
    out.sort(key=lambda c: (STYLE_ORDER.index(c["collection"]), c["name"]))
    json.dump(out, open(OUT, "w"), indent=1, ensure_ascii=False)
    return out


if __name__ == "__main__":
    out = main()
    from collections import Counter
    print(len(out), "veneers;", Counter(c["collection"] for c in out))
    print("tones:", Counter(t for c in out for t in c["tones"]))
    print("no coverage:", [c["id"] for c in out if not c["coverage"]])
    print("dry only:", [c["id"] for c in out if c["coverage"] and c["coverage"]["dryOnly"]])
    print("veneer:", Counter(c["veneer"] for c in out))
