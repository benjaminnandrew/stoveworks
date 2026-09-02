"use client";

import { useMemo, useState } from "react";

import type { StoneSwatch } from "@/lib/veneer-types";

export function StonePicker({
  stones,
  onAdd,
  disabled,
  disabledReason,
}: {
  stones: StoneSwatch[];
  onAdd: (stone: StoneSwatch) => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState<string>("all");

  const brands = useMemo(
    () => [...new Set(stones.map((s) => s.brandName).filter(Boolean))] as string[],
    [stones],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stones.filter((s) => {
      if (brand !== "all" && s.brandName !== brand) return false;
      if (!q) return true;
      return `${s.brandName ?? ""} ${s.texture} ${s.color ?? ""}`.toLowerCase().includes(q);
    });
  }, [stones, search, brand]);

  return (
    <section className="picker" aria-label="Choose a stone">
      <div className="picker-head">
        <h2>Choose a stone</h2>
        <input
          type="search"
          className="picker-search"
          placeholder="Search profile or colour…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search stone profiles"
        />
      </div>

      {brands.length > 1 ? (
        <div className="chips" role="group" aria-label="Filter by manufacturer">
          <button
            type="button"
            className={`chip${brand === "all" ? " is-on" : ""}`}
            onClick={() => setBrand("all")}
            aria-pressed={brand === "all"}
          >
            All
          </button>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              className={`chip${brand === b ? " is-on" : ""}`}
              onClick={() => setBrand(b)}
              aria-pressed={brand === b}
            >
              {b}
            </button>
          ))}
        </div>
      ) : null}

      {disabled ? <p className="picker-hint">{disabledReason}</p> : null}

      {visible.length === 0 ? (
        <p className="picker-hint">No stone matches that search.</p>
      ) : (
        <ul className="stone-list">
          {visible.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="stone-card"
                onClick={() => onAdd(s)}
                disabled={disabled}
                title={disabled ? disabledReason : `Mark an area in ${s.texture}`}
              >
                <span
                  className="stone-swatch"
                  style={{ backgroundImage: `url(${s.image})` }}
                  aria-hidden="true"
                />
                <span className="stone-meta">
                  <span className="stone-name">{s.texture}</span>
                  <span className="stone-sub">
                    {s.color ?? s.brandName ?? ""}
                    {s.isPlaceholder ? " · sample image" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
