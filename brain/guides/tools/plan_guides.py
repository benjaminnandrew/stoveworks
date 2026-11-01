"""Plan the owner & installer guides: one guide per manual set.

A manual set is the newest US manual(s) for one model configuration: a single installation &
operation manual, or an installation manual plus an owner's manual, plus an integral kit manual
when the model can't exist without the kit. Models whose manual sets are identical share a guide.

Writes build/guide_plan.json.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
RAW = ROOT / "manual_pages" / "raw_extract" / "pages_raw"      # reading-order text (search index)
LAYOUT = ROOT / "manual_pages" / "pages"                         # layout text (tables), incl. OCR

ROLE_ORDER = {"installation_and_operation": 0, "installation": 1, "operation": 2}
ROLE_LABEL = {
    "installation_and_operation": ("Installation & Operation Manual", "Manual"),
    "installation": ("Installation Manual", "Install"),
    "operation": ("Owner's Manual", "Owner"),
}
# Document labels that differ from the role default (file name -> (label, short))
DOC_LABEL = {
    "C-17221-C-Series-User-Manual.pdf": ("C-Series User Manual", "User"),
    "CK-30_Cabinet_Kit_Install-Owners_-Manual_4126-900.pdf": ("CK-30 Cabinet Kit Manual", "Kit"),
    "LUM-OD_install-owner_4629-900.pdf": ("LUM-OD Kit Manual", "Kit"),
}
# Guide ids for guides shared by several models (otherwise the shortest model id is used)
GROUP_ID = {
    "mendota-ml39-decor": "mendota-ml-series",
    "mendota-ml72-decor": "mendota-ml72",
}
# The three guides built before the generator existed (content is carried over, not rewritten)
EXISTING = {
    "documents/jotul/139712_7_Manual__Installation_GI_635_IPI_English.pdf": "jotul-gi635-guide.html",
    "documents/jotul/137945_Rev_22_Manual__GF300BV_Eng.pdf": "jotul-gf300bv-guide.html",
    "documents/jotul/130139-2_GF_520_DV_DVMV_Manual_1_.pdf": "jotul-gf520dv.html",
}


def slug(s):
    s = re.sub(r"\(.*?\)", "", s or "")
    s = s.replace("&", " ").replace("/", " ").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def page_text(storage_key):
    rel = storage_key.split("/", 1)[1] + ".json"
    if not (RAW / rel).exists():  # manual not downloaded / extracted yet
        return {"pages": 0, "text_source": "missing", "raw_path": str((RAW / rel).relative_to(ROOT)),
                "layout_path": str((LAYOUT / rel).relative_to(ROOT))}
    raw = json.load(open(RAW / rel, encoding="utf-8"))
    layout = json.load(open(LAYOUT / rel, encoding="utf-8"))
    raw_chars = sum(len(p["t"].strip()) for p in raw)
    lay_chars = sum(len(p["t"].strip()) for p in layout)
    source = "pdftotext"
    if raw_chars < 30 * max(1, len(raw)) and lay_chars > raw_chars * 5:
        source = "ocr"  # scanned manual: the layout set holds the OCR text
    return {"pages": len(raw), "text_source": source, "raw_path": str((RAW / rel).relative_to(ROOT)),
            "layout_path": str((LAYOUT / rel).relative_to(ROOT))}


def category(fuel, form):
    if fuel == "electric":
        return "electric"
    if form == "outdoor_fireplace":
        return f"{fuel}_outdoor"
    return f"{fuel}_{form}"


def main():
    models = json.load(open(ROOT / "build" / "models.json", encoding="utf-8"))
    sets = {}
    for m in models:
        lm = m.get("latest_manuals") or []
        if not lm:
            continue
        configs = []
        for d in lm:
            c = d.get("configuration")
            if c and c not in configs:
                configs.append(c)
        shared = [d for d in lm if not d.get("configuration")]
        groups = [(c, [d for d in lm if d.get("configuration") == c] + shared) for c in configs] or [(None, shared)]
        for c, docs in groups:
            docs = sorted(docs, key=lambda d: (bool(d.get("integral_kit")), ROLE_ORDER.get(d["role"], 9)))
            key = tuple(d["storage_key"] for d in docs)
            u = sets.setdefault(key, {"docs": docs, "members": []})
            u["members"].append((m, c, len(groups)))

    units = []
    for key, u in sets.items():
        members = u["members"]
        ms = [x[0] for x in members]
        if len(ms) == 1:
            m, c, n_groups = members[0]
            uid = m["id"] + (f"-{slug(c)}" if c and n_groups > 1 else "")
        else:
            base = sorted(ms, key=lambda m: (len(m["name"]), m["name"]))[0]["id"]
            uid = GROUP_ID.get(base, base)
        configs = sorted({x[1] for x in members if x[1]})
        docs = []
        for n, d in enumerate(u["docs"], 1):
            fname = d["storage_key"].split("/")[-1]
            label, short = DOC_LABEL.get(fname) or ROLE_LABEL.get(d["role"], ("Manual", "Manual"))
            docs.append({
                "n": n, "storage_key": d["storage_key"], "url": d["url"], "role": d["role"],
                "title": d.get("title"), "label": label, "short": short,
                "revision": d.get("revision"), "date": d.get("date"), "integral_kit": bool(d.get("integral_kit")),
                **page_text(d["storage_key"]),
            })
        forms = sorted({category(m["fuel"], m["form"]) for m in ms})
        units.append({
            "id": uid,
            "brand_slug": ms[0]["brand_slug"], "brand": ms[0]["brand"],
            "model_ids": [m["id"] for m in ms], "model_names": [m["name"] for m in ms],
            "configuration": configs[0] if len(configs) == 1 else (" / ".join(configs) if configs else None),
            "category": forms[0] if len(forms) == 1 else forms,
            "fuel": ms[0]["fuel"], "form": ms[0]["form"],
            "install_type": ms[0].get("install_type"), "venting": ms[0].get("venting"),
            "docs": docs, "total_pages": sum(d["pages"] for d in docs),
            "manual_text_missing": any(d["text_source"] == "missing" for d in docs),
            "existing_guide": next((EXISTING[d["storage_key"]] for d in docs if d["storage_key"] in EXISTING), None),
        })
    ids = [u["id"] for u in units]
    dup = {i for i in ids if ids.count(i) > 1}
    assert not dup, f"duplicate guide ids: {dup}"
    units.sort(key=lambda u: (u["brand_slug"], u["id"]))
    out = ROOT / "build" / "guide_plan.json"
    out.write_text(json.dumps({"units": units}, indent=1, ensure_ascii=False), encoding="utf-8")
    n_models = len({i for u in units for i in u["model_ids"]})
    multi = sum(1 for u in units if len(u["docs"]) > 1)
    print(f"{len(units)} guides for {n_models} models; {multi} with more than one manual; "
          f"{sum(1 for u in units if u['existing_guide'])} already built; {sum(u['total_pages'] for u in units)} pages; "
          f"{sum(1 for u in units if u['manual_text_missing'])} waiting for their manual download")


if __name__ == "__main__":
    main()
