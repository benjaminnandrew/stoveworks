"""Repair manual text set in fonts whose characters are shifted by 29 code points.

Some PDFs embed fonts without a proper character map, so pdftotext returns "7KH DLU FRQWURO"
for "The air control" (every character 29 code points low; spaces come out as \\x03 and digits
as control characters). This decodes such lines in the extracted page text, in place, for both
the reading-order and the layout extraction. Safe to run repeatedly.

    python3 scripts/fix_shifted_text.py
"""
import glob
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMON = set("""the and of to a in is for on with as be by or at it this that from are not do if your you
air fire stove wood door glass heat burn control open close high low use must should will can may
when all any into than then only each also more after before during until install installation
clearance clearances chimney pipe floor wall hearth unit appliance manual warning caution""".split())


def shift(ch):
    o = ord(ch)
    if ch in (" ", "\n", "\r", "\t"):
        return ch
    if 3 <= o <= 93:
        return chr(o + 29)
    return ch


def score(s):
    return sum(1 for w in re.findall(r"[a-z]+", s.lower()) if w in COMMON)


def fix_line(line):
    if not line.strip():
        return line, False
    dec = "".join(shift(c) for c in line)
    a, b = score(line), score(dec)
    printable = sum(1 for c in dec if c.isprintable() or c in " \t")
    if b > a or ("\x03" in line and b >= a and printable >= 0.9 * len(dec)):
        return dec, True
    return line, False


def fix_text(t):
    out, changed = [], 0
    for line in t.split("\n"):
        new, ch = fix_line(line)
        out.append(new)
        changed += ch
    return "\n".join(out), changed


def main():
    total_pages = total_lines = 0
    for base in ("manual_pages/raw_extract/pages_raw", "manual_pages/pages"):
        for f in glob.glob(str(ROOT / base / "*" / "*.json")):
            pages = json.load(open(f, encoding="utf-8"))
            if not any("\x03" in p["t"] for p in pages):
                continue
            touched = 0
            for p in pages:
                if "\x03" not in p["t"]:
                    continue
                p["t"], n = fix_text(p["t"])
                if n:
                    touched += 1
                    total_lines += n
            if touched:
                json.dump(pages, open(f, "w", encoding="utf-8"), ensure_ascii=False)
                total_pages += touched
                print(f"{Path(f).relative_to(ROOT)}: {touched} page(s) decoded")
    print(f"decoded {total_lines} lines on {total_pages} pages")


if __name__ == "__main__":
    main()
