import type { PlaceableProduct, PlacedItem } from "@/lib/design-types";

/**
 * Static render of a design — same geometry as the editor, no interactivity.
 * Used for share links, where the viewer is not the owner.
 */
export function DesignPreview({
  photoUrl,
  photoWidth,
  photoHeight,
  items,
  products,
}: {
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  items: PlacedItem[];
  products: Map<string, PlaceableProduct>;
}) {
  return (
    <div className="viz-stage is-static" style={{ aspectRatio: `${photoWidth} / ${photoHeight}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="viz-room" src={photoUrl} alt="Room" />

      {items.map((item) => {
        const product = products.get(item.productId);
        if (!product) return null;

        return (
          <div
            key={item.id}
            className="viz-item"
            style={{
              left: `${item.xPct}%`,
              top: `${item.yPct}%`,
              width: `${item.widthPct}%`,
              transform: `translate(-50%, -100%) rotate(${item.rotation}deg)`,
            }}
          >
            <span className="viz-shadow" style={{ opacity: item.shadow }} aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              style={{ transform: item.flipped ? "scaleX(-1)" : undefined }}
            />
          </div>
        );
      })}
    </div>
  );
}
