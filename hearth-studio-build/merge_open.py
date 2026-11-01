"""Post-process the empty-hearth lake cabin ("open") and merge it into the shipped scene.json.

Uses the trad/modern exposures so switching between versions of the room never changes its
brightness, checks the zone geometry and mask layout match, copies open_* files and adds the
camera and the stove spot (shared by every version of the room)."""
import json, os, shutil, subprocess
import numpy as np

ODIR = "/home/claude/visualizer/assets/scenes/cabin"
TMP = "/home/claude/build/renders/open_post"
sj = json.load(open(f"{ODIR}/scene.json"))
ex = {L["light"]: L["exposure"] for L in sj["variants"]["trad"]["lights"]}
env = dict(os.environ, EXPO_FIX=",".join(f"{k}:{v!r}" for k, v in ex.items()))
shutil.rmtree(TMP, ignore_errors=True)
subprocess.run(["python3", "post.py", "cabin", "open", "day,eve", "renders/final", TMP], env=env, check=True, cwd="/home/claude/build")
tj = json.load(open(f"{TMP}/scene.json"))
old = {z["id"]: z for z in sj["zones"]}
for z in tj["zones"]:
    o = old.get(z["id"])
    assert o is not None, z["id"]
    assert o["mask"] == z["mask"], (z["id"], o["mask"], z["mask"])
    d = np.abs(np.array(o["H"]) - np.array(z["H"])).max()
    assert d < 1e-6 * max(1, np.abs(np.array(o["H"])).max()), (z["id"], d)
for L in tj["variants"]["open"]["lights"]:
    assert abs(L["exposure"] - ex[L["light"]]) < 1e-9, L
sj["variants"]["open"] = tj["variants"]["open"]
sj["camera"] = tj["camera"]
sj["stoveSpot"] = tj["stoveSpot"]
n = 0
for f in sorted(os.listdir(TMP)):
    if f.startswith("open_"):
        shutil.copy(f"{TMP}/{f}", f"{ODIR}/{f}"); n += 1
json.dump(sj, open(f"{ODIR}/scene.json", "w"), indent=1)
print("merged open variant:", n, "files;", json.dumps(sj["variants"]["open"])[:400])
