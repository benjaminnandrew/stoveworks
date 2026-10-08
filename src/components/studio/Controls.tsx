"use client";

import type { PlaceableProduct, PlacedItem } from "@/lib/design-types";
import { clamp, estimateRegion, MAX_HOLES, newHole, type Region, type StoneSwatch } from "@/lib/veneer-types";

const feet = (inches: number) => `${(inches / 12).toFixed(1)}′`;

// ---------------------------------------------------------------------------
// A placed product
// ---------------------------------------------------------------------------

export function ItemControls({
  item,
  product,
  pctPerInch,
  onChange,
  onRemove,
}: {
  item: PlacedItem;
  product: PlaceableProduct | undefined;
  /** Only when the customer has set the scale — a guessed scale isn't quoted back. */
  pctPerInch: number | null;
  onChange: (patch: Partial<PlacedItem>) => void;
  onRemove: () => void;
}) {
  const inches = pctPerInch ? item.widthPct / pctPerInch : null;

  return (
    <div className="item-controls" role="group" aria-label="Selected product">
      <div className="item-controls-head">
        <strong>{product?.name ?? "Selected product"}</strong>
        {inches ? <span className="item-size">{inches.toFixed(0)}″ wide in the room</span> : null}
      </div>

      <div className="control-grid">
        <label>
          <span>Size</span>
          <input
            type="range"
            min={3}
            max={80}
            step={0.5}
            value={item.widthPct}
            onChange={(e) => onChange({ widthPct: Number(e.target.value) })}
          />
        </label>
        <label>
          <span>Rotation</span>
          <input
            type="range"
            min={-30}
            max={30}
            step={1}
            value={item.rotation}
            onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          />
        </label>
        <label>
          <span>Shadow</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={item.shadow}
            onChange={(e) => onChange({ shadow: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="item-buttons">
        <button type="button" className="tool" onClick={() => onChange({ flipped: !item.flipped })}>
          Flip
        </button>
        <button type="button" className="tool" onClick={() => onChange({ rotation: 0 })}>
          Straighten
        </button>
        <button type="button" className="tool tool-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A stone area
// ---------------------------------------------------------------------------

export function RegionControls({
  region,
  stoneId,
  stone,
  areaNumber,
  isCalibrated,
  onChange,
  onUsePhotoSize,
  onRemove,
}: {
  region: Region;
  /** The stone this view puts on the area; null for the bare wall (view B only). */
  stoneId: string | null;
  /** That stone's catalog entry — missing if it has since been taken off the list. */
  stone: StoneSwatch | undefined;
  areaNumber: number;
  isCalibrated: boolean;
  onChange: (patch: Partial<Region>) => void;
  /** Goes back to reading the size off the photo. */
  onUsePhotoSize: () => void;
  onRemove: () => void;
}) {
  const estimate = estimateRegion(region, stone);
  const stoneLabel = stone
    ? ` — ${stone.brandName ? `${stone.brandName} ` : ""}${stone.texture}`
    : stoneId === null
      ? " — bare wall"
      : " — stone no longer in the catalog";

  /**
   * The first size typed in sets the scale of this one area: the other side
   * keeps the proportions read off the photo until it is typed in too.
   */
  const typed = (side: "realWidthIn" | "realHeightIn", raw: string) => {
    const value = clamp(Number(raw) || 6, 6, 1200);
    if (region.measured) return onChange({ [side]: value });
    const other = side === "realWidthIn" ? "realHeightIn" : "realWidthIn";
    const ratio = region[other] / region[side];
    onChange({ [side]: value, [other]: clamp(Math.round(value * ratio), 6, 1200), measured: true });
  };

  const sizeSource = region.measured
    ? "As entered."
    : isCalibrated
      ? "Read off your scale — measure the wall to be sure. Type in the side you know and the other follows the shape."
      : "A rough guess until you set the scale or measure the wall. Type in the side you know and the other follows the shape.";

  return (
    <div className="item-controls" role="group" aria-label="Selected stone area">
      <div className="item-controls-head">
        <strong>
          Stone area {areaNumber}
          {stoneLabel}
        </strong>
        <span className="item-size">
          {feet(region.realWidthIn)} × {feet(region.realHeightIn)} · {estimate.netSqft.toFixed(0)} sq ft
        </span>
      </div>

      <fieldset className="field-row">
        <legend className="field-label">How big is this area, really?</legend>
        <span className="field-note">
          {sizeSource} The size sets how big the stones come out and what the estimate is worked
          out from.
          {region.measured ? (
            <>
              {" "}
              <button type="button" className="linklike" onClick={onUsePhotoSize}>
                Read it off the photo instead
              </button>
            </>
          ) : null}
        </span>
        <div className="dims dims-2">
          <label>
            Width (in)
            <input
              type="number"
              min={6}
              max={1200}
              step={1}
              value={region.realWidthIn}
              onChange={(e) => typed("realWidthIn", e.target.value)}
            />
          </label>
          <label>
            Height (in)
            <input
              type="number"
              min={6}
              max={1200}
              step={1}
              value={region.realHeightIn}
              onChange={(e) => typed("realHeightIn", e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="field-row">
        <legend className="field-label">Outside corners</legend>
        <span className="field-note">
          Tick the edges that wrap around a corner — those need corner pieces rather than flats.
        </span>
        <div className="edge-toggles">
          {(["top", "right", "bottom", "left"] as const).map((edge) => (
            <label key={edge} className="checkbox">
              <input
                type="checkbox"
                checked={region.cornerEdges[edge]}
                onChange={(e) => onChange({ cornerEdges: { ...region.cornerEdges, [edge]: e.target.checked } })}
              />
              <span>{edge}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="control-grid">
        <label>
          <span>Brightness</span>
          <input
            type="range"
            min={0.4}
            max={1.8}
            step={0.02}
            value={region.brightness}
            onChange={(e) => onChange({ brightness: Number(e.target.value) })}
          />
        </label>
        <label>
          <span>Contrast</span>
          <input
            type="range"
            min={0.4}
            max={1.8}
            step={0.02}
            value={region.contrast}
            onChange={(e) => onChange({ contrast: Number(e.target.value) })}
          />
        </label>
        <label>
          <span>Blend</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.02}
            value={region.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="holes">
        <div className="holes-head">
          <span className="field-label">Openings</span>
          <button
            type="button"
            className="tool"
            disabled={region.holes.length >= MAX_HOLES}
            onClick={() => onChange({ holes: [...region.holes, newHole()] })}
          >
            Add an opening
          </button>
        </div>
        <span className="field-note">
          Cut out the firebox, a mantel or a window so the room shows through.
        </span>

        {region.holes.map((hole, i) => (
          <div key={hole.id} className="hole-row">
            <span className="hole-label">#{i + 1}</span>
            {(
              [
                ["xPct", "Left"],
                ["yPct", "Top"],
                ["wPct", "Width"],
                ["hPct", "Height"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="range"
                  min={key === "wPct" || key === "hPct" ? 2 : 0}
                  max={100}
                  step={1}
                  value={hole[key]}
                  onChange={(e) =>
                    onChange({
                      holes: region.holes.map((h) =>
                        h.id === hole.id ? { ...h, [key]: Number(e.target.value) } : h,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="linklike danger"
              onClick={() => onChange({ holes: region.holes.filter((h) => h.id !== hole.id) })}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="item-buttons">
        <button type="button" className="tool tool-danger" onClick={onRemove}>
          Remove this area
        </button>
      </div>
    </div>
  );
}
