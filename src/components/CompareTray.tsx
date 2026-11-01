"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  announce,
  clear,
  COMPARE_MAX,
  compareHref,
  remove,
  toggle,
  useAnnouncement,
  useShortlist,
  type ShortItem,
} from "@/lib/shortlist";

/** What /api/search/suggest returns for each name; a model carries its catalog id. */
type Suggestion = { label: string; message: string; url: string; id?: string };

/**
 * The compare tray along the bottom of every page, once a model is picked:
 * five slots, Clear, and Compare (from two). Modelled on the Woodland site's
 * (Ben, 22 Oct 2026). Also shows the short "Saved" notes, which screen readers
 * hear through the status line. An empty slot adds a model from the tray's own
 * search (Ben, 1 Nov 2026: "we should be able to add to compare right from this
 * bottom bar").
 */
export function CompareTray() {
  const items = useShortlist("compare");
  const note = useAnnouncement();
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const closeAdd = useCallback(() => setAdding(false), []);

  useEffect(() => {
    if (!note) return;
    setToast(note.text);
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  // The compare page has its own controls.
  const shown = items.length > 0 && !pathname.startsWith("/compare");
  useEffect(() => {
    if (!shown || items.length >= COMPARE_MAX) setAdding(false);
  }, [shown, items.length]);

  return (
    <>
      <p className={`shortlist-toast${toast ? " is-shown" : ""}${shown ? " is-raised" : ""}`} role="status">
        {toast}
      </p>
      <div className={`compare-tray${shown ? " is-shown" : ""}`} role="region" aria-label="Models to compare" aria-hidden={!shown} inert={!shown}>
        <div className="wrap compare-tray-inner">
          <p className="compare-tray-label">
            <strong>Compare</strong>
            <span>
              {items.length} of {COMPARE_MAX} picked
            </span>
          </p>
          <div className="compare-tray-pick">
            <ul className="compare-tray-slots">
              {Array.from({ length: COMPARE_MAX }, (_, i) => items[i]).map((item, i) =>
                item ? (
                  <li key={item.id} className="compare-slot">
                    {item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo} alt="" />
                    ) : (
                      <span className="compare-slot-none" />
                    )}
                    <span className="compare-slot-name">
                      {item.brand} {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove("compare", item.id)}
                      aria-label={`Take the ${item.brand} ${item.name} out`}
                    >
                      &times;
                    </button>
                  </li>
                ) : (
                  <li key={`empty-${i}`} className="compare-slot is-empty">
                    <button
                      type="button"
                      className="compare-slot-add"
                      aria-expanded={adding}
                      aria-label="Add a model to compare"
                      onClick={() => setAdding((a) => !a)}
                    >
                      <span aria-hidden="true">+</span>
                      {i === items.length ? <span className="compare-slot-addtext">Add a model</span> : null}
                    </button>
                  </li>
                ),
              )}
            </ul>
            {adding ? <CompareAdd onClose={closeAdd} have={items} /> : null}
          </div>
          <div className="compare-tray-actions">
            <button type="button" className="linklike" onClick={() => clear("compare")}>
              Clear
            </button>
            {items.length >= 2 ? (
              <Link className="btn" href={compareHref(items)}>
                Compare {items.length}
              </Link>
            ) : (
              <span className="btn is-waiting" aria-disabled="true">
                Pick one more
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * "Add a model": the site's own name suggestions (the same endpoint as every search box), the models
 * among them, each added straight to the compare set. A model already in it is shown as such.
 */
function CompareAdd({ onClose, have }: { onClose: () => void; have: ShortItem[] }) {
  const listId = `${useId()}-list`;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inSet = (id?: string) => !!id && have.some((h) => h.id === id);

  useEffect(() => inputRef.current?.focus(), []);

  // Suggestions as you type, a moment after the last keystroke (as SearchBox does).
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setFound([]);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(text)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((j: { suggestions?: Suggestion[] }) => {
          setFound(Array.isArray(j.suggestions) ? j.suggestions.filter((s) => s.id) : []);
          setSearched(true);
          setActive(0);
        })
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close on a click elsewhere (the + that opened it toggles it itself).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!boxRef.current?.contains(el) && !el.closest?.(".compare-slot-add")) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const pick = async (s: Suggestion) => {
    if (!s.id || inSet(s.id) || busy) return;
    setBusy(true);
    const res: { item?: ShortItem | null } | null = await fetch(`/api/compare/item?id=${encodeURIComponent(s.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setBusy(false);
    const item = res?.item;
    if (!item) {
      announce(`Couldn't add the ${s.message}. Try again.`);
      return;
    }
    const { added, full } = toggle("compare", item);
    const name = `${item.brand} ${item.name}`;
    if (full) announce(`You can compare ${COMPARE_MAX} at a time. Take one out first.`);
    else if (added) announce(`Added the ${name} to compare.`);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" && found.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % found.length);
    } else if (e.key === "ArrowUp" && found.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + found.length) % found.length);
    } else if (e.key === "Enter" && found[active]) {
      e.preventDefault();
      void pick(found[active]);
    }
  };

  return (
    <div className="compare-add" ref={boxRef} role="dialog" aria-label="Add a model to compare">
      <div className="compare-add-head">
        <strong>Add a model</strong>
        <button type="button" className="compare-add-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>
      <input
        ref={inputRef}
        type="search"
        className="compare-add-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        placeholder="Maker and model, like Jøtul F 445"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={found.length > 0}
        aria-controls={listId}
        aria-activedescendant={found.length ? `${listId}-${active}` : undefined}
        aria-label="Search for a model"
      />
      {found.length ? (
        <ul id={listId} role="listbox" className="compare-add-list">
          {found.map((s, i) => {
            const [name, kind] = s.label.split(" · ");
            const there = inSet(s.id);
            return (
              <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} aria-disabled={there}>
                <button type="button" disabled={there || busy} onClick={() => void pick(s)} onMouseEnter={() => setActive(i)}>
                  <span>{name}</span>
                  <small>{there ? "Already in compare" : kind}</small>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="compare-add-note">
          {searched ? "No model by that name. Try the maker and model number." : "Type a model's name or number."}
        </p>
      )}
    </div>
  );
}
