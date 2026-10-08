"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { signOutQuietlyAction } from "@/app/account/actions";

import {
  clamp,
  MAX_ITEMS,
  newItem,
  parseDesignState,
  type DesignState,
  type PlaceableProduct,
  type PlacedItem,
} from "@/lib/design-types";
import type { Point } from "@/lib/homography";
import {
  SAMPLE_PRESETS,
  SAMPLE_ROOM,
  pickSampleStone,
  pickSampleStove,
  sampleDesign,
} from "@/lib/sample-room";
import {
  addItem,
  addRegion,
  anchorItem,
  effectivePctPerInch,
  fitToNewPhoto,
  itemProductId,
  moveCorner,
  newRegionAt,
  presetCorners,
  refreshDims,
  regionAt,
  regionStoneId,
  removeItem,
  removeRegion,
  resolveItems,
  resolveRegions,
  setItemProduct,
  setRegionStone,
  snapshotCompare,
  translateCorners,
  withShapeDims,
  type Corners,
  type ShapePreset,
  type ViewIndex,
} from "@/lib/studio";
import { MAX_REGIONS, totalEstimate, type Region, type StoneSwatch } from "@/lib/veneer-types";

import { ItemControls, RegionControls } from "./Controls";
import { EstimatePanel } from "./EstimatePanel";
import { exportDesign } from "./export";
import { ProductPicker } from "./ProductPicker";
import { Scene, type ScenePhoto, type Selection } from "./Scene";
import { clearStash, loadStash, saveStash } from "./stash";
import { StonePicker } from "./StonePicker";

export type StudioPhoto = ScenePhoto & {
  /** Set once the photo has been uploaded to the customer's account. */
  roomPhotoId?: string;
  /** What the toolbar calls it: the file name, the design, or the sample room. */
  label: string;
  isSample: boolean;
};

export type Layer = "stove" | "stone";

type Props = {
  products: PlaceableProduct[];
  stones: StoneSwatch[];
  isSignedIn: boolean;
  /** Which layer's controls open first — `/veneer/` sends people to the stone. */
  initialLayer?: Layer;
  /** Reopening a saved design. */
  initial?: { designId: string; title: string; photo: StudioPhoto; state: DesignState };
  /** Set when arriving back from sign-in: which stashed piece of work to pick up. */
  resumeId?: string | null;
};

const MAX_EDGE = 2400;
const STASH_EDGE = 1500;
const SHOP_KEY = "sw_studio_shop_mode";
const VIEW_NAMES = ["A", "B"] as const;

const SAMPLE_PHOTO: StudioPhoto = {
  url: SAMPLE_ROOM.url,
  width: SAMPLE_ROOM.width,
  height: SAMPLE_ROOM.height,
  label: SAMPLE_ROOM.label,
  isSample: true,
};

/**
 * Room Studio: a stove and the stone behind it, in one photo of the customer's
 * own room, with a second view to compare choices side by side.
 *
 * It opens on an illustrated sample room so there is something to play with
 * straight away. Stone is a layer behind the products; both layers are dragged
 * and sized independently, and both share one scale — set once against
 * something of known size, it gives stoves their true width and stone areas
 * their real dimensions.
 */
