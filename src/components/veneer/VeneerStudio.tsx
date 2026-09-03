"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  asQuad,
  clamp,
  estimateRegion,
  MAX_HOLES,
  MAX_REGIONS,
  newHole,
  newRegion,
  totalEstimate,
  type Region,
  type StoneSwatch,
  type VeneerState,
} from "@/lib/veneer-types";
import { isConvex } from "@/lib/homography";
import { exportVeneer } from "./export";
import { EstimatePanel } from "./EstimatePanel";
import { StonePicker } from "./StonePicker";
import { StoneRegion } from "./StoneRegion";
import { clearStash, loadStash, saveStash, type VeneerStash } from "./stash";

export type Photo = { url: string; width: number; height: number; roomPhotoId?: string };

type Props = {
  stones: StoneSwatch[];
  isSignedIn: boolean;
  initial?: { designId: string; title: string; photo: Photo; state: VeneerState };
};

const MAX_EDGE = 2400;
const STASH_EDGE = 1500;
const CORNER_LABELS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

export function VeneerStudio({ stones, isSignedIn, initial }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(initial?.photo ?? null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [state, setState] = useState<VeneerState>(initial?.state ?? { regions: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [designId, setDesignId] = useState(initial?.designId ?? null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(stones.map((s) => [s.id, s])), [stones]);
  const selected = state.regions.find((r) => r.id === selectedId) ?? null;

  // The homography works in stage pixels, so the stage has to be measured.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [photo]);

  // --- restore work stashed before a sign-in round trip ---------------------

  useEffect(() => {
    if (initial || photo) return;
    const stash = loadStash();
    if (!stash) return;
    setPhoto({ url: stash.dataUrl, width: stash.width, height: stash.height });
    setState(stash.state);
    setTitle(stash.title);
    fetch(stash.dataUrl)
      .then((r) => r.blob())
      .then(setPhotoBlob)
      .catch(() => undefined);
    setNotice("Picked up where you left off.");
    clearStash();
  }, [initial, photo]);

  // --- photo ----------------------------------------------------------------

  const acceptPhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setNotice("That file isn't an image. Try a JPEG, PNG or HEIC photo.");
      return;
    }
    setBusy("Reading your photo…");
    try {
      const { blob, url, width, height } = await downscale(file, MAX_EDGE);
      setPhoto((prev) => {
        if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
        return { url, width, height };
      });
      setPhotoBlob(blob);
      setState({ regions: [] });
      setSelectedId(null);
      setDesignId(null);
      setNotice(null);
    } catch {
      setNotice("We couldn't read that image. Try a different photo.");
    } finally {
      setBusy(null);
    }
  }, []);

  // --- regions --------------------------------------------------------------

  const update = useCallback((id: string, patch: Partial<Region>) => {
    setState((s) => ({ regions: s.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);

  const addRegion = useCallback(
    (stone: StoneSwatch) => {
      if (!photo || state.regions.length >= MAX_REGIONS) return;
      const region = newRegion(stone.id);
      setState((s) => ({ regions: [...s.regions, region] }));
      setSelectedId(region.id);
      setNotice("Drag the four corners onto the wall you want stoned.");
    },
    [photo, state.regions.length],
  );

  const removeRegion = useCallback((id: string) => {
    setState((s) => ({ regions: s.regions.filter((r) => r.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const pointerToPct = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  /** Drag one corner of a region. */
  const startCornerDrag = useCallback(
    (e: React.PointerEvent, region: Region, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(region.id);

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const p = pointerToPct(ev.clientX, ev.clientY);
        const corners = [...region.corners] as Region["corners"];
        corners[index] = { x: clamp(p.x, -20, 120), y: clamp(p.y, -20, 120) };
        update(region.id, { corners });
      };
      const stop = () => {
        target.releasePointerCapture(e.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    },
    [pointerToPct, update],
  );

  /** Drag the whole region by its centre. */
  const startRegionDrag = useCallback(
    (e: React.PointerEvent, region: Region) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(region.id);

      const start = pointerToPct(e.clientX, e.clientY);
      const origin = region.corners.map((c) => ({ ...c }));
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const p = pointerToPct(ev.clientX, ev.clientY);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        update(region.id, {
          corners: origin.map((c) => ({
            x: clamp(c.x + dx, -20, 120),
            y: clamp(c.y + dy, -20, 120),
          })) as Region["corners"],
        });
      };
      const stop = () => {
        target.releasePointerCapture(e.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    },
    [pointerToPct, update],
  );

  // --- save / export --------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!photo || state.regions.length === 0) return;

    if (!isSignedIn) {
      setBusy("Saving your work…");
      try {
        const blob = photoBlob ?? (await (await fetch(photo.url)).blob());
        const dataUrl = await toDataUrl(blob, STASH_EDGE);
        saveStash({ dataUrl, width: photo.width, height: photo.height, state, title });
      } catch {
        // Stashing is a convenience; never block sign-in on it.
      } finally {
        setBusy(null);
      }
      window.location.href = "/sign-in?next=/veneer";
      return;
    }

    setBusy("Saving mock-up…");
    try {
      let roomPhotoId = photo.roomPhotoId;

      if (!roomPhotoId) {
        const blob = photoBlob ?? (await (await fetch(photo.url)).blob());
        const body = new FormData();
        body.append("photo", blob, "room.webp");
        const res = await fetch("/api/photos", { method: "POST", body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
        roomPhotoId = (await res.json()).id as string;
        setPhoto((p) => (p ? { ...p, roomPhotoId } : p));
      }

      const res = await fetch(
        designId ? `/api/veneer-designs/${designId}` : "/api/veneer-designs",
        {
          method: designId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roomPhotoId,
            title: title.trim() || "Untitled mock-up",
            regions: state.regions,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");

      setDesignId((await res.json()).id);
      setNotice("Saved to your account.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong saving that.");
    } finally {
      setBusy(null);
    }
  }, [photo, photoBlob, state, isSignedIn, title, designId]);

  const handleExport = useCallback(async () => {
    if (!photo) return;
    setBusy("Building your image…");
    try {
      await exportVeneer(photo, state, byId, title || "hayward-stoveworks-mockup");
    } catch {
      setNotice("We couldn't build that image. Try again.");
    } finally {
      setBusy(null);
    }
  }, [photo, state, byId, title]);

  const grandTotal = useMemo(() => totalEstimate(state.regions, byId), [state.regions, byId]);

  return (
    <div className="viz">
      <div className="viz-stage-col">
        {!photo ? (
          <PhotoDrop onFile={acceptPhoto} />
        ) : (
          <>
            <div className="viz-toolbar">
              <label className="viz-title-field">
                <span className="visually-hidden">Mock-up name</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this mock-up"
                  maxLength={80}
                />
              </label>
              <div className="viz-tools">
                <label className="tool tool-file">
                  Replace photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && acceptPhoto(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            <div
              ref={stageRef}
              className="viz-stage"
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              onPointerDown={() => setSelectedId(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="viz-room" src={photo.url} alt="Your room" draggable={false} />

              {state.regions.map((region) => (
                <StoneRegion
                  key={region.id}
                  region={region}
                  stone={byId.get(region.stoneId)}
                  stageW={stage.w}
                  stageH={stage.h}
                  selected={region.id === selectedId}
                />
              ))}

              {/* Handles live above the stone so they stay grabbable. */}
              {state.regions.map((region) => {
                const isSelected = region.id === selectedId;
                const centre = {
                  x: region.corners.reduce((t, c) => t + c.x, 0) / 4,
                  y: region.corners.reduce((t, c) => t + c.y, 0) / 4,
                };
                return (
                  <div key={`${region.id}-handles`}>
                    <button
                      type="button"
                      className={`region-grip${isSelected ? " is-selected" : ""}`}
                      style={{ left: `${centre.x}%`, top: `${centre.y}%` }}
                      onPointerDown={(e) => startRegionDrag(e, region)}
                      aria-label={`Move the ${byId.get(region.stoneId)?.name ?? "stone"} area`}
                    />
                    {isSelected &&
                      region.corners.map((corner, i) => (
                        <button
                          key={CORNER_LABELS[i]}
                          type="button"
                          className="corner-handle"
                          style={{ left: `${corner.x}%`, top: `${corner.y}%` }}
                          onPointerDown={(e) => startCornerDrag(e, region, i)}
                          aria-label={`Drag the ${CORNER_LABELS[i]} corner`}
                        />
                      ))}
                  </div>
                );
              })}
            </div>

            {selected ? (
              <RegionControls
                region={selected}
                stone={byId.get(selected.stoneId)}
                stones={stones}
                onChange={(patch) => update(selected.id, patch)}
                onRemove={() => removeRegion(selected.id)}
              />
            ) : (
              <p className="viz-hint">
                {state.regions.length
                  ? "Tap a stoned area to adjust its corners, size or stone."
                  : "Pick a stone on the right to mark your first area."}
              </p>
            )}

            <div className="viz-actions">
              <button
                type="button"
                className="btn"
                onClick={handleSave}
                disabled={state.regions.length === 0 || Boolean(busy)}
              >
                {isSignedIn ? "Save to my account" : "Sign in to save"}
              </button>
              <button
                type="button"
                className="tool"
                onClick={handleExport}
                disabled={state.regions.length === 0 || Boolean(busy)}
              >
                Download image
              </button>
            </div>
          </>
        )}

        {busy ? (
          <p className="viz-busy" role="status">
            {busy}
          </p>
        ) : null}
        {notice ? (
          <p className="viz-notice" role="status">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="viz-picker-col">
        <StonePicker
          stones={stones}
          onAdd={addRegion}
          disabled={!photo || state.regions.length >= MAX_REGIONS}
          disabledReason={
            !photo
              ? "Add a photo of your room first."
              : `That's the maximum of ${MAX_REGIONS} stoned areas in one mock-up.`
          }
        />

        {state.regions.length > 0 ? (
          <EstimatePanel total={grandTotal} regions={state.regions} stones={byId} />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RegionControls({
  region,
  stone,
  stones,
  onChange,
  onRemove,
}: {
  region: Region;
  stone: StoneSwatch | undefined;
  stones: StoneSwatch[];
  onChange: (patch: Partial<Region>) => void;
  onRemove: () => void;
}) {
  const estimate = estimateRegion(region, stone);
  const folded = !isConvex(asQuad(region));

  return (
    <div className="item-controls">
      <div className="item-controls-head">
        <strong>{stone?.name ?? "Stoned area"}</strong>
        <span className="item-size">
          {(region.realWidthIn / 12).toFixed(1)}′ × {(region.realHeightIn / 12).toFixed(1)}′ ·{" "}
          {estimate.netSqft.toFixed(0)} sq ft
        </span>
      </div>

      {folded ? (
        <p className="form-error" role="alert">
          Those corners cross over each other. Drag them back into a normal
          four-sided shape — top-left, top-right, bottom-right, bottom-left.
        </p>
      ) : null}

      <fieldset className="field-row">
        <legend className="field-label">How big is this area, really?</legend>
        <span className="field-note">
          This is what sizes the stone correctly and what the material estimate is worked out
          from — worth measuring rather than guessing.
        </span>
        <div className="dims">
          <label>
            Width (in)
            <input
              type="number"
              min={6}
              max={1200}
              step={1}
              value={region.realWidthIn}
              onChange={(e) => onChange({ realWidthIn: clamp(Number(e.target.value) || 6, 6, 1200) })}
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
              onChange={(e) =>
                onChange({ realHeightIn: clamp(Number(e.target.value) || 6, 6, 1200) })
              }
            />
          </label>
          <label>
            Stone
            <select value={region.stoneId} onChange={(e) => onChange({ stoneId: e.target.value })}>
              {stones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
                onChange={(e) =>
                  onChange({ cornerEdges: { ...region.cornerEdges, [edge]: e.target.checked } })
                }
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

function PhotoDrop({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);

  return (
    <label
      className={`photo-drop${over ? " is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M3 16.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.5M12 3v13m0-13 4.5 4.5M12 3 7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <strong>Add a photo of the wall or fireplace</strong>
      <span>Drag one here, or tap to choose. Shoot square-on to the wall if you can.</span>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------

async function downscale(file: File, maxEdge: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/webp", 0.9),
  );

  return { blob, url: URL.createObjectURL(blob), width, height };
}

async function toDataUrl(blob: Blob, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.72);
}
