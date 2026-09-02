"use client";

import { useEffect, useRef, useState } from "react";

import type { Region, StoneSwatch } from "@/lib/veneer-types";
import { StoneRegion } from "./StoneRegion";

/**
 * Static render of a veneer mock-up — same geometry as the studio, no editing.
 *
 * A client component rather than a server one purely because the homography is
 * computed in stage pixels, and pixels have to be measured. It is a leaf with
 * no state beyond that measurement.
 */
export function VeneerPreview({
  photoUrl,
  photoWidth,
  photoHeight,
  regions,
  stones,
}: {
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  regions: Region[];
  stones: Map<string, StoneSwatch>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="viz-stage is-static"
      style={{ aspectRatio: `${photoWidth} / ${photoHeight}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="viz-room" src={photoUrl} alt="Room" />

      {regions.map((region) => (
        <StoneRegion
          key={region.id}
          region={region}
          stone={stones.get(region.stoneId)}
          stageW={stage.w}
          stageH={stage.h}
        />
      ))}
    </div>
  );
}
