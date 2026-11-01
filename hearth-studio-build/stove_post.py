"""Browser assets for catalog stoves in the empty-hearth lake cabin ("open" variant).

- open_day_sun.png: each pixel's share of light that comes straight from the sun (direct sun only,
  no bounces, over the full daylight render). A stove's sun shadow takes that share away.
- scene.json stoveSpot.light: the light on a stove standing at the stove spot, measured on a matte
  white probe box the size of a Morso 7110 B (front, the visible side, top; day and evening), in the
  same units as the light maps (exposure applied), plus the left-to-right slope across the front.
- probe_shadow_<light>.png (debug, not shipped): how much the probe darkens the slab and chimney.
"""
import json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
import exr, geom

RD = "/home/claude/build/renders/final"
OD = "/home/claude/visualizer/assets/scenes/cabin"
DBG = "/home/claude/build/renders/stove_dbg"
os.makedirs(DBG, exist_ok=True)
sj = json.load(open(f"{OD}/scene.json"))
geo = json.load(open(f"{RD}/cabin_open.geo.json"))
spot = sj["stoveSpot"]
expo = {L["light"]: L["exposure"] for L in sj["variants"]["open"]["lights"]}

# ---- direct-sun share (half resolution, softened a little)
S = exr.lum(exr.read_exr(f"{RD}/cabin_open_day_sundirect.exr"))
A = exr.lum(exr.read_exr(f"{RD}/cabin_open_day_beauty.exr"))
h2, w2 = S.shape
A2 = np.asarray(Image.fromarray(A.astype(np.float32)).resize((w2, h2), Image.BILINEAR), np.float32)
share = np.clip(S / np.maximum(A2, 1e-5), 0, 1)
share = ndimage.gaussian_filter(share, 1.0)
print("sun share p50/p90/p99", np.round(np.percentile(share, [50, 90, 99]), 3))
# camera distance per pixel (the "dist" render), 16 bits over 0..DIST_MAX m in red and green;
# with the camera it puts every pixel in the room. Blue: the direct-sun share (daylight only).
DIST_MAX = 20.0
dist = exr.read_exr(f"{RD}/cabin_open_dist.exr")[..., 0]
assert dist.shape == share.shape, (dist.shape, share.shape)
q = np.clip(np.round(dist / DIST_MAX * 65535), 0, 65535).astype(np.uint32)
shade = np.dstack([(q >> 8).astype(np.uint8), (q & 255).astype(np.uint8), (share * 255 + 0.5).astype(np.uint8)])
Image.fromarray(shade).save(f"{OD}/open_shade.png", optimize=True)
V = sj["variants"]["open"]
V["shade"], V["distMax"] = "open_shade.png", DIST_MAX
for L in V["lights"]:
    L.pop("sun", None)
for old in ("open_day_sun.png", "open_dist.png"):
    if os.path.exists(f"{OD}/{old}"):
        os.remove(f"{OD}/{old}")
# sun direction (toward the sun), as built in scenes.py
d = np.array([-1.0, -0.42, -0.36]); d /= np.linalg.norm(d)
spot["sun_to"] = [round(float(v), 5) for v in -d]

# ---- probe box: light on its faces
W, D, H = 0.5748, 0.4699, 0.6701
x0, x1 = -W / 2, W / 2
y0, y1 = spot["y_back"], spot["y_back"] + D
z0, z1 = spot["z"], spot["z"] + H
K, R, C = (np.array(sj["camera"][k]) for k in ("K", "R", "C"))


def poly_mask(pts3, w, h, scale):
    from PIL import ImageDraw
    pts = [tuple(geom.project(K, R, C, p) * scale) for p in pts3]
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).polygon(pts, fill=255)
    m = np.asarray(im) > 0
    return ndimage.binary_erosion(m, iterations=2)


light = {}
for Lname in ("day", "eve"):
    P = exr.read_exr(f"{RD}/cabin_open_{Lname}_probe.exr")
    ph, pw = P.shape[:2]
    sc = pw / sj["width"]
    faces = {
        "front": [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
        "side": [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],     # +x side: the one this camera sees
        "top": [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
    }
    e = expo[Lname]
    out = {}
    for nm, pts in faces.items():
        m = poly_mask(pts, pw, ph, sc)
        if m.sum() < 20:
            continue
        E = P[m] / 0.8 * e                       # irradiance in light-map units (pixel = albedo x E)
        out[nm] = [round(float(v), 4) for v in E.mean(0)]
        if nm == "front":
            ys, xs = np.where(m)
            xl, xr = np.percentile(xs, 15), np.percentile(xs, 85)
            left = P[m & (np.arange(pw)[None, :] <= xl)].mean(0)
            right = P[m & (np.arange(pw)[None, :] >= xr)].mean(0)
            # screen left-to-right slope of the light across the front, relative to its mean
            out["slope"] = round(float((exr.lum(right[None])[0] - exr.lum(left[None])[0]) / max(exr.lum(P[m].mean(0)[None])[0], 1e-6)), 3)
    # how the light varies over the front: 8 steps from screen left (+x) to right, 5 from the
    # floor to the top, each relative to the front's mean (so the stove's own photo shading stays)
    def at(fx, fz, y=y1, x=None):
        X = x1 - (x1 - x0) * fx if x is None else x
        p = geom.project(K, R, C, (X, y, z0 + H * fz)) * sc
        return P[int(p[1]), int(p[0])] / 0.8 * e
    meanL = exr.lum(np.array(out["front"])[None])[0]
    prof = [float(np.mean([exr.lum(at(fx, fz)[None])[0] for fz in np.linspace(0.12, 0.88, 9)])) / meanL for fx in np.linspace(0.03, 0.97, 8)]
    vprof = [float(np.mean([exr.lum(at(fx, fz)[None])[0] for fx in np.linspace(0.1, 0.9, 9)])) / meanL for fz in np.linspace(0.06, 0.94, 5)]
    out["prof"] = [round(v, 3) for v in prof]
    out["vprof"] = [round(v, 3) for v in vprof]
    light[Lname] = out
    # shadow the probe casts (for calibrating the drawn shadow), relative to the empty render
    B = exr.read_exr(f"{RD}/cabin_open_{Lname}_beauty.exr")
    B2 = np.asarray(Image.fromarray(exr.lum(B).astype(np.float32)).resize((pw, ph), Image.BILINEAR), np.float32)
    ratio = np.clip(exr.lum(P) / np.maximum(B2, 1e-5), 0, 1.5)
    Image.fromarray((np.clip(ratio, 0, 1) * 255).astype(np.uint8), "L").save(f"{DBG}/probe_shadow_{Lname}.png")
    print(Lname, out)
spot["light"] = light
spot["probe_in"] = [22.63, 18.5, 26.38]
json.dump(sj, open(f"{OD}/scene.json", "w"), indent=1)
print("scene.json updated")
