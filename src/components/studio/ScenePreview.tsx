"use client";

import type { DesignState, PlaceableProduct } from "@/lib/design-types";
import { resolveItems, resolveRegions, type ViewIndex } from "@/lib/studio";
import type { StoneSwatch } from "@/lib/veneer-types";
import { Scene } from "./Scene";

/**
 * A saved design as a still picture — same drawing as the editor, no handles.
 * Used for share links, where the viewer is not the owner. A client component
 * only because the stone's perspective is worked out in measured pixels.
 */
export function ScenePreview({
  photo,
  design,
  view = 0,
  products,
  stones,
}: {
  photo: { url: string; width: number; height: number };
  design: DesignState;
  view?: ViewIndex;
  products: Map<string, PlaceableProduct>;
  stones: Map<string, StoneSwatch>;
}) {
  return (
    <Scene
      photo={photo}
      items={resolveItems(design, view, products)}
      regions={resolveRegions(design, view, stones)}
      occluders={design.occluders}
    />
  );
}
