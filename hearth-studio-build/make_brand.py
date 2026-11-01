"""Hayward Stoveworks badge for the app, from the store's logo file (white background, 4000 px).

Writes to <out>/ (default: assets/brand next to this build folder):
  badge-640.png, badge-200.png              the badge as drawn: white disc, black ink, orange flame;
                                            transparent outside the outer ring
  badge-light-640.png, badge-light-200.png  the same drawing with the black ink turned light and the paper
                                            removed, for dark backgrounds
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "brand_src", "hayward-stoveworks-badge-source.png")
OUT = sys.argv[2] if len(sys.argv) > 2 else (os.path.join(HERE, "..", "assets", "brand") if os.path.isdir(os.path.join(HERE, "..", "assets", "brand")) else "/home/claude/visualizer/assets/brand")
LIGHT_INK = np.array([241, 237, 228], np.float32)     # warm off-white, like the app's light text

a = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
H, W, _ = a.shape
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = (r + g + b) / 3
sat = a.max(2) - a.min(2)

# the outer ring: the biggest dark shape; the disc is everything it encloses
dark = lum < 140
lab, n = ndimage.label(dark)
sizes = ndimage.sum(dark, lab, range(1, n + 1))
ring = lab == (1 + int(np.argmax(sizes)))
disc = ndimage.binary_fill_holes(ring)
inner = ndimage.binary_erosion(disc, iterations=3)
band = ndimage.binary_dilation(disc, iterations=4) & ~inner

# how much "ink" covers each pixel: black ink by darkness, the orange by its pull away from white
orange = sat > 60
cov_black = np.clip((235 - lum) / (235 - 20), 0, 1)
cov_orange = np.clip((250 - g) / (250 - 70), 0, 1)

# 1) badge as drawn: opaque inside, anti-aliased outer edge taken from the ring's own darkness
alpha = np.where(inner, 1.0, 0.0)
alpha = np.where(band, np.maximum(alpha, cov_black), alpha)
rgb = a.copy()
rgb[band & ~inner] = 0                                  # edge pixels: pure ink, coverage carries the blend
badge = np.dstack([rgb, alpha * 255]).astype(np.uint8)

# 2) light version: no paper, ink recolored
ink_a = np.where(orange, cov_orange, cov_black) * ndimage.binary_dilation(disc, iterations=4)
ink_rgb = np.where(orange[..., None], np.array([196, 82, 46], np.float32)[None, None, :], LIGHT_INK[None, None, :])
light = np.dstack([ink_rgb, ink_a * 255]).astype(np.uint8)

# square crop around the disc, a hair of margin
ys, xs = np.nonzero(disc)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
half = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 12
box = tuple(int(round(v)) for v in (cx - half, cy - half, cx + half, cy + half))

def save(arr, name, sizes=(640, 200)):
    im = Image.fromarray(arr, "RGBA").crop(box)
    # premultiply before resizing so transparent pixels don't bleed their color into the edge
    pm = np.asarray(im).astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255
    for s in sizes:
        small = np.asarray(Image.fromarray(pm.astype(np.uint8), "RGBA").resize((s, s), Image.LANCZOS)).astype(np.float32)
        al = small[..., 3:4]
        small[..., :3] = np.where(al > 0, small[..., :3] * 255 / np.maximum(al, 1), 0)
        im_s = Image.fromarray(np.clip(small, 0, 255).astype(np.uint8), "RGBA")
        # a 96-color palette looks the same here and is a fifth of the size
        im_s.quantize(colors=96, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f"{OUT}/{name}-{s}.png", optimize=True)

save(badge, "badge")
save(light, "badge-light")
print("disc box", box, "ring px", int(ring.sum()))
