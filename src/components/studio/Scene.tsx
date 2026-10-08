"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Occluder } from "@/lib/design-types";
import type { ResolvedItem, ResolvedRegion } from "@/lib/studio";
import type { Region } from "@/lib/veneer-types";
import { StoneRegion } from "./StoneRegion";

export type ScenePhoto = { url: string; width: number; height: number };

export type Selection = { kind: "item"; id: string } | { kind: "region"; id: string } | null;

const CORNER_LABELS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

/** Everything the editor wires in. A scene without it is a static picture. */
export type SceneControls = {
  /** Handles are drawn only in the view being edited. */
  isActive: boolean;
  selection: Selection;
  /** Stone corners show while the stone layer is being edited. */
  showCorners: boolean;
  calibrating: boolean;
  calLine: { x1: number; y1: number; x2: number; y2: number } | null;
  label: string;
  onStagePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onStageKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onItemPointerDown: (e: React.PointerEvent<HTMLDivElement>, itemId: string) => void;
  onScalePointerDown: (e: React.PointerEvent<HTMLSpanElement>, itemId: string) => void;
  onCornerPointerDown: (e: React.PointerEvent<HTMLButtonElement>, region: Region, index: number) => void;
  onCornerKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, region: Region, index: number) => void;
};

/**
 * One view of a design, drawn in the order a hearth is built: the room, the
 * stone on the wall, whatever in the photo stands in front of the wall, and the
 * products in front of everything.
 *
 * Positions are percentages of the photo, so the editor, a share link and a
 * thumbnail all draw the same thing. The stone needs the stage's real pixel
 * size for its homography, which is why this measures itself.
 */
export function Scene({
  photo,
  regions,
  items,
  occluders,
  showOriginal = false,
  controls,
}: {
  photo: ScenePhoto;
  regions: ResolvedRegion[];
  items: ResolvedItem[];
  occluders: Occluder[];
  showOriginal?: boolean;
  controls?: SceneControls;
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

  const sel = controls?.isActive ? controls.selection : null;
  const selectedRegion =
    sel?.kind === "region" ? regions.find((r) => r.region.id === sel.id)?.region : undefined;

  return (
    <div
      ref={ref}
      className={`viz-stage studio-stage${controls ? "" : " is-static"}${
        controls?.calibrating ? " is-calibrating" : ""
      }${controls?.selection ? " is-engaged" : ""}`}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      {...(controls
        ? {
            tabIndex: 0,
            role: "application",
            "aria-label": controls.label,
            onPointerDown: controls.onStagePointerDown,
            onKeyDown: controls.onStageKeyDown,
          }
        : {})}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="viz-room" src={photo.url} alt={controls ? "" : "Room"} draggable={false} />

      {showOriginal ? null : (
        <>
          {regions.map(({ region, stone }) => (
            <StoneRegion
              key={region.id}
              region={region}
              stone={stone}
              stageW={stage.w}
              stageH={stage.h}
              selected={sel?.kind === "region" && sel.id === region.id}
            />
          ))}

          {regions.length > 0 ? <InFront photoUrl={photo.url} occluders={occluders} /> : null}

          {items.map(({ item, product }) => {
            const isSelected = sel?.kind === "item" && sel.id === item.id;
            return (
              <div
                key={item.id}
                className={`viz-item${isSelected ? " is-selected" : ""}`}
                style={{
                  left: `${item.xPct}%`,
                  top: `${item.yPct}%`,
                  width: `${item.widthPct}%`,
                  transform: `translate(-50%, -100%) rotate(${item.rotation}deg)`,
                }}
                onPointerDown={controls ? (e) => controls.onItemPointerDown(e, item.id) : undefined}
              >
                <span className="viz-shadow" style={{ opacity: item.shadow }} aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.name}
                  draggable={false}
                  style={{ transform: item.flipped ? "scaleX(-1)" : undefined }}
                />
                {isSelected && controls ? (
                  <span
                    className="viz-handle"
                    onPointerDown={(e) => controls.onScalePointerDown(e, item.id)}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            );
          })}

          {controls?.showCorners && selectedRegion ? (
            <svg className="studio-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon
                points={selectedRegion.corners.map((c) => `${c.x},${c.y}`).join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}

          {controls?.showCorners && selectedRegion
            ? selectedRegion.corners.map((corner, i) => (
                <button
                  key={CORNER_LABELS[i]}
                  type="button"
                  className="corner-handle"
                  style={{ left: `${corner.x}%`, top: `${corner.y}%` }}
                  onPointerDown={(e) => controls.onCornerPointerDown(e, selectedRegion, i)}
                  onKeyDown={(e) => controls.onCornerKeyDown(e, selectedRegion, i)}
                  aria-label={`Stone area, ${CORNER_LABELS[i]} corner. Drag, or use the arrow keys.`}
                />
              ))
            : null}
        </>
      )}

      {controls?.calLine ? (
        <svg className="cal-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line
            x1={controls.calLine.x1}
            y1={controls.calLine.y1}
            x2={controls.calLine.x2}
            y2={controls.calLine.y2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  );
}

/**
 * Re-paints the parts of the photo that stand in front of the wall — a sofa, a
 * window frame — over the stone, so the stone reads as behind them.
 */
function InFront({ photoUrl, occluders }: { photoUrl: string; occluders: Occluder[] }) {
  const clipId = `in-front-${useId().replace(/:/g, "")}`;
  if (occluders.length === 0) return null;

  return (
    <svg className="studio-in-front" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          {occluders.map((o) => (
            <polygon key={o.id} points={o.points.map((p) => `${p.x},${p.y}`).join(" ")} />
          ))}
        </clipPath>
      </defs>
      <image
        href={photoUrl}
        x="0"
        y="0"
        width="100"
        height="100"
        preserveAspectRatio="none"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}
