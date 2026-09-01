import type { DesignState, PlaceableProduct } from "@/lib/design-types";

type Photo = { url: string; width: number; height: number };

/**
 * Renders the design to a full-resolution PNG and hands it to the browser as a
 * download. Everything is drawn in the same percentage space the editor uses,
 * scaled up to the photo's real pixel size, so what you see is what you get.
 */
export async function exportDesign(
  photo: Photo,
  design: DesignState,
  products: Map<string, PlaceableProduct>,
  filename: string,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  const ctx = canvas.getContext("2d")!;

  const room = await loadImage(photo.url);
  ctx.drawImage(room, 0, 0, canvas.width, canvas.height);

  for (const item of design.items) {
    const product = products.get(item.productId);
    if (!product) continue;

    const img = await loadImage(product.image);
    const width = (item.widthPct / 100) * canvas.width;
    const height = width * (img.naturalHeight / img.naturalWidth || 1);
    const x = (item.xPct / 100) * canvas.width;
    const y = (item.yPct / 100) * canvas.height;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((item.rotation * Math.PI) / 180);

    // Contact shadow, drawn on the floor line before the product itself.
    if (item.shadow > 0) {
      ctx.save();
      ctx.globalAlpha = item.shadow * 0.55;
      ctx.filter = `blur(${Math.max(2, width * 0.045)}px)`;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, -height * 0.012, width * 0.52, width * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (item.flipped) ctx.scale(-1, 1);
    ctx.drawImage(img, -width / 2, -height, width, height);
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the image");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(filename)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Product cutouts and the room photo are both same-origin (or blob/data),
    // so the canvas stays untainted and toBlob works.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "design";
