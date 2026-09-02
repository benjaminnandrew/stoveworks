import type { VeneerState } from "@/lib/veneer-types";

/**
 * Holds a work-in-progress mock-up across the sign-in round trip, so a customer
 * who has just marked out their fireplace does not lose it at the sign-in wall.
 *
 * Separate key from the stove visualiser's stash: the two tools can each have
 * unsaved work in the same tab, and neither should clobber the other.
 */

const KEY = "sw_veneer_stash";

export type VeneerStash = {
  dataUrl: string;
  width: number;
  height: number;
  state: VeneerState;
  title: string;
};

export function saveStash(stash: VeneerStash): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stash));
  } catch {
    // Quota, or a locked-down browser. Sign-in still works; they re-pick the photo.
  }
}

export function loadStash(): VeneerStash | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VeneerStash;
    if (typeof parsed?.dataUrl !== "string" || !Array.isArray(parsed.state?.regions)) return null;
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
