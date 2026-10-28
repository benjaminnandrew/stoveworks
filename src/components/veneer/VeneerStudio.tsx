"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DemoBanner, usePhotoDrop } from "@/components/RoomPhoto";
import { DEMO_ROOM, DEMO_ROOM_ALT } from "@/lib/demo-room";

import {
  clamp,
  cornersFromBounds,
  estimateRegion,
  MAX_HOLES,
  MAX_REGIONS,
  newHole,
  newRegion,
  regionBounds,
  totalEstimate,
  type Bounds,
  type Region,
  type StoneSwatch,
  type VeneerState,
} from "@/lib/veneer-types";
import { exportVeneer } from "./export";
import { EstimatePanel } from "./EstimatePanel";
import { StonePicker } from "./StonePicker";
import { StoneRegion } from "./StoneRegion";
import { clearStash, loadStash, saveStash, type VeneerStash } from "./stash";

export type Photo = {
  url: string;
  width: number;
  height: number;
  roomPhotoId?: string;
  /** The built-in sample room, shown until someone uploads their own. */
  demo?: boolean;
};

type Props = {
  stones: StoneSwatch[];
  isSignedIn: boolean;
  initial?: { designId: string; title: string; photo: Photo; state: VeneerState };
};

const MAX_EDGE = 2400;
const STASH_EDGE = 1500;
/** Resize handles: four corners and four sides, by compass point. */
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

/** Smallest a region can be dragged down to, in percent of the photo. */
const MIN_SIZE = 3;

export function VeneerStudio({ stones, isSignedIn, initial }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(initial?.photo ?? DEMO_ROOM);
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
    // The sample room yields to stashed work; a real photo never does.
    if (initial || (photo && !photo.demo)) return;
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

  const { over, dropProps } = usePhotoDrop(acceptPhoto);

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
      setNotice("Drag the box over the wall you want stoned, then pull its sides or corners to fit.");
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

  /** Resize from a side or corner, keeping the region an upright rectangle. */
  const startResize = useCallback(
    (e: React.PointerEvent, region: Region, handle: Handle) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(region.id);

      const start = pointerToPct(e.clientX, e.clientY);
      const from = regionBounds(region);
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const p = pointerToPct(ev.clientX, ev.clientY);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        const next: Bounds = { ...from };
        if (handle.includes("w")) next.left = clamp(from.left + dx, -20, from.right - MIN_SIZE);
        if (handle.includes("e")) next.right = clamp(from.right + dx, from.left + MIN_SIZE, 120);
        if (handle.includes("n")) next.top = clamp(from.top + dy, -20, from.bottom - MIN_SIZE);
        if (handle.includes("s")) next.bottom = clamp(from.bottom + dy, from.top + MIN_SIZE, 120);
        update(region.id, { corners: cornersFromBounds(next) });
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

  /** Arrow keys nudge the selected region; Shift moves it further. */
  const nudge = useCallback(
    (e: React.KeyboardEvent, region: Region) => {
      const step = e.shiftKey ? 5 : 1;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      setSelectedId(region.id);
      const b = regionBounds(region);
      update(region.id, {
        corners: cornersFromBounds({
          left: b.left + d[0],
          right: b.right + d[0],
          top: b.top + d[1],
          bottom: b.bottom + d[1],
        }),
      });
    },
    [update],
  );

  /** Drag the whole region. */
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
      window.location.href = "/sign-in/?next=/veneer/";
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
      <div className={`viz-stage-col${over ? " is-drop-over" : ""}`} {...dropProps}>
        {photo ? (
          <>
            {photo.demo ? <DemoBanner onFile={acceptPhoto} /> : null}
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
                  {photo.demo ? "Use your own photo" : "Replace photo"}
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
              <img className="viz-room" src={photo.url} alt={photo.demo ? DEMO_ROOM_ALT : "Your room"} draggable={false} />

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

              {/* A plain frame over each region carries the move and resize
                  handles; the stone itself never takes pointer events. */}
              {state.regions.map((region) => {
                const isSelected = region.id === selectedId;
                const b = regionBounds(region);
                const name = byId.get(region.stoneId)?.name ?? "stone";
                return (
                  <div
                    key={`${region.id}-frame`}
                    className={`region-frame${isSelected ? " is-selected" : ""}`}
                    style={{
                      left: `${b.left}%`,
                      top: `${b.top}%`,
                      width: `${b.right - b.left}%`,
                      height: `${b.bottom - b.top}%`,
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${name} area. Drag to move, or use the arrow keys.`}
                    aria-pressed={isSelected}
                    onPointerDown={(e) => startRegionDrag(e, region)}
                    onKeyDown={(e) => nudge(e, region)}
                  >
                    {isSelected
                      ? HANDLES.map((h) => (
                          <span
                            key={h}
                            className={`resize-handle is-${h}`}
                            onPointerDown={(e) => startResize(e, region, h)}
                            aria-hidden="true"
                          />
                        ))
                      : null}
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
                  ? "Tap a stoned area to move it, resize it from its sides or corners, or change the stone."
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
        ) : null}

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

  return (
    <div className="item-controls">
      <div className="item-controls-head">
        <strong>{stone?.name ?? "Stoned area"}</strong>
        <span className="item-size">
          {(region.realWidthIn / 12).toFixed(1)}′ × {(region.realHeightIn / 12).toFixed(1)}′ ·{" "}
          {estimate.netSqft.toFixed(0)} sq ft
        </span>
      </div>

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
