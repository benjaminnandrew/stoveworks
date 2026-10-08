"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  CATEGORY_LABEL,
  FUEL_LABEL,
  type PlaceableProduct,
} from "@/lib/design-types";

type Props = {
  products: PlaceableProduct[];
  onAdd: (product: PlaceableProduct) => void;
  disabled: boolean;
  disabledReason?: string;
  heading?: string;
  /** A line under the heading — what a tap will do right now. */
  note?: ReactNode;
  /** The product currently shown on the selected item, marked as chosen. */
  currentId?: string;
};

type CategoryFilter = PlaceableProduct["category"] | "all";

export function ProductPicker({
  products,
  onAdd,
  disabled,
  disabledReason,
  heading = "Add to the room",
  note,
  currentId,
}: Props) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    return (["stove", "insert", "fireplace", "hearth"] as const).filter((c) => present.has(c));
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return `${p.brandName ?? ""} ${p.name}`.toLowerCase().includes(q);
    });
  }, [products, category, search]);

  return (
    <section className="picker" aria-label="Choose a product">
      <div className="picker-head">
        <h2>{heading}</h2>
        {note ? <p className="picker-note">{note}</p> : null}
        <input
          type="search"
          className="picker-search"
          placeholder="Search brand or model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
      </div>

      <div className="chips" role="group" aria-label="Filter by type">
        <button
          type="button"
          className={`chip${category === "all" ? " is-on" : ""}`}
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${category === c ? " is-on" : ""}`}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {disabled ? <p className="picker-hint">{disabledReason}</p> : null}

      {visible.length === 0 ? (
        <p className="picker-hint">No products match that search.</p>
      ) : (
        <ul className="product-list">
          {visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="product-card"
                onClick={() => onAdd(p)}
                disabled={disabled}
                aria-pressed={currentId ? p.id === currentId : undefined}
                title={disabled ? disabledReason : undefined}
              >
                <span className="product-thumb">
                  {/* Cutouts and placeholders are both plain images; next/image
                      buys nothing here and would fight the transparent PNGs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" loading="lazy" />
                  {p.isPlaceholder ? <span className="badge">Photo coming</span> : null}
                </span>
                <span className="product-meta">
                  <span className="product-name">{p.name}</span>
                  <span className="product-sub">
                    {FUEL_LABEL[p.fuel]} · {CATEGORY_LABEL[p.category]}
                    {p.widthIn ? ` · ${p.widthIn}" wide` : ""}
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
