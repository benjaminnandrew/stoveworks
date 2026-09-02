"use client";

import { useMemo } from "react";

import { isConvex, rectToQuad, toCssMatrix3d, type Quad } from "@/lib/homography";
import { asQuad, type Region, type StoneSwatch } from "@/lib/veneer-types";

/**
 * Reference resolution of a region's own coordinate space. Its aspect follows
 * the wall's real proportions, so a square foot of wall is a square in here —
 * which keeps the stone from stretching and makes openings easy to place.
 */
export const REF_WIDTH = 1000;
export const refHeight = (region: Region) =>
  Math.max(1, Math.round((REF_WIDTH * region.realHeightIn) / region.realWidthIn));

/** Where the region's corners sit in stage pixels. */
function quadInPixels(region: Region, stageW: number, stageH: number): Quad {
  return region.corners.map((c) => ({
    x: (c.x / 100) * stageW,
    y: (c.y / 100) * stageH,
  })) as unknown as Quad;
}

/**
 * Draws one stoned area.
 *
 * A rectangle carrying the tiling texture is pushed through the homography with
 * `matrix3d`. The browser rasterises that on the GPU, so the texture stays
 * sharp and the corners stay draggable at 60fps — and the courses converge with
 * the wall instead of sitting flat on top of it.
 *
 * Openings are punched with a CSS mask rather than drawn over the top, so the
 * room shows through a firebox exactly as it should.
 */
export function StoneRegion({
  region,
  stone,
  stageW,
  stageH,
  selected,
}: {
  region: Region;
  stone: StoneSwatch | undefined;
  stageW: number;
  stageH: number;
  selected?: boolean;
}) {
  const refH = refHeight(region);

  const { matrix, convex } = useMemo(() => {
    const quad = quadInPixels(region, stageW, stageH);
    return {
      matrix: toCssMatrix3d(rectToQuad(REF_WIDTH, refH, quad)),
      convex: isConvex(quad),
    };
  }, [region, stageW, stageH, refH]);

  const mask = useMemo(() => {
    if (region.holes.length === 0) return undefined;
    const solid = "linear-gradient(#000,#000)";
    const layers = [solid, ...region.holes.map(() => solid)].join(",");
    const sizes = [
      `${REF_WIDTH}px ${refH}px`,
      ...region.holes.map((h) => `${(h.wPct / 100) * REF_WIDTH}px ${(h.hPct / 100) * refH}px`),
    ].join(",");
    const positions = [
      "0 0",
      ...region.holes.map((h) => `${(h.xPct / 100) * REF_WIDTH}px ${(h.yPct / 100) * refH}px`),
    ].join(",");
    const repeat = ["no-repeat", ...region.holes.map(() => "no-repeat")].join(",");

    return {
      maskImage: layers,
      WebkitMaskImage: layers,
      maskSize: sizes,
      WebkitMaskSize: sizes,
      maskPosition: positions,
      WebkitMaskPosition: positions,
      maskRepeat: repeat,
      WebkitMaskRepeat: repeat,
      // Each opening XORs against what is already there, cutting a hole.
      maskComposite: "exclude",
      WebkitMaskComposite: "xor",
    } as React.CSSProperties;
  }, [region.holes, refH]);

  if (!stone || stageW === 0) return null;

  // One tile of the swatch covers a known real area; convert that into the
  // region's own pixel space so courses come out the right size on the wall.
  const tilePxW = (REF_WIDTH * stone.tileWidthIn) / region.realWidthIn;
  const tilePxH = (refH * stone.tileHeightIn) / region.realHeightIn;

  return (
    <div
      className={`stone-region${selected ? " is-selected" : ""}${convex ? "" : " is-folded"}`}
      style={{
        width: REF_WIDTH,
        height: refH,
        transform: matrix,
        opacity: region.opacity,
        ...mask,
      }}
      aria-hidden="true"
    >
      <div
        className="stone-fill"
        style={{
          backgroundImage: `url(${stone.image})`,
          backgroundSize: `${tilePxW}px ${tilePxH}px`,
          filter: `brightness(${region.brightness}) contrast(${region.contrast})`,
        }}
      />
    </div>
  );
}
