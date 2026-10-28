"use client";

import { useEffect, useState } from "react";

import { DEFAULT_TYPE, DIRECTIONS, TYPE_KEY } from "@/lib/type-review";

/**
 * Flips the whole site between the type directions under review (Ben, 22 Oct
 * 2026). Shows only in a browser that has opened a page with `?type=`; "Done"
 * puts the site back to its default type and hides it again.
 */
export function TypeSwitcher() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCurrent(localStorage.getItem(TYPE_KEY));
    } catch {
      // Storage blocked: the switcher just stays hidden.
    }
  }, []);

  if (!current) return null;

  const pick = (key: string) => {
    try {
      localStorage.setItem(TYPE_KEY, key);
    } catch {}
    if (key === "current") delete document.documentElement.dataset.type;
    else document.documentElement.dataset.type = key;
    setCurrent(key);
  };

  const done = () => {
    try {
      localStorage.removeItem(TYPE_KEY);
    } catch {}
    document.documentElement.dataset.type = DEFAULT_TYPE;
    setCurrent(null);
  };

  const shown = DIRECTIONS.find((d) => d.key === current) ?? DIRECTIONS[0];

  return (
    <div className="type-switch" role="group" aria-label="Type direction (review only)">
      <div className="type-switch-row">
        {DIRECTIONS.map((d) => (
          <button key={d.key} type="button" aria-pressed={d.key === shown.key} onClick={() => pick(d.key)}>
            {d.label}
          </button>
        ))}
        <button type="button" className="type-switch-done" onClick={done} aria-label="End the type review">
          Done
        </button>
      </div>
      <p>{shown.faces}</p>
    </div>
  );
}
