import type { DesignState } from "@/lib/design-types";

/**
 * Holds work in progress across the sign-in round trip, so a customer who has
 * just put a stove and a stone wall into their living room doesn't lose it at
 * the sign-in wall.
 *
 * localStorage, because the sign-in link arrives by email and opens in a new
 * tab, which can't see the old tab's sessionStorage. To keep a room photo from
 * lingering on the device it is held for two hours at most, cleared as soon as
 * it is picked up, and cleared by "New customer" in shop mode. The photo is
 * re-encoded small before it gets here; the sample room isn't stored at all.
 */

const KEY = "sw_studio_stash";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type StudioStash = {
  /** Matches the `resume` id the sign-in link brings back. */
  id: string;
  savedAt?: number;
  /** Null for the sample room, which is reloaded from its URL. */
  dataUrl: string | null;
  width: number;
  height: number;
  label: string;
  design: DesignState;
  comparing: boolean;
  title: string;
};

export function saveStash(stash: StudioStash): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...stash, savedAt: Date.now() }));
  } catch {
    // Quota, or a locked-down browser. Sign-in still works; they re-pick the photo.
  }
}

export function loadStash(): StudioStash | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioStash;
    const fresh = typeof parsed?.savedAt === "number" && Date.now() - parsed.savedAt < MAX_AGE_MS;
    if (!fresh || !Array.isArray(parsed.design?.items) || !Array.isArray(parsed.design?.regions)) {
      clearStash();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStash(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
