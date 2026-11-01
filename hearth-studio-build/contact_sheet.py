"""Contact sheet of stone thumbnails with names: python3 contact_sheet.py <stone dir> <out.png> [id,id,...]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
ids = sys.argv[3].split(",") if len(sys.argv) > 3 else sorted(x for x in os.listdir(d) if os.path.exists(os.path.join(d, x, "thumb.jpg")))
S, cols = 240, 6
rows = (len(ids) + cols - 1) // cols
sheet = Image.new("RGB", (cols * S, rows * (S + 22)), (24, 26, 26))
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except Exception:
    font = ImageFont.load_default()
for i, sid in enumerate(ids):
    x, y = (i % cols) * S, (i // cols) * (S + 22)
    p = os.path.join(d, sid, "thumb.jpg")
    if os.path.exists(p):
        sheet.paste(Image.open(p).resize((S - 4, S - 4)), (x + 2, y + 2))
    dr.text((x + 4, y + S), sid[:38], fill=(230, 228, 220), font=font)
sheet.save(out)
print(out, len(ids))
