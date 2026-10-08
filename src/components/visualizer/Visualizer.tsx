"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clamp,
  MAX_ITEMS,
  newItem,
  type DesignState,
  type PlaceableProduct,
  type PlacedItem,
} from "@/lib/design-types";
import { loadStash, saveStash, clearStash, type Stash } from "./stash";
import { exportDesign } from "./export";
import { ProductPicker } from "./ProductPicker";

export type Photo = { url: string; width: number; height: number; roomPhotoId?: string };

type Props = {
  products: PlaceableProduct[];
  isSignedIn: boolean;
  /** Reopening a saved design. */
  initial?: { designId: string; title: string; photo: Photo; state: DesignState };
};

const MAX_EDGE = 2400;
const STASH_EDGE = 1500;

export function Visualizer({ products, isSignedIn, initial }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(initial?.photo ?? null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [design, setDesign] = useState<DesignState>(
    initial?.state ?? { items: [], pctPerInch: null },
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [designId, setDesignId] = useState(initial?.designId ?? null);

  const stageRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selected = design.items.find((i) => i.id === selectedId) ?? null;

  // --- restore work stashed before a sign-in round trip ---------------------

  useEffect(() => {
    if (initial || photo) return;
    const stash = loadStash();
    if (!stash) return;
    setPhoto({ url: stash.dataUrl, width: stash.width, height: stash.height });
    setDesign(stash.design);
    setTitle(stash.title);
    fetch(stash.dataUrl)
      .then((r) => r.blob())
      .then(setPhotoBlob)
      .catch(() => undefined);
    setNotice("Picked up where you left off.");
    clearStash();
  }, [initial, photo]);

  // --- photo input ----------------------------------------------------------

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
      setDesign({ items: [], pctPerInch: null });
      setSelectedId(null);
      setDesignId(null);
      setNotice(null);
    } catch {
      setNotice("We couldn't read that image. Try a different photo.");
    } finally {
      setBusy(null);
    }
  }, []);

  // --- item manipulation ----------------------------------------------------

  const update = useCallback((id: string, patch: Partial<PlacedItem>) => {
    setDesign((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  const addProduct = useCallback(
    (product: PlaceableProduct) => {
      if (!photo || design.items.length >= MAX_ITEMS) return;

      // Built outside the updater: state updaters must stay pure, and this one
      // has a side effect (selecting the new item).
      const item = newItem(product, photo.width / photo.height, design.pctPerInch);
      setDesign((d) => ({ ...d, items: [...d.items, item] }));
      setSelectedId(item.id);
    },
    [photo, design.items.length, design.pctPerInch],
  );

  const removeItem = useCallback((id: string) => {
    setDesign((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  // Dragging and scaling both work in stage-percentage space, so the maths is
  // identical whatever size the stage is rendered at.
  const pointerToPct = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      xPct: ((clientX - rect.left) / rect.width) * 100,
      yPct: ((clientY - rect.top) / rect.height) * 100,
      rect,
    };
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent, item: PlacedItem) => {
      if (calibrating) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(item.id);

      const start = pointerToPct(e.clientX, e.clientY);
      const offsetX = item.xPct - start.xPct;
      const offsetY = item.yPct - start.yPct;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const p = pointerToPct(ev.clientX, ev.clientY);
        update(item.id, {
          xPct: clamp(p.xPct + offsetX, -10, 110),
          yPct: clamp(p.yPct + offsetY, -10, 110),
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
    [calibrating, pointerToPct, update],
  );

  const startScale = useCallback(
    (e: React.PointerEvent, item: PlacedItem) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(item.id);

      const startPct = pointerToPct(e.clientX, e.clientY);
      // Distance from the item's own centre line drives the width.
      const startHalf = Math.max(Math.abs(startPct.xPct - item.xPct), 0.5);
      const startWidth = item.widthPct;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const p = pointerToPct(ev.clientX, ev.clientY);
        const half = Math.max(Math.abs(p.xPct - item.xPct), 0.5);
        update(item.id, { widthPct: clamp(startWidth * (half / startHalf), 3, 150) });
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

  // Keyboard is the reliable path on every device, and the accessible one.
  const onStageKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selected) return;
      const step = e.shiftKey ? 5 : 1;
      const map: Record<string, () => void> = {
        ArrowLeft: () => update(selected.id, { xPct: clamp(selected.xPct - step, -10, 110) }),
        ArrowRight: () => update(selected.id, { xPct: clamp(selected.xPct + step, -10, 110) }),
        ArrowUp: () => update(selected.id, { yPct: clamp(selected.yPct - step, -10, 110) }),
        ArrowDown: () => update(selected.id, { yPct: clamp(selected.yPct + step, -10, 110) }),
        "+": () => update(selected.id, { widthPct: clamp(selected.widthPct * 1.05, 3, 150) }),
        "=": () => update(selected.id, { widthPct: clamp(selected.widthPct * 1.05, 3, 150) }),
        "-": () => update(selected.id, { widthPct: clamp(selected.widthPct / 1.05, 3, 150) }),
        "[": () => update(selected.id, { rotation: clamp(selected.rotation - 2, -180, 180) }),
        "]": () => update(selected.id, { rotation: clamp(selected.rotation + 2, -180, 180) }),
        Delete: () => removeItem(selected.id),
        Backspace: () => removeItem(selected.id),
      };
      const fn = map[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    },
    [selected, update, removeItem],
  );

  // --- calibration ----------------------------------------------------------

  const [calLine, setCalLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  );

  const startCalibration = useCallback(
    (e: React.PointerEvent) => {
      if (!calibrating) return;
      e.preventDefault();
      const start = pointerToPct(e.clientX, e.clientY);
      setCalLine({ x1: start.xPct, y1: start.yPct, x2: start.xPct, y2: start.yPct });

      const move = (ev: PointerEvent) => {
        const p = pointerToPct(ev.clientX, ev.clientY);
        setCalLine((l) => (l ? { ...l, x2: p.xPct, y2: p.yPct } : l));
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    },
    [calibrating, pointerToPct],
  );

  const applyCalibration = useCallback(
    (inches: number) => {
      if (!calLine || !photo || inches <= 0) return;
      const aspect = photo.width / photo.height;
      // Convert the drawn line to a length in "percent of photo width".
      const dx = calLine.x2 - calLine.x1;
      const dy = (calLine.y2 - calLine.y1) / aspect;
      const lengthPct = Math.hypot(dx, dy);
      if (lengthPct < 1) return;

      const pctPerInch = lengthPct / inches;

      setDesign((d) => ({
        pctPerInch,
        // Re-size everything already placed to its true dimensions.
        items: d.items.map((i) => {
          const p = byId.get(i.productId);
          const widthIn = p?.widthIn;
          return widthIn ? { ...i, widthPct: clamp(widthIn * pctPerInch, 3, 150) } : i;
        }),
      }));
      setCalibrating(false);
      setCalLine(null);
      setNotice("Scale set — products are now sized to their real dimensions.");
    },
    [calLine, photo, byId],
  );

  // --- save / export --------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!photo || design.items.length === 0) return;

    if (!isSignedIn) {
      setBusy("Saving your work…");
      try {
        const dataUrl = await toDataUrl(photoBlob ?? (await (await fetch(photo.url)).blob()), STASH_EDGE);
        const stash: Stash = {
          dataUrl,
          width: photo.width,
          height: photo.height,
          design,
          title,
        };
        saveStash(stash);
      } catch {
        // Stashing is a convenience; never block the sign-in on it.
      } finally {
        setBusy(null);
      }
      window.location.href = "/sign-in/?next=/visualizer/";
      return;
    }

    setBusy("Saving design…");
    try {
      let roomPhotoId = photo.roomPhotoId;

      if (!roomPhotoId) {
        const blob = photoBlob ?? (await (await fetch(photo.url)).blob());
        const body = new FormData();
        body.append("photo", blob, "room.webp");
        const res = await fetch("/api/photos", { method: "POST", body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
        const data = await res.json();
        roomPhotoId = data.id as string;
        setPhoto((p) => (p ? { ...p, roomPhotoId } : p));
      }

      const res = await fetch(designId ? `/api/designs/${designId}` : "/api/designs", {
        method: designId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomPhotoId,
          title: title.trim() || "Untitled design",
          items: design.items,
          pctPerInch: design.pctPerInch,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");

      const data = await res.json();
      setDesignId(data.id);
      setNotice("Saved to your account.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong saving that.");
    } finally {
      setBusy(null);
    }
  }, [photo, photoBlob, design, isSignedIn, title, designId]);

  const handleExport = useCallback(async () => {
    if (!photo) return;
    setBusy("Building your image…");
    try {
      await exportDesign(photo, design, byId, title || "hayward-stoveworks-design");
    } catch {
      setNotice("We couldn't build that image. Try again.");
    } finally {
      setBusy(null);
    }
  }, [photo, design, byId, title]);

  // --- render ---------------------------------------------------------------

  const aspect = photo ? `${photo.width} / ${photo.height}` : "3 / 2";
  const calInches = useRef<HTMLInputElement>(null);

  return (
    <div className="viz">
      <div className="viz-stage-col">
        {!photo ? (
          <PhotoDrop onFile={acceptPhoto} />
        ) : (
          <>
            <div className="viz-toolbar">
              <label className="viz-title-field">
                <span className="visually-hidden">Design name</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this design"
                  maxLength={80}
                />
              </label>

              <div className="viz-tools">
                <button
                  type="button"
                  className={`tool${calibrating ? " is-on" : ""}`}
                  onClick={() => {
                    setCalibrating((v) => !v);
                    setCalLine(null);
                    setSelectedId(null);
                  }}
                  aria-pressed={calibrating}
                >
                  {design.pctPerInch ? "Re-set scale" : "Set scale"}
                </button>
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

            {calibrating ? (
              <div className="cal-panel">
                <p>
                  <strong>Set the scale.</strong> Drag a line across something you know the size
                  of — a door is usually 80″ tall and 32″ wide, a standard brick 8″ long. Then enter
                  that measurement.
                </p>
                <div className="cal-controls">
                  <label>
                    That line is
                    <input
                      ref={calInches}
                      type="number"
                      min={1}
                      max={400}
                      step={0.5}
                      defaultValue={80}
                      disabled={!calLine}
                    />
                    inches
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={!calLine}
                    onClick={() => applyCalibration(Number(calInches.current?.value ?? 0))}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="tool"
                    onClick={() => {
                      setCalibrating(false);
                      setCalLine(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
              ref={stageRef}
              className={`viz-stage${calibrating ? " is-calibrating" : ""}`}
              style={{ aspectRatio: aspect }}
              onPointerDown={calibrating ? startCalibration : () => setSelectedId(null)}
              onKeyDown={onStageKeyDown}
              tabIndex={0}
              role="application"
              aria-label="Room preview — select a product, then use the arrow keys to move it"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="viz-room" src={photo.url} alt="Your room" draggable={false} />

              {design.items.map((item) => {
                const product = byId.get(item.productId);
                if (!product) return null;
                const isSelected = item.id === selectedId;

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
                    onPointerDown={(e) => startDrag(e, item)}
                  >
                    <span
                      className="viz-shadow"
                      style={{ opacity: item.shadow }}
                      aria-hidden="true"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      draggable={false}
                      style={{ transform: item.flipped ? "scaleX(-1)" : undefined }}
                    />
                    {isSelected ? (
                      <span
                        className="viz-handle"
                        onPointerDown={(e) => startScale(e, item)}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                );
              })}

              {calLine ? (
                <svg className="cal-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line
                    x1={calLine.x1}
                    y1={calLine.y1}
                    x2={calLine.x2}
                    y2={calLine.y2}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : null}
            </div>

            {selected ? (
              <ItemControls
                item={selected}
                product={byId.get(selected.productId) ?? null}
                pctPerInch={design.pctPerInch}
                onChange={(patch) => update(selected.id, patch)}
                onRemove={() => removeItem(selected.id)}
              />
            ) : (
              <p className="viz-hint">
                {design.items.length
                  ? "Tap a product in the photo to move or resize it."
                  : "Now pick a stove, insert or fireplace to drop into the room."}
              </p>
            )}

            <div className="viz-actions">
              <button
                type="button"
                className="btn"
                onClick={handleSave}
                disabled={design.items.length === 0 || Boolean(busy)}
              >
                {isSignedIn ? "Save to my account" : "Sign in to save"}
              </button>
              <button
                type="button"
                className="tool"
                onClick={handleExport}
                disabled={design.items.length === 0 || Boolean(busy)}
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
        <ProductPicker
          products={products}
          onAdd={addProduct}
          disabled={!photo || design.items.length >= MAX_ITEMS}
          disabledReason={
            !photo
              ? "Add a photo of your room first."
              : `That's the maximum of ${MAX_ITEMS} products in one design.`
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ItemControls({
  item,
  product,
  pctPerInch,
  onChange,
  onRemove,
}: {
  item: PlacedItem;
  product: PlaceableProduct | null;
  pctPerInch: number | null;
  onChange: (patch: Partial<PlacedItem>) => void;
  onRemove: () => void;
}) {
  const inches = pctPerInch ? item.widthPct / pctPerInch : null;

  return (
    <div className="item-controls">
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
      <strong>Add a photo of your room</strong>
      <span>Drag one here, or tap to choose. Straight-on shots of the wall work best.</span>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Image helpers — keep big phone photos out of the network and out of memory.
// ---------------------------------------------------------------------------

async function downscale(file: File, maxEdge: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
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