export function RoomStudio({ products, stones, isSignedIn, initialLayer, initial, resumeId }: Props) {
  const router = useRouter();
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const stonesById = useMemo(() => new Map(stones.map((s) => [s.id, s])), [stones]);
  const defaultStone = useMemo(() => pickSampleStone(stones), [stones]);
  const freshSample = useCallback(
    () => sampleDesign(pickSampleStove(products), pickSampleStone(stones)),
    [products, stones],
  );

  const [photo, setPhoto] = useState<StudioPhoto>(initial?.photo ?? SAMPLE_PHOTO);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [design, setDesign] = useState<DesignState>(() => initial?.state ?? freshSample());
  const [designId, setDesignId] = useState(initial?.designId ?? null);
  const [comparing, setComparing] = useState(Boolean(initial?.state.compare));
  const [activeView, setActiveView] = useState<ViewIndex>(0);
  const [layer, setLayer] = useState<Layer>(initialLayer ?? "stove");
  const [selection, setSelection] = useState<Selection>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calLine, setCalLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [shop, setShop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const calInches = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const aspect = photo.width / photo.height;
  const view: ViewIndex = comparing ? activeView : 0;
  const views: ViewIndex[] = comparing ? [0, 1] : [0];

  const resolved = useMemo(
    () =>
      views.map((v) => ({
        v,
        items: resolveItems(design, v, productsById),
        regions: resolveRegions(design, v, stonesById),
      })),
    // `views` is derived from `comparing`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [design, comparing, productsById, stonesById],
  );

  const selectedItem =
    selection?.kind === "item" ? design.items.find((i) => i.id === selection.id) : undefined;
  const selectedRegion =
    selection?.kind === "region" ? design.regions.find((r) => r.id === selection.id) : undefined;

  // The nav links to ?layer=stone; following it from the studio keeps this
  // component mounted, so the prop change has to be picked up here.
  useEffect(() => {
    if (initialLayer) setLayer(initialLayer);
  }, [initialLayer]);

  // --- restore: shop mode on this device, and work stashed before sign-in ---

  useEffect(() => {
    try {
      setShop(localStorage.getItem(SHOP_KEY) === "1");
    } catch {
      // Storage blocked: shop mode just starts off.
    }
  }, []);

  useEffect(() => {
    // Reading also sweeps out a stash past its two hours, wherever the studio opens.
    const stash = loadStash();
    // Only the work this sign-in was started for — never whatever the last
    // person on this device left behind.
    if (initial || !stash || !resumeId || stash.id !== resumeId) return;
    clearStash();
    window.history.replaceState(null, "", "/visualizer/");
    if (stash.dataUrl) {
      setPhoto({ url: stash.dataUrl, width: stash.width, height: stash.height, label: stash.label, isSample: false });
      fetch(stash.dataUrl)
        .then((r) => r.blob())
        .then(setPhotoBlob)
        .catch(() => undefined);
    }
    const restored = parseDesignState(stash.design);
    setDesign(restored);
    setComparing(stash.comparing && Boolean(restored.compare));
    setTitle(stash.title);
    setNotice(
      isSignedIn
        ? "Picked up where you left off. Save it to your account to keep it."
        : "Picked up where you left off.",
    );
    // Runs once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 5000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  // --- small state helpers ----------------------------------------------------

  const updateItem = useCallback((id: string, patch: Partial<PlacedItem>) => {
    setDesign((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }, []);

  /** Region updates re-read an unmeasured area's size from its new shape. */
  const updateRegion = useCallback(
    (id: string, patch: Partial<Region> | ((r: Region) => Region)) => {
      setDesign((d) => {
        const pct = effectivePctPerInch(d, aspect);
        return {
          ...d,
          regions: d.regions.map((r) => {
            if (r.id !== id) return r;
            const next = typeof patch === "function" ? patch(r) : { ...r, ...patch };
            return withShapeDims(next, aspect, pct);
          }),
        };
      });
    },
    [aspect],
  );

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next?.kind === "item") setLayer("stove");
    if (next?.kind === "region") setLayer("stone");
  }, []);

  // --- photo ------------------------------------------------------------------

  const acceptPhoto = useCallback(
    async (file: File) => {
      // A save in flight would otherwise attach this new photo to the old design.
      if (busy) return;
      if (!file.type.startsWith("image/")) {
        setNotice("That file isn't an image. Try a JPEG, PNG or HEIC photo.");
        return;
      }
      setBusy("Reading your photo…");
      try {
        const { blob, url, width, height } = await downscale(file, MAX_EDGE);
        const fromSample = photo.isSample;
        setPhoto((prev) => {
          if (prev.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
          return { url, width, height, label: file.name, isSample: false };
        });
        setPhotoBlob(blob);
        setDesign((d) => fitToNewPhoto(d, { fromSample, photoAspect: width / height, products: productsById }));
        setDesignId(null);
        setSelection(null);
        setShowOriginal(false);
        setCalibrating(false);
        setCalLine(null);
        setNotice(
          "Your room is in. Drag the stove onto the floor and the stone's corners onto the wall, then Set scale for true sizes.",
        );
      } catch {
        setNotice("We couldn't read that image. Try a different photo.");
      } finally {
        setBusy(null);
      }
    },
    [busy, photo.isSample, productsById],
  );

  // --- pointer interaction ---------------------------------------------------

  /** Follows a drag in stage percentages until the pointer lifts. */
  const track = useCallback(
    (e: React.PointerEvent, onMove: (p: Point, start: Point) => void) => {
      const stage = (e.currentTarget as HTMLElement).closest(".studio-stage") as HTMLElement | null;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const toPct = (ev: { clientX: number; clientY: number }) => ({
        x: ((ev.clientX - rect.left) / rect.width) * 100,
        y: ((ev.clientY - rect.top) / rect.height) * 100,
      });
      const start = toPct(e);
      const target = e.currentTarget as Element;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events have no live pointer to capture; the window listeners still track it.
      }
      const move = (ev: PointerEvent) => onMove(toPct(ev), start);
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      return start;
    },
    [],
  );

  const onStagePointerDown = useCallback(
    (v: ViewIndex) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (comparing) setActiveView(v);

      if (calibrating) {
        e.preventDefault();
        const start = track(e, (p, s) => setCalLine({ x1: s.x, y1: s.y, x2: p.x, y2: p.y }));
        if (start) setCalLine({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
        return;
      }
      if (showOriginal) return;

      // Products are their own elements and catch their own presses; anything
      // reaching the stage is either on stone or on bare room.
      const rect = e.currentTarget.getBoundingClientRect();
      const point = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
      const visible = resolveRegions(design, v, stonesById).map((r) => r.region);
      const hit = regionAt(visible, point);
      if (!hit) {
        setSelection(null);
        return;
      }

      e.preventDefault();
      select({ kind: "region", id: hit.id });
      const origin = hit.corners;
      track(e, (p, s) => updateRegion(hit.id, { corners: translateCorners(origin, p.x - s.x, p.y - s.y) }));
    },
    [calibrating, comparing, design, select, showOriginal, stonesById, track, updateRegion],
  );

  const onItemPointerDown = useCallback(
    (v: ViewIndex) => (e: React.PointerEvent<HTMLDivElement>, itemId: string) => {
      if (calibrating || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (comparing) setActiveView(v);
      select({ kind: "item", id: itemId });
      const item = design.items.find((i) => i.id === itemId);
      if (!item) return;
      const origin = { x: item.xPct, y: item.yPct };
      track(e, (p, s) =>
        updateItem(itemId, {
          xPct: clamp(origin.x + p.x - s.x, -10, 110),
          yPct: clamp(origin.y + p.y - s.y, -10, 110),
        }),
      );
    },
    [calibrating, comparing, design.items, select, track, updateItem],
  );

  const onScalePointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>, itemId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const item = design.items.find((i) => i.id === itemId);
      if (!item) return;
      const startWidth = item.widthPct;
      // Distance from the item's centre line drives the width.
      track(e, (p, s) => {
        const startHalf = Math.max(Math.abs(s.x - item.xPct), 0.5);
        const half = Math.max(Math.abs(p.x - item.xPct), 0.5);
        updateItem(itemId, { widthPct: clamp(startWidth * (half / startHalf), 3, 150) });
      });
    },
    [design.items, track, updateItem],
  );

  const onCornerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, region: Region, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const origin = region.corners;
      track(e, (p) => {
        const next = moveCorner(origin, index, p);
        if (next) updateRegion(region.id, { corners: next });
      });
    },
    [track, updateRegion],
  );

  const onCornerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, region: Region, index: number) => {
      if (e.key === "Escape" || e.key === "Delete" || e.key === "Backspace") {
        // These deselect or remove the area, taking this handle with it. Move
        // focus to the stage first; the key then carries on to the stage's own
        // handler.
        (e.currentTarget.closest(".studio-stage") as HTMLElement | null)?.focus();
        return;
      }
      const step = e.shiftKey ? 2.5 : 0.5;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      const c = region.corners[index];
      const next = moveCorner(region.corners, index, { x: c.x + d[0], y: c.y + d[1] });
      if (next) updateRegion(region.id, { corners: next });
    },
    [updateRegion],
  );

  // Keyboard is the reliable path on every device, and the accessible one.
  const onStageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        setSelection(null);
        return;
      }
      const big = e.shiftKey;
      if (selectedItem) {
        const step = big ? 5 : 1;
        const i = selectedItem;
        const map: Record<string, () => void> = {
          ArrowLeft: () => updateItem(i.id, { xPct: clamp(i.xPct - step, -10, 110) }),
          ArrowRight: () => updateItem(i.id, { xPct: clamp(i.xPct + step, -10, 110) }),
          ArrowUp: () => updateItem(i.id, { yPct: clamp(i.yPct - step, -10, 110) }),
          ArrowDown: () => updateItem(i.id, { yPct: clamp(i.yPct + step, -10, 110) }),
          "+": () => updateItem(i.id, { widthPct: clamp(i.widthPct * 1.05, 3, 150) }),
          "=": () => updateItem(i.id, { widthPct: clamp(i.widthPct * 1.05, 3, 150) }),
          "-": () => updateItem(i.id, { widthPct: clamp(i.widthPct / 1.05, 3, 150) }),
          "[": () => updateItem(i.id, { rotation: clamp(i.rotation - 2, -180, 180) }),
          "]": () => updateItem(i.id, { rotation: clamp(i.rotation + 2, -180, 180) }),
          Delete: () => deleteItem(i.id),
          Backspace: () => deleteItem(i.id),
        };
        const fn = map[e.key];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (selectedRegion) {
        const step = big ? 2.5 : 0.5;
        const r = selectedRegion;
        const move = (dx: number, dy: number) =>
          updateRegion(r.id, { corners: translateCorners(r.corners, dx, dy) });
        const map: Record<string, () => void> = {
          ArrowLeft: () => move(-step, 0),
          ArrowRight: () => move(step, 0),
          ArrowUp: () => move(0, -step),
          ArrowDown: () => move(0, step),
          Delete: () => deleteRegion(r.id),
          Backspace: () => deleteRegion(r.id),
        };
        const fn = map[e.key];
        if (fn) {
          e.preventDefault();
          fn();
        }
      }
    },
    // deleteItem/deleteRegion are stable function declarations below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedItem, selectedRegion, updateItem, updateRegion],
  );

  // --- products ----------------------------------------------------------------

  function deleteItem(id: string) {
    setDesign((d) => removeItem(d, id));
    setSelection((cur) => (cur?.kind === "item" && cur.id === id ? null : cur));
  }

  const pickProduct = useCallback(
    (product: PlaceableProduct) => {
      if (selectedItem) {
        setDesign((d) => setItemProduct(d, selectedItem.id, product.id, view, productsById));
        setNotice(`${product.name} ${comparing ? `in view ${VIEW_NAMES[view]}` : "in the room"}.`);
        return;
      }
      if (design.items.length >= MAX_ITEMS) {
        setNotice(`That's the maximum of ${MAX_ITEMS} products in one design.`);
        return;
      }
      const item = newItem(product, aspect, design.pctPerInch);
      setDesign((d) => addItem(d, item));
      select({ kind: "item", id: item.id });
      setNotice(`${product.name} added. Drag it into place.`);
    },
    [aspect, comparing, design.items.length, design.pctPerInch, productsById, select, selectedItem, view],
  );

  // --- stone -------------------------------------------------------------------

  function deleteRegion(id: string) {
    setDesign((d) => removeRegion(d, id));
    setSelection((cur) => (cur?.kind === "region" && cur.id === id ? null : cur));
  }

  const shapeFor = useCallback(
    (preset: ShapePreset, offset = 0): Corners => {
      if (photo.isSample) {
        const corners = presetCorners(preset, { rects: SAMPLE_PRESETS });
        return offset ? translateCorners(corners, offset, 0) : corners;
      }
      const anchor = anchorItem(design, productsById);
      return presetCorners(preset, { anchorX: (anchor?.xPct ?? 50) + offset });
    },
    [design, photo.isSample, productsById],
  );

  const createRegion = useCallback(
    (stoneId: string, preset: ShapePreset = "accent") => {
      if (design.regions.length >= MAX_REGIONS) {
        setNotice(`That's the maximum of ${MAX_REGIONS} stone areas in one design.`);
        return;
      }
      const region = newRegionAt(
        stoneId,
        shapeFor(preset, design.regions.length * 4),
        aspect,
        effectivePctPerInch(design, aspect),
      );
      setDesign((d) => addRegion(d, region));
      select({ kind: "region", id: region.id });
      setNotice("Stone added behind the stove. Drag it, or drag its corners onto the wall.");
    },
    [aspect, design, select, shapeFor],
  );

  /** The area a stone pick or a shape button applies to: the selected one, else the first. */
  const targetRegion = selectedRegion ?? design.regions[0];

  const pickStone = useCallback(
    (stone: StoneSwatch | null) => {
      if (!targetRegion) {
        if (stone) createRegion(stone.id);
        return;
      }
      setDesign((d) => setRegionStone(d, targetRegion.id, stone?.id ?? null, view));
      select({ kind: "region", id: targetRegion.id });
      setNotice(
        `${stone ? `${stone.brandName ? `${stone.brandName} ` : ""}${stone.texture}` : "Bare wall"}${
          comparing ? ` in view ${VIEW_NAMES[view]}` : ""
        }.`,
      );
    },
    [comparing, createRegion, select, targetRegion, view],
  );

  const applyShape = useCallback(
    (preset: ShapePreset) => {
      if (!targetRegion) {
        if (defaultStone) createRegion(defaultStone.id, preset);
        return;
      }
      // A new shape is a new area: any size typed in for the old one no longer applies.
      updateRegion(targetRegion.id, { corners: shapeFor(preset), measured: false });
      select({ kind: "region", id: targetRegion.id });
    },
    [createRegion, defaultStone, select, shapeFor, targetRegion, updateRegion],
  );

  // --- compare, shop mode, start over ------------------------------------------

  const toggleCompare = useCallback(() => {
    if (comparing) {
      setComparing(false);
      setActiveView(0);
      setNotice(null);
      return;
    }
    const resuming = design.compare !== null;
    setDesign((d) => (d.compare ? d : { ...d, compare: snapshotCompare(d) }));
    setComparing(true);
    setActiveView(1);
    setNotice(
      resuming
        ? "Comparing again — view B is as you left it. Moving or resizing anything moves it in both."
        : "Comparing. View B starts as a copy of A — pick a different stove or stone for it. Moving or resizing anything moves it in both.",
    );
  }, [comparing, design.compare]);

  const toggleShop = useCallback(() => {
    setShop((s) => {
      const next = !s;
      try {
        localStorage.setItem(SHOP_KEY, next ? "1" : "0");
      } catch {
        // Not remembered on this device; still works for this visit.
      }
      return next;
    });
  }, []);

  const startOver = useCallback(() => {
    if (busy) return;
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    clearStash();
    // A shared showroom screen must not hand one customer's account to the next.
    if (shop && isSignedIn) {
      void signOutQuietlyAction().then(() => router.refresh());
    }
    setPhoto((prev) => {
      if (prev.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return SAMPLE_PHOTO;
    });
    setPhotoBlob(null);
    setDesign(freshSample());
    setDesignId(null);
    setTitle("");
    setComparing(false);
    setActiveView(0);
    setSelection(null);
    setLayer("stove");
    setShowOriginal(false);
    setCalibrating(false);
    setCalLine(null);
    setNotice(shop ? "Ready for the next customer." : "Started over with the sample room.");
  }, [busy, confirmReset, freshSample, isSignedIn, router, shop]);

  // --- calibration ---------------------------------------------------------------

  const applyCalibration = useCallback(
    (inches: number) => {
      if (!calLine || inches <= 0) return;
      const dx = calLine.x2 - calLine.x1;
      const dy = (calLine.y2 - calLine.y1) / aspect;
      const lengthPct = Math.hypot(dx, dy);
      if (lengthPct < 1) return;
      const pctPerInch = lengthPct / inches;

      setDesign((d) =>
        refreshDims(
          {
            ...d,
            pctPerInch,
            // Re-size everything already placed to its true dimensions.
            items: d.items.map((i) => {
              const widthIn = productsById.get(i.productId)?.widthIn;
              return widthIn ? { ...i, widthPct: clamp(widthIn * pctPerInch, 3, 150) } : i;
            }),
          },
          aspect,
        ),
      );
      setCalibrating(false);
      setCalLine(null);
      setNotice("Scale set — products and stone areas now read at their real size.");
    },
    [aspect, calLine, productsById],
  );

  // --- save and export -------------------------------------------------------------

  const hasContent = design.items.length > 0 || design.regions.length > 0;

  const handleSave = useCallback(async () => {
    if (!hasContent) return;
    const toSave: DesignState = { ...design, compare: comparing ? design.compare : null };

    if (!isSignedIn) {
      setBusy("Saving your work…");
      const id = newStashId();
      try {
        const dataUrl = photo.isSample
          ? null
          : await toDataUrl(photoBlob ?? (await (await fetch(photo.url)).blob()), STASH_EDGE);
        saveStash({
          id,
          dataUrl,
          width: photo.width,
          height: photo.height,
          label: photo.label,
          design: toSave,
          comparing,
          title,
        });
      } catch {
        // Stashing is a convenience; never block the sign-in on it.
      } finally {
        setBusy(null);
      }
      window.location.href = `/sign-in/?next=${encodeURIComponent(`/visualizer/?resume=${id}`)}`;
      return;
    }

    setBusy("Saving your design…");
    try {
      let roomPhotoId = photo.roomPhotoId;
      if (!roomPhotoId) {
        const blob = photoBlob ?? (await (await fetch(photo.url)).blob());
        const body = new FormData();
        body.append("photo", blob, photo.isSample ? "sample-room.webp" : "room.webp");
        const res = await fetch("/api/photos", { method: "POST", body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
        roomPhotoId = (await res.json()).id as string;
        setPhoto((p) => ({ ...p, roomPhotoId }));
      }

      const res = await fetch(designId ? `/api/designs/${designId}` : "/api/designs", {
        method: designId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomPhotoId, title: title.trim() || "Untitled design", ...toSave }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      setDesignId((await res.json()).id);
      setNotice("Saved to your account.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong saving that.");
    } finally {
      setBusy(null);
    }
  }, [comparing, design, designId, hasContent, isSignedIn, photo, photoBlob, title]);

  const handleExport = useCallback(async () => {
    setBusy("Building your image…");
    try {
      await exportDesign(
        photo,
        resolved.map(({ v, items, regions }) => ({
          label: comparing ? `Option ${VIEW_NAMES[v]}: ${viewSummary(design, v, productsById, stonesById)}` : null,
          items,
          regions,
        })),
        design.occluders,
        title || "hayward-stoveworks-room",
      );
    } catch {
      setNotice("We couldn't build that image. Try again.");
    } finally {
      setBusy(null);
    }
  }, [comparing, design, photo, productsById, resolved, stonesById, title]);

  // --- render ----------------------------------------------------------------------

  const isCalibrated = design.pctPerInch !== null;
  const estimate = useMemo(
    () =>
      totalEstimate(
        resolveRegions(design, view, stonesById).map((r) => r.region),
        stonesById,
      ),
    [design, stonesById, view],
  );
  const viewRegions = resolved.find((r) => r.v === view)?.regions ?? [];
  /** The selected product as the view being edited shows it. */
  const shownItem = selectedItem
    ? resolved.find((r) => r.v === view)?.items.find((r) => r.item.id === selectedItem.id)
    : undefined;
  const areaNumbers = new Map(design.regions.map((r, i) => [r.id, i + 1]));
  /** How far to trust the estimate's sizes — said plainly under it. */
  const sizeBasis = viewRegions.every((r) => r.region.measured)
    ? "measured"
    : isCalibrated
      ? "scale"
      : "guess";

  const hint = calibrating
    ? null
    : selectedItem
      ? "Drag the product to move it, or the yellow handle to resize. Arrow keys nudge it."
      : selectedRegion
        ? "Drag the stone to move it, or its corners to fit the wall. Arrow keys nudge it."
        : "Tap the stove or the stone to adjust it.";

  return (
    <div className={`studio${shop ? " is-shop" : ""}`}>
      <div className="studio-main">
        <div className="studio-toolbar">
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
              className={photo.isSample ? "btn studio-upload" : "tool"}
              onClick={() => fileInput.current?.click()}
              disabled={Boolean(busy)}
            >
              {photo.isSample ? "Upload your room" : "Replace photo"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void acceptPhoto(file);
              }}
            />
            <button
              type="button"
              className={`tool${calibrating ? " is-on" : ""}`}
              aria-pressed={calibrating}
              onClick={() => {
                setCalibrating((c) => !c);
                setCalLine(null);
                setSelection(null);
              }}
            >
              {isCalibrated ? "Re-set scale" : "Set scale"}
            </button>
            <button type="button" className={`tool${comparing ? " is-on" : ""}`} aria-pressed={comparing} onClick={toggleCompare}>
              Compare
            </button>
            <button type="button" className={`tool${shop ? " is-on" : ""}`} aria-pressed={shop} onClick={toggleShop}>
              Shop mode
            </button>
          </div>
        </div>

        <p className="studio-room-label">
          {photo.isSample ? (
            <>
              <strong>{photo.label}.</strong> Try it here, then upload a photo of your own room — a
              straight-on shot of the wall works best.
            </>
          ) : (
            <>
              <strong>{photo.label}</strong>
              {isCalibrated ? " · scale set" : " · sizes are a guess until you set the scale"}
            </>
          )}
        </p>

        {calibrating ? (
          <div className="cal-panel">
            <p>
              <strong>Set the scale.</strong> Drag a line across something you know the size of — a
              door is usually 80″ tall and 32″ wide, a standard brick 8″ long. Then enter that
              measurement.
            </p>
            <div className="cal-controls">
              <label>
                That line is
                <input ref={calInches} type="number" min={1} max={400} step={0.5} defaultValue={80} disabled={!calLine} />
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

        <div
          className={`studio-views${comparing ? " is-compare" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void acceptPhoto(file);
          }}
        >
          {resolved.map(({ v, items, regions }) => (
            <div key={v} className={`studio-view${comparing && v === view ? " is-active" : ""}`}>
              <Scene
                photo={photo}
                items={items}
                regions={regions}
                occluders={design.occluders}
                showOriginal={showOriginal}
                controls={{
                  isActive: v === view,
                  selection,
                  showCorners: layer === "stone",
                  calibrating,
                  calLine: v === view ? calLine : null,
                  label: comparing
                    ? `View ${VIEW_NAMES[v]} — select a stove or stone, then drag it or use the arrow keys`
                    : "Room preview — select a stove or stone, then drag it or use the arrow keys",
                  onStagePointerDown: onStagePointerDown(v),
                  onStageKeyDown,
                  onItemPointerDown: onItemPointerDown(v),
                  onScalePointerDown,
                  onCornerPointerDown,
                  onCornerKeyDown,
                }}
              />
              {comparing ? (
                <button
                  type="button"
                  className="studio-view-foot"
                  aria-pressed={v === view}
                  onClick={() => setActiveView(v)}
                >
                  <strong>{VIEW_NAMES[v]}</strong>
                  <span>{viewSummary(design, v, productsById, stonesById)}</span>
                  <em>{v === view ? "Editing" : "Tap to edit"}</em>
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="studio-under">
          <label className="checkbox">
            <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} />
            <span>Show the room as it is</span>
          </label>
          <span className="viz-hint">
            {comparing ? "Placement is linked across A and B. " : ""}
            {hint}
          </span>
        </div>

        {selectedItem && shownItem ? (
          <ItemControls
            item={shownItem.item}
            product={shownItem.product}
            pctPerInch={design.pctPerInch}
            onChange={(patch) =>
              // View B shows the item at its own product's width; turn a size
              // set there back into the shared geometry.
              updateItem(
                selectedItem.id,
                patch.widthPct === undefined
                  ? patch
                  : { ...patch, widthPct: (patch.widthPct * selectedItem.widthPct) / shownItem.item.widthPct },
              )
            }
            onRemove={() => deleteItem(selectedItem.id)}
          />
        ) : null}

        {selectedRegion ? (
          <RegionControls
            region={selectedRegion}
            stoneId={regionStoneId(design, selectedRegion, view)}
            stone={(() => {
              const id = regionStoneId(design, selectedRegion, view);
              return id ? stonesById.get(id) : undefined;
            })()}
            areaNumber={design.regions.indexOf(selectedRegion) + 1}
            isCalibrated={isCalibrated}
            onChange={(patch) => updateRegion(selectedRegion.id, patch)}
            onUsePhotoSize={() => updateRegion(selectedRegion.id, { measured: false })}
            onRemove={() => deleteRegion(selectedRegion.id)}
          />
        ) : null}

        <div className="viz-actions">
          {shop ? null : (
            <button type="button" className="btn" onClick={handleSave} disabled={!hasContent || Boolean(busy)}>
              {isSignedIn ? "Save to my account" : "Sign in to save"}
            </button>
          )}
          <button type="button" className="tool" onClick={handleExport} disabled={!hasContent || Boolean(busy)}>
            {comparing ? "Download A and B" : "Download image"}
          </button>
          <button
            type="button"
            className={`tool studio-reset${confirmReset ? " is-confirming" : ""}`}
            onClick={startOver}
            disabled={Boolean(busy)}
          >
            {confirmReset ? "Tap again to clear everything" : shop ? "New customer" : "Start over"}
          </button>
        </div>
        {shop ? (
          <p className="viz-hint">
            Shop mode doesn&rsquo;t save to accounts on this shared screen — download the picture to
            keep it. &ldquo;New customer&rdquo; clears everything, including any sign-in.
          </p>
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

      <div className="studio-side">
        <div className="studio-tabs" role="tablist" aria-label="Layer to edit">
          {(["stove", "stone"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              id={`studio-tab-${l}`}
              aria-selected={layer === l}
              aria-controls={`studio-panel-${l}`}
              tabIndex={layer === l ? 0 : -1}
              className={`studio-tab${layer === l ? " is-on" : ""}`}
              onClick={() => setLayer(l)}
              onKeyDown={(e) => {
                const next =
                  e.key === "ArrowLeft" || e.key === "ArrowRight"
                    ? l === "stove"
                      ? "stone"
                      : "stove"
                    : e.key === "Home"
                      ? "stove"
                      : e.key === "End"
                        ? "stone"
                        : null;
                if (!next) return;
                e.preventDefault();
                setLayer(next);
                document.getElementById(`studio-tab-${next}`)?.focus();
              }}
            >
              {l === "stove" ? "Stove" : "Stone"}
            </button>
          ))}
        </div>

        <div
          id="studio-panel-stove"
          role="tabpanel"
          aria-labelledby="studio-tab-stove"
          hidden={layer !== "stove"}
        >
          {design.items.length > 0 ? (
            <div className="studio-placed">
              <span className="field-label">In the room</span>
              <div className="chips" role="group" aria-label="Products in the room">
                {design.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip${selectedItem?.id === item.id ? " is-on" : ""}`}
                    aria-pressed={selectedItem?.id === item.id}
                    onClick={() => select({ kind: "item", id: item.id })}
                  >
                    {productsById.get(itemProductId(design, item, view))?.name ?? "Product"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <ProductPicker
            products={products}
            onAdd={pickProduct}
            disabled={false}
            heading={selectedItem ? "Swap the selected product" : "Add to the room"}
            currentId={selectedItem ? itemProductId(design, selectedItem, view) : undefined}
            note={
              selectedItem ? (
                <>
                  Tap a model to put it in place of{" "}
                  {productsById.get(itemProductId(design, selectedItem, view))?.name ?? "this one"}
                  {comparing ? ` in view ${VIEW_NAMES[view]}` : ""}.{" "}
                  <button type="button" className="linklike" onClick={() => setSelection(null)}>
                    Add another instead
                  </button>
                </>
              ) : comparing ? (
                `Adds to both views. Select a product in view ${VIEW_NAMES[view]} to swap just that one.`
              ) : (
                "Tap a model to drop it into the room."
              )
            }
          />
        </div>

        <div
          id="studio-panel-stone"
          role="tabpanel"
          aria-labelledby="studio-tab-stone"
          hidden={layer !== "stone"}
          className="studio-stone-panel"
        >
          <section className="picker studio-shape" aria-label="Where the stone goes">
            <h2>Where the stone goes</h2>
            {design.regions.length > 0 ? (
              <div className="chips" role="group" aria-label="Stone areas">
                {design.regions.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`chip${selectedRegion?.id === r.id ? " is-on" : ""}`}
                    aria-pressed={selectedRegion?.id === r.id}
                    onClick={() => select({ kind: "region", id: r.id })}
                  >
                    Area {i + 1}
                  </button>
                ))}
                {design.regions.length < MAX_REGIONS && defaultStone ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => createRegion(targetRegion?.stoneId ?? defaultStone.id)}
                  >
                    + Another area
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="studio-shape-buttons">
              <button type="button" className="tool" onClick={() => applyShape("accent")}>
                Accent panel
              </button>
              <button type="button" className="tool" onClick={() => applyShape("full")}>
                Full wall
              </button>
            </div>
            <p className="picker-note">
              {targetRegion
                ? "Starting shapes for the selected area — then drag its corners onto the wall."
                : "Pick a starting shape, or a stone below to start with an accent panel."}
            </p>
          </section>

          <StonePicker
            stones={stones}
            onAdd={(s) => pickStone(s)}
            disabled={false}
            heading={targetRegion ? `Stone for area ${design.regions.indexOf(targetRegion) + 1}` : "Choose a stone"}
            currentId={targetRegion ? regionStoneId(design, targetRegion, view) : undefined}
            note={
              comparing
                ? `Choosing for view ${VIEW_NAMES[view]}.`
                : targetRegion
                  ? "Tap a stone to try it on the wall."
                  : "Tap a stone to put it behind the stove."
            }
            before={
              comparing && view === 1 && targetRegion ? (
                <button
                  type="button"
                  className="stone-card studio-bare-wall"
                  aria-pressed={regionStoneId(design, targetRegion, 1) === null}
                  onClick={() => pickStone(null)}
                >
                  <span className="stone-swatch studio-bare-swatch" aria-hidden="true" />
                  <span className="stone-meta">
                    <span className="stone-name">Bare wall</span>
                    <span className="stone-sub">No stone in view B</span>
                  </span>
                </button>
              ) : null
            }
          />

          {viewRegions.length > 0 ? (
            <EstimatePanel
              total={estimate}
              regions={viewRegions.map((r) => r.region)}
              stones={stonesById}
              areaNumbers={areaNumbers}
              basis={sizeBasis}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** "Jøtul F 500 · Buechel sample" — what a view shows, for its label. */
function viewSummary(
  design: DesignState,
  v: ViewIndex,
  products: Map<string, PlaceableProduct>,
  stones: Map<string, StoneSwatch>,
): string {
  const items = resolveItems(design, v, products);
  const main = items.find((i) => i.product.category !== "hearth") ?? items[0];
  const region = design.regions[0];
  const stoneId = region ? regionStoneId(design, region, v) : undefined;
  const stone = stoneId ? stones.get(stoneId) : undefined;
  const parts = [
    main?.product.name,
    region ? (stone ? `${stone.brandName ? `${stone.brandName} ` : ""}${stone.texture}` : "Bare wall") : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Empty";
}

/** Ties stashed work to the sign-in that will come back for it. */
function newStashId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
