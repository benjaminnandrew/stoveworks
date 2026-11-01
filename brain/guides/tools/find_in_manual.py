"""Find which manual pages mention a term — for choosing and checking PAGEREF numbers.

    python3 scripts/find_in_manual.py <guide id> "<term>" ["<term>" ...] [--doc N] [--context N]

Matching ignores case, curly quotes and line breaks. Prints, per page, the lines around each hit.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def fold(s):
    s = s.lower().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("″", '"')
    return re.sub(r"\s+", " ", s)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    gid, rest = argv[0], argv[1:]
    only_doc, ctx = None, 1
    terms = []
    it = iter(rest)
    for a in it:
        if a == "--doc":
            only_doc = int(next(it))
        elif a == "--context":
            ctx = int(next(it))
        else:
            terms.append(a)
    plan = {u["id"]: u for u in json.load(open(ROOT / "build" / "guide_plan.json", encoding="utf-8"))["units"]}
    unit = plan[gid]
    for term in terms:
        q = fold(term)
        print(f"### '{term}'")
        total = 0
        for doc in unit["docs"]:
            if only_doc and doc["n"] != only_doc:
                continue
            pages = json.load(open(ROOT / doc["layout_path"], encoding="utf-8"))
            for p in pages:
                if q not in fold(p["t"]):
                    continue
                total += 1
                lines = [re.sub(r" {3,}", "   ", l.strip()) for l in p["t"].splitlines()]
                hits = [i for i, l in enumerate(lines) if q in fold(l)]
                shown = set()
                out = []
                for i in hits[:3]:
                    for j in range(max(0, i - ctx), min(len(lines), i + ctx + 1)):
                        if j not in shown and lines[j]:
                            shown.add(j)
                            out.append(lines[j][:160])
                if not hits:  # term spans a line break
                    flat = fold(p["t"])
                    k = flat.find(q)
                    out.append("… " + flat[max(0, k - 70):k + len(q) + 70] + " …")
                print(f"  doc {doc['n']} p.{p['p']}: " + " | ".join(out))
        if not total:
            print("  (no page mentions it)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
