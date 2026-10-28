/**
 * Saved models and the compare set (Ben, 22 Oct 2026: save, and "a 5 compare
 * set up", working like the Woodland site's). Both live in this browser, so no
 * email or account is needed, and stay in step across tabs. Each entry keeps
 * what the tray and the saved page show, so they draw without a fetch.
 */

import { useSyncExternalStore } from "react";

export type ShortItem = { id: string; name: string; brand: string; type: string; href: string; photo: string | null };
export type ListName = "saved" | "compare";

export const COMPARE_MAX = 5;
const KEYS: Record<ListName, string> = { saved: "sw-saved", compare: "sw-compare" };
const EMPTY: ShortItem[] = [];

const cache: Record<ListName, ShortItem[] | null> = { saved: null, compare: null };
const listeners = new Set<() => void>();

const valid = (v: unknown): v is ShortItem =>
  typeof v === "object" && v !== null && typeof (v as ShortItem).id === "string" && typeof (v as ShortItem).href === "string";

function read(list: ListName): ShortItem[] {
  if (cache[list]) return cache[list]!;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEYS[list]) ?? "[]");
    cache[list] = Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    cache[list] = [];
  }
  return cache[list]!;
}

function write(list: ListName, items: ShortItem[]) {
  cache[list] = items;
  try {
    localStorage.setItem(KEYS[list], JSON.stringify(items));
  } catch {
    // Storage blocked: the list still works until the page is left.
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed a list.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.saved) cache.saved = null;
    if (e.key === KEYS.compare) cache.compare = null;
    if (e.key === KEYS.saved || e.key === KEYS.compare) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The list, kept current. Empty on the server and until the browser's copy is read. */
export function useShortlist(list: ListName): ShortItem[] {
  return useSyncExternalStore(subscribe, () => read(list), () => EMPTY);
}

/** Adds or removes. The compare set refuses a sixth: `full` says so. */
export function toggle(list: ListName, item: ShortItem): { added: boolean; full: boolean } {
  const items = read(list);
  if (items.some((i) => i.id === item.id)) {
    write(list, items.filter((i) => i.id !== item.id));
    return { added: false, full: false };
  }
  if (list === "compare" && items.length >= COMPARE_MAX) return { added: false, full: true };
  write(list, [...items, item]);
  return { added: true, full: false };
}

export function remove(list: ListName, id: string) {
  write(list, read(list).filter((i) => i.id !== id));
}

export function clear(list: ListName) {
  write(list, []);
}

/** Replaces the compare set with these, without repeats, up to the limit. */
export function setCompare(items: ShortItem[]) {
  const seen = new Set<string>();
  write("compare", items.filter((i) => !seen.has(i.id) && seen.add(i.id)).slice(0, COMPARE_MAX));
}

export const compareHref = (items: { id: string }[]) => `/compare/?ids=${items.map((i) => i.id).join(",")}`;

/** A short message for the tray to show ("Saved", "You can compare 5 at a time"). */
type Note = { text: string; at: number };
let note: Note | null = null;
const noteListeners = new Set<() => void>();
export function announce(text: string) {
  note = { text, at: Date.now() };
  noteListeners.forEach((l) => l());
}
export function useAnnouncement(): Note | null {
  return useSyncExternalStore(
    (l) => {
      noteListeners.add(l);
      return () => noteListeners.delete(l);
    },
    () => note,
    () => null,
  );
}
