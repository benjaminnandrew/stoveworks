"""Turn Blender renders into browser assets for one scene.

python post.py <scene> <variants comma> <lights comma> <render_dir> <out_dir>
Per variant+light: base JPEG, irradiance PNG (log2-encoded, exposure applied),
light-gradient PNG (half res); per variant: zone masks; one scene.json.
"""
import sys, os, json, math
import numpy as np
from PIL import Image
from scipy import ndimage
import exr, geom

SCENE, VARIANTS, LIGHTS, RDIR, ODIR = sys.argv[1], sys.argv[2].split(","), sys.argv[3].split(","), sys.argv[4], sys.argv[5]
os.makedirs(ODIR, exist_ok=True)
EXPO_TARGET = {"day": 0.55, "eve": 0.42}


def save_jpg(img01, path, q=88):
    Image.fromarray((np.clip(img01, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=q, optimize=True, progressive=True)


def nearest_fill(val, valid):
    """Fill invalid pixels with the nearest valid pixel's value (per channel)."""
    if valid.all():
        return val
    if not valid.any():
        return val
    idx = ndimage.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    return val[idx[0], idx[1]]


def load_masks(variant):
    order, chans = [], []
    for mk in ("mask1", "mask2"):
        p = f"{RDIR}/{SCENE}_{variant}_{mk}.exr"
        if not os.path.exists(p):
            continue
        ids = json.load(open(p + ".json"))
        m = exr.read_exr(p)
        for i, zid in enumerate(ids):
            order.append(zid); chans.append(np.clip(m[..., i], 0, 1))
    return order, chans


scene_json = None
exposures = {}
for variant in VARIANTS:
    geo = json.load(open(f"{RDIR}/{SCENE}_{variant}.geo.json"))
    order, covs_all = load_masks(variant)
    groups = {z["id"]: z["group"] for z in geo["zones"]}
    covs = [c for zid, c in zip(order, covs_all) if groups.get(zid) != "pad"]   # lighting uses the drywall surfaces only
    H, W = covs[0].shape
    K, R, C = geom.camera_K_R_C(geo["camera"], W, H)
    dry = np.array(geo["drywall"], np.float32)
    total = np.sum(covs, axis=0)
    # ---- masks -> RGB PNGs (3 zones per image)
    mask_files = []
    for k in range(0, len(order), 3):
        img = np.zeros((H, W, 3), np.float32)
        for j in range(3):
            if k + j < len(order):
                img[..., j] = covs_all[k + j]
        fn = f"{variant}_mask{k // 3}.png"
        Image.fromarray((img * 255 + 0.5).astype(np.uint8)).save(f"{ODIR}/{fn}", optimize=True)
        mask_files.append(fn)
    # dominant zone per pixel (for dilation of per-zone fields)
    stack = np.stack(covs, 0)
    dom = np.argmax(stack, 0)
    anyz = total > 0.002
    interior = [(c >= 0.995) & (total <= 1.005) for c in covs]
    # erode interiors by 1px to drop any AA-contaminated pixels
    interior = [ndimage.binary_erosion(m, iterations=1) | (m & (ndimage.binary_erosion(m, iterations=1).sum() == 0)) for m in interior]
    variants_out = []
    for light in LIGHTS:
        A = exr.read_exr(f"{RDIR}/{SCENE}_{variant}_{light}_beauty.exr")
        assert A.shape[:2] == (H, W), (A.shape, H, W)
        irr = A / dry[None, None, :]
        allint = np.any(interior, 0)
        Lw = exr.lum(irr * dry[None, None, :])[allint]
        key = (light,)
        fix = dict(kv.split(":") for kv in os.environ.get("EXPO_FIX", "").split(",") if ":" in kv)
        if key not in exposures and light in fix:
            exposures[key] = float(fix[light])     # match another variant's exposure exactly
        if key not in exposures:
            exposures[key] = EXPO_TARGET[light] / float(np.percentile(Lw, 55))
        e = exposures[key]
        base = exr.tonemap(A, e)
        save_jpg(base, f"{ODIR}/{variant}_{light}.jpg", q=90)
        # irradiance per zone, dilated, assembled by dominant zone
        irr_e = irr * e
        out = np.zeros_like(irr_e)
        filled_any = None
        for zi, m in enumerate(interior):
            if not m.any():
                continue
            f = nearest_fill(irr_e, m)
            sel = dom == zi
            out[sel] = f[sel]
        # outside all zones: nearest of any interior
        out = np.where(anyz[..., None], out, nearest_fill(irr_e, allint))
        lg = np.log2(np.clip(out, 1e-5, None))
        lo = float(np.floor((np.percentile(lg[anyz], 0.05) - 0.25) * 4) / 4)
        hi = float(np.ceil((np.percentile(lg[anyz], 99.95) + 0.25) * 4) / 4)
        enc = np.clip((lg - lo) / (hi - lo), 0, 1)
        Image.fromarray((enc * 255 + 0.5).astype(np.uint8)).save(f"{ODIR}/{variant}_{light}_irr.png", optimize=True)
        # light gradients from tilted-normal renders (half res)
        tilt = math.radians(geo["tilt_deg"])
        T = {}
        for t in ("px", "nx", "py", "ny"):
            T[t] = exr.lum(exr.read_exr(f"{RDIR}/{SCENE}_{variant}_{light}_tilt_{t}.exr") / dry[None, None, :])
        h2, w2 = T["px"].shape
        Iref = (T["px"] + T["nx"] + T["py"] + T["ny"]) / 4 / math.cos(tilt)
        Iref = np.maximum(Iref, 1e-6)
        gx = (T["px"] - T["nx"]) / (2 * math.sin(tilt)) / Iref
        gy = (T["py"] - T["ny"]) / (2 * math.sin(tilt)) / Iref
        # half-res masks
        cov2 = [np.asarray(Image.fromarray((c * 255).astype(np.uint8)).resize((w2, h2), Image.BILINEAR), np.float32) / 255 for c in covs]
        int2 = [c >= 0.98 for c in cov2]
        dom2 = np.argmax(np.stack(cov2, 0), 0)
        any2 = np.sum(cov2, 0) > 0.002
        g = np.dstack([gx, gy, np.zeros_like(gx)])
        gout = np.zeros_like(g)
        for zi, m in enumerate(int2):
            if not m.any():
                continue
            gf = nearest_fill(g, m)
            sel = dom2 == zi
            gout[sel] = gf[sel]
        allint2 = np.any(int2, 0)
        gout = np.where(any2[..., None], gout, nearest_fill(g, allint2))
        gout = ndimage.gaussian_filter(gout, (1.0, 1.0, 0))
        genc = np.clip(gout / 4 + 0.5, 0, 1)
        genc[..., 2] = 0.5
        Image.fromarray((genc * 255 + 0.5).astype(np.uint8)).save(f"{ODIR}/{variant}_{light}_grad.png", optimize=True)
        entry = dict(light=light, image=f"{variant}_{light}.jpg", irr=f"{variant}_{light}_irr.png",
                     irrRange=[lo, hi], grad=f"{variant}_{light}_grad.png", exposure=e)
        fp = f"{RDIR}/{SCENE}_{variant}_{light}_fire.exr"
        if light == "eve" and os.path.exists(fp):
            F = exr.lum(exr.read_exr(fp))
            hh, ww = F.shape
            Lt = np.asarray(Image.fromarray(exr.lum(A).astype(np.float32)).resize((ww, hh), Image.BILINEAR), np.float32)
            share = np.clip(F / np.maximum(Lt, 1e-5), 0, 1)
            share = ndimage.gaussian_filter(share, 2.0)
            Image.fromarray((share * 255 + 0.5).astype(np.uint8), "L").save(f"{ODIR}/{variant}_{light}_fire.png", optimize=True)
            entry["fire"] = f"{variant}_{light}_fire.png"
            print(variant, light, "fire share p50/p99", np.round(np.percentile(share, [50, 99]), 2))
        variants_out.append(entry)
        print(variant, light, "exposure", round(e, 3), "irr log2 range", lo, hi,
              "grad p5/p95", np.round(np.percentile(gout[..., 0][any2], [5, 95]), 2), np.round(np.percentile(gout[..., 1][any2], [5, 95]), 2))
    # zones (geometry per variant is identical apart from occlusion; homographies are camera-only)
    zones = []
    for z in geo["zones"]:
        Hn, Hf = geom.zone_homography(K, R, C, z, W, H)
        zz = dict(id=z["id"], group=z["group"], label=z["label"], visible=z["visible"],
                  H=[list(map(float, r)) for r in Hn],
                  N=z["N"], U=z["U"], V=z["V"],
                  u_off_in=z["u_off"] * geom.IN_PER_M,
                  rect_in=[(z["u0"]) * geom.IN_PER_M + z["u_off"] * geom.IN_PER_M, z["v0"] * geom.IN_PER_M,
                           (z["u1"]) * geom.IN_PER_M + z["u_off"] * geom.IN_PER_M, z["v1"] * geom.IN_PER_M],
                  area_sqft=geom.polygon_area_m2(z) * 10.7639,
                  corners_lnft=sum(abs(c[3] - c[2]) for c in z["corners"]) * 3.28084,
                  mask=None)
        if z["id"] in order:
            i = order.index(z["id"])
            zz["mask"] = [i // 3, i % 3]
        zones.append(zz)
    if scene_json is None:
        scene_json = dict(id=SCENE, name=geo["meta"]["name"], width=W, height=H, drywall=list(map(float, geo["drywall"])),
                          dims=geo["meta"]["dims"], zones=zones, variants={},
                          camera=dict(K=K.tolist(), R=R.tolist(), C=C.tolist()))
        if geo["meta"].get("stove_spot"):
            scene_json["stoveSpot"] = geo["meta"]["stove_spot"]
        if geo["meta"].get("fire_spot"):   # where a catalog fireplace or insert's front goes (1 Nov 2026)
            scene_json["fireSpot"] = geo["meta"]["fire_spot"]
    scene_json["variants"][variant] = dict(masks=mask_files, lights=variants_out)

json.dump(scene_json, open(f"{ODIR}/scene.json", "w"), indent=1)
print("wrote", ODIR)
