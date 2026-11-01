"""Post-process the family room with no fireplace ("open") and merge it into the site's scene.json.

Like merge_open.py does for the lake cabin (1 Nov 2026, built here): the "linear" version's exposures,
so switching between the two pictures never changes the room's brightness; a check that the zones'
geometry and mask layout match; open_* files copied into public/hs/assets/scenes/linear. The camera
and fireSpot already there are kept (the render's camera has to agree with them).

Run from the repo root after render_linear_open.sh:  var/blendenv/Scripts/python.exe hearth-studio-build/merge_linear_open.py
"""
import json, os, shutil, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ODIR = os.path.join(ROOT, "public", "hs", "assets", "scenes", "linear")
RDIR = os.path.join(ROOT, "var", "hs-renders")
TMP = os.path.join(RDIR, "linear_open_post")

sj = json.load(open(os.path.join(ODIR, "scene.json"), encoding="utf-8"))
ex = {L["light"]: L["exposure"] for L in sj["variants"]["linear"]["lights"]}
env = dict(os.environ, EXPO_FIX=",".join(f"{k}:{v!r}" for k, v in ex.items()))
shutil.rmtree(TMP, ignore_errors=True)
subprocess.run([sys.executable, "post.py", "linear", "open", "day,eve", RDIR, TMP], env=env, check=True, cwd=HERE)
tj = json.load(open(os.path.join(TMP, "scene.json"), encoding="utf-8"))
old = {z["id"]: z for z in sj["zones"]}
for z in tj["zones"]:
    o = old.get(z["id"])
    assert o is not None, z["id"]
    assert o["mask"] == z["mask"], (z["id"], o["mask"], z["mask"])
    d = np.abs(np.array(o["H"]) - np.array(z["H"])).max()
    assert d < 1e-6 * max(1, np.abs(np.array(o["H"])).max()), (z["id"], d)
for L in tj["variants"]["open"]["lights"]:
    assert abs(L["exposure"] - ex[L["light"]]) < 1e-9, L
# the render's camera is the one the site worked out for the family room (31 Oct 2026)
for k in ("K", "R", "C"):
    a, b = np.array(sj["camera"][k], float), np.array(tj["camera"][k], float)
    assert np.abs(a - b).max() < 1e-3 * max(1, np.abs(a).max()), (k, a, b)
sj["variants"]["open"] = tj["variants"]["open"]
n = 0
for f in sorted(os.listdir(TMP)):
    if f.startswith("open_"):
        shutil.copy(os.path.join(TMP, f), os.path.join(ODIR, f)); n += 1
with open(os.path.join(ODIR, "scene.json"), "w", encoding="utf-8", newline="\n") as fh:
    json.dump(sj, fh, indent=1)
print("merged open variant:", n, "files;", json.dumps(sj["variants"]["open"])[:400])
