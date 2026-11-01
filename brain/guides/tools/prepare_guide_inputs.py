"""Prepare what a guide writer reads: build/guide_inputs/<id>/unit.json and doc<N>.txt.

doc<N>.txt is the manual's text with a marker line before every physical PDF page
("=== DOC 2 · PAGE 14 of 27 ==="), laid out as on the page so tables keep their columns.

    python3 scripts/prepare_guide_inputs.py [<id> ...]     (default: every planned guide)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "build" / "guide_plan.json"
OUT = ROOT / "build" / "guide_inputs"
CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
CATALOG_FIELDS = ["id", "name", "official_name", "model_numbers", "fuel", "form", "install_type", "venting", "series",
                  "us_availability", "availability_note", "specs", "sizes", "features", "product_url"]


def compact(t):
    t = CTRL.sub(" ", t)
    t = re.sub(r" {4,}", "   ", t)
    t = "\n".join(line.rstrip() for line in t.splitlines())
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def main(ids):
    plan = json.load(open(PLAN, encoding="utf-8"))["units"]
    models = {m["id"]: m for m in json.load(open(ROOT / "build" / "models.json", encoding="utf-8"))}
    for u in plan:
        if ids and u["id"] not in ids:
            continue
        if u.get("manual_text_missing"):
            continue  # manual not downloaded yet
        d = OUT / u["id"]
        d.mkdir(parents=True, exist_ok=True)
        unit = {k: v for k, v in u.items()}
        unit["catalog"] = [{k: models[i].get(k) for k in CATALOG_FIELDS} for i in u["model_ids"]]
        for doc in u["docs"]:
            pages = json.load(open(ROOT / doc["layout_path"], encoding="utf-8"))
            n = len(pages)
            parts = [f"=== DOC {doc['n']} · PAGE {p['p']} of {n} ===\n{compact(p['t'])}" for p in pages]
            header = (f"DOC {doc['n']}: {doc['label']} — {doc['storage_key'].split('/')[-1]}"
                      f" ({doc.get('revision') or 'revision not recorded'}; {n} pages"
                      f"{'; text from OCR of a scanned PDF, check numbers carefully' if doc['text_source'] == 'ocr' else ''})\n\n")
            (d / f"doc{doc['n']}.txt").write_text(header + "\n\n".join(parts) + "\n", encoding="utf-8")
            doc["input_file"] = f"build/guide_inputs/{u['id']}/doc{doc['n']}.txt"
            doc["input_lines"] = (header + "\n\n".join(parts)).count("\n") + 1
        (d / "unit.json").write_text(json.dumps(unit, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"prepared {len(ids) if ids else len(plan)} guide input folders in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:])
