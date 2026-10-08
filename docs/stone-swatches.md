# Stone swatches

Each image in `public/stone/` is one repeat of a stone texture. Room Studio tiles it across a
marked wall, sized by the real area one repeat covers (`swatch_width_in` ×
`swatch_height_in` on the stone's row, editable at `/admin/stone`).

| File | What it is | Real size of one repeat |
| --- | --- | --- |
| `buechel-supplied-sample-tile.jpg` | The Buechel sample photo from the Room Studio prototype, made seamless | 29.5″ × 43″, **estimated** |
| `brick-red.png`, `fieldstone-*.png`, `ledgestone-*.png` | Generated placeholders (`npm run stone:tiles`), labelled as samples wherever they show | 24″ × 16″ |

**The Buechel sample.** The original (621 × 904 px, product name and size
unknown) came with the prototype. It was made to tile with:

```bash
node scripts/make-seamless-tile.mjs buechel-supplied-sample.jpg \
  public/stone/buechel-supplied-sample-tile.jpg --width-in 36
```

`--width-in 36` is a reading of the photo, not a measurement: its larger stones
come out 15–20″ long and 4–6″ high at that width, which is typical of natural
thin veneer. When Buechel confirms the product, re-run the script with the
photo's real width and enter the printed size at `/admin/stone`.

**Any new stone photo** goes through the same script before upload. A photo laid
edge to edge shows hard seams every repeat; the script trims a strip off two
sides and rebuilds the edges along the mortar joints so it doesn't.
