"""Write build/guide_inputs/<id>/website.json: what each model's maker website prints, for guide writers.

    python3 scripts/prepare_website_inputs.py            # every guide unit in build/guide_plan.json

Each file is a list, one entry per model the guide covers:
    {"model_id", "name", "product_url", "rows": [{"label", "value", "source"}]}
Rows are the catalog's `specs_raw` entries that came from web pages (not PDFs, not rows the research
labelled as coming from a manual or brochure), so a guide can quote the website's own wording when it
reports a figure that differs from the manual (Ben, Oct 12: report both).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
models = {m["id"]: m for m in json.load(open(ROOT / "build" / "models.json", encoding="utf-8"))}
units = json.load(open(ROOT / "build" / "guide_plan.json", encoding="utf-8"))["units"]

NOT_WEB = re.compile(r"\((?:[^)]*\b(?:manual|brochure|catalog|spec sheet|EPA)\b[^)]*)\)", re.I)


def web_row(r):
    src = (r.get("source") or "").split("?")[0].lower()
    if not src.startswith("http") or src.endswith(".pdf") or "/wp-content/uploads/" in src:
        return False
    return not NOT_WEB.search(r.get("label") or "")


written = 0
for u in units:
    out = []
    for mid in u["model_ids"]:
        m = models.get(mid)
        if not m:
            continue
        rows = [{"label": r.get("label"), "value": r.get("value"), "source": r.get("source")}
                for r in m.get("specs_raw") or [] if isinstance(r, dict) and web_row(r)]
        out.append({"model_id": mid, "name": m.get("name"), "product_url": m.get("product_url"), "rows": rows})
    d = ROOT / "build" / "guide_inputs" / u["id"]
    if d.exists():
        (d / "website.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
        written += 1
print(f"wrote website.json for {written} guide units")
