import type { DesignState } from "@/lib/design-types";

/**
 * Holds a work-in-progress design across the sign-in round trip, so a customer
 * who has just arranged a stove in their living room does not lose it at the
 * sign-in wall.
 *
 * sessionStorage, not localStorage: this is a one-hop handoff, and a room photo
 * should not outlive the tab. The photo is re-encoded small before it gets here.
 */

const KEY = "sw_visualizer_stash";

export type Stash = {
  dataUrl: string;
  width: number;
  height: number;
  design: DesignState;
  title: string;
};

export function saveStash(stash: Stash): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stash));
  } catch {
    // Quota or a locked-down browser. The sign-in still works; they just re-pick
    // the photo afterwards.
  }
}

export function loadStash(): Stash | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stash;
    if (typeof parsed?.dataUrl !== "string" || !Array.isArray(parsed.design?.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStash(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
