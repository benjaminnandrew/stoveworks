"""Re-run every check on a set of written guides and print one line per guide.

    python3 scripts/verify_batch.py <id> [...]      |   --jobs START END   (slice of build/guide_jobs.json)

For each guide: rebuild the page from its content file, then QA (qa-guide.js), the number
check (check_numbers.py) and the headless browser smoke test (smoke_guide.py).
Prints a summary row per guide and exits non-zero if anything failed.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(cmd):
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def main(argv):
    if argv[:1] == ["--jobs"]:
        jobs = json.load(open(ROOT / "build" / "guide_jobs.json", encoding="utf-8"))
        ids = [j["id"] for j in jobs[int(argv[1]):int(argv[2])]]
    else:
        ids = argv
    bad = 0
    for gid in ids:
        row = {"id": gid}
        if not (ROOT / "guides" / "content" / f"{gid}.json").exists():
            print(f"{gid:48} MISSING content file")
            bad += 1
            continue
        rc, out = run(["python3", "-I", "scripts/build_guide.py", gid])
        row["build"] = "OK" if rc == 0 and "OK" in out else "FAIL"
        rc, out = run(["node", "guides/qa-guide.js", f"guides/{gid}.html"])
        m = re.search(r"(\d+)\s*pass\D+(\d+)\s*fail\D+(\d+)\s*warn", out)
        row["qa"] = f"{m.group(1)}p/{m.group(2)}f/{m.group(3)}w" if m else "??"
        qa_fail = (not m) or m.group(2) != "0"
        rc, out = run(["python3", "-I", "scripts/check_numbers.py", gid, "--quiet"])
        m = re.search(r":\s*(\d+) number", out)
        row["nums"] = m.group(1) if m else "??"
        rc, out = run(["python3", "-I", "scripts/smoke_guide.py", f"guides/{gid}.html"])
        smoke_ok = rc == 0 and "FAIL" not in out and "Error" not in out
        row["smoke"] = "OK" if smoke_ok else "FAIL"
        c = json.load(open(ROOT / "guides" / "content" / f"{gid}.json", encoding="utf-8"))
        rv = c.get("review") or {}
        row["conf"] = len(rv.get("conflicts") or [])
        row["mism"] = len(rv.get("catalog_mismatches") or [])
        failed = row["build"] != "OK" or qa_fail or row["nums"] != "0" or not smoke_ok
        bad += failed
        print(f"{gid:48} build {row['build']:4} qa {row['qa']:12} nums {row['nums']:3} smoke {row['smoke']:4} "
              f"conflicts {row['conf']} mismatches {row['mism']}{'   <-- CHECK' if failed else ''}")
        if not smoke_ok:
            print("    " + out.strip().replace("\n", "\n    ")[:800])
    print(f"{len(ids)} guides, {bad} with problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
