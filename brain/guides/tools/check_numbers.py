"""Check that every number a guide states can be found in its manual(s).

    python3 scripts/check_numbers.py <guide id> [...]   |   --all   [--quiet]

Pulls the numbers out of a guide's content (spec rows, drawer text, steps, faults, codes) and
looks for each one in the manual text (ignoring thousands separators, unicode fractions and
inch/foot marks). Numbers it can't find are listed for a person to check — usually a unit
conversion, a sum, or a typo; occasionally something that isn't in the manual at all.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAC = {"½": " 1/2", "¼": " 1/4", "¾": " 3/4", "⅛": " 1/8", "⅜": " 3/8", "⅝": " 5/8", "⅞": " 7/8", "⅓": " 1/3", "⅔": " 2/3",
        "⁄": "/"}
NUM = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s+(\d+/\d+))?(?![\w])|(?<![\w/])(\d+/\d+)(?![\w/])")


def norm(s):
    for k, v in FRAC.items():
        s = s.replace(k, v)
    s = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", s)          # 56,000 -> 56000
    s = re.sub(r"(?<=\d),(?=\d{1,2}(?![\d,]))", ".", s)     # European decimal comma: 71,4 -> 71.4
    s = re.sub(r"(\d)-\s*(\d+/\d+)", r"\1 \2", s)       # 13-1/2, 13- 1/2 -> 13 1/2
    s = re.sub(r"(\d)\s*[\"”″]\s*(\d+/\d+)", r"\1 \2", s)  # 58" 3/4" -> 58 3/4
    s = re.sub(r"\s+", " ", s)
    return s


PAGE_REF = re.compile(r"\b(?:pp?\.|pages?)\s*\d+(?:\s*(?:[-–,/]|and|&|or)\s*\d+)*", re.I)


def numbers(text):
    text = norm(re.sub(r"<[^>]+>", " ", text))
    text = PAGE_REF.sub(" ", text)  # "p. 34", "pp. 19–20": page references, not specs
    out = []
    for m in NUM.finditer(text):
        whole, frac, lone = m.group(1), m.group(2), m.group(3)
        if lone:
            out.append(lone)
        elif frac:
            out.append(f"{whole} {frac}")
        else:
            out.append(whole)
    return out


def trivial(n):
    # single digits and tiny counts are too common to check meaningfully
    try:
        return float(n) < 10 and "/" not in n and "." not in n
    except ValueError:
        return False


def check(gid, plan):
    c = json.load(open(ROOT / "guides" / "content" / f"{gid}.json", encoding="utf-8"))
    unit = plan[gid]
    manual = ""
    for d in unit["docs"]:
        for src in (d["raw_path"], d["layout_path"]):
            p = ROOT / src
            if p.exists():
                manual += " ".join(x["t"] for x in json.load(open(p, encoding="utf-8"))) + " "
    hay = " " + norm(manual) + " "
    hay_nospace = hay.replace(" ", "")
    texts = []
    for s in c.get("specs", []):
        texts += [r[1] for r in s["rows"]] + [s.get("note") or ""]
    for k, d in c.get("detail", {}).items():
        texts.append(d["html"])
    for s in c.get("steps", []):
        texts += s[1:]
    for p in (c.get("faults") or {}).get("panels", []):
        texts += p["items"]
    for cd in c.get("codes", []):
        texts += [str(cd[1]), str(cd[2])]
    # numbers a person or writer confirmed on the rendered PDF page because the text layer
    # (OCR) dropped them; recorded in the content file's review block
    image_checked = {str(x) for x in (c.get("review") or {}).get("image_checked_numbers", [])}
    # figures quoted from the maker's website (Ben, Oct 12: report both): the website's printed
    # values from build/guide_inputs/<id>/website.json and the catalog values in catalog_mismatches
    rv = c.get("review") or {}
    for m in rv.get("catalog_mismatches") or []:
        image_checked |= set(numbers(str(m.get("catalog") or "")))
    wpath = ROOT / "build" / "guide_inputs" / gid / "website.json"
    if wpath.exists():
        for w in json.load(open(wpath, encoding="utf-8")):
            for r in w.get("rows") or []:
                image_checked |= set(numbers(f"{r.get('label')} {r.get('value')}"))
    missing = {}
    for t in texts:
        for n in numbers(t):
            if trivial(n) or n in image_checked:
                continue
            if re.search(r"(?<![\d.])" + re.escape(n) + r"(?![\d])", hay) or n.replace(" ", "") in hay_nospace:
                continue
            # 13 1/2 written as 13.5 in the manual (or the reverse)
            try:
                if " " in n:
                    a, f = n.split(" ")
                    x, y = f.split("/")
                    dec = float(a) + float(x) / float(y)
                    if re.search(r"(?<![\d.])" + re.escape(f"{dec:g}") + r"(?![\d])", hay):
                        continue
            except ValueError:
                pass
            missing.setdefault(n, t[:90])
    return missing


def main(argv):
    plan = {u["id"]: u for u in json.load(open(ROOT / "build" / "guide_plan.json", encoding="utf-8"))["units"]}
    quiet = "--quiet" in argv
    ids = [a for a in argv if not a.startswith("--")]
    if "--all" in argv:
        ids = sorted(p.stem for p in (ROOT / "guides" / "content").glob("*.json") if p.stem in plan)
    total = 0
    for gid in ids:
        miss = check(gid, plan)
        total += len(miss)
        print(f"{gid}: {len(miss)} number(s) not found in the manual")
        if not quiet:
            for n, ctx in miss.items():
                print(f"   {n!r:>12}  in: {re.sub(r'<[^>]+>', ' ', ctx)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
