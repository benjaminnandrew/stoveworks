"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The "on this page" bar on long pages (Services and the guide hub, 27 Oct 2026). It sits under
 * the page title and, as you scroll, sticks below the header and marks the section you're
 * reading, like the maker bar on the product pages. On a phone it folds into one button that
 * opens the list (Ben: "a little hamburger menu").
 *
 * `spy: false` items are links only and never marked: the gas-smell callout sits beside the
 * sections rather than among them.
 */

export type JumpItem = { id: string; label: string; spy?: boolean; alert?: boolean };

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 3 2 21h20L12 3Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12 10v5M12 17.5v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function JumpBar({ items, label = "On this page" }: { items: JumpItem[]; label?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = barRef.current;
      if (!bar) return;
      const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      const rect = bar.getBoundingClientRect();
      setStuck(rect.top <= header + 1);

      // The section you're reading: the last one whose top has reached the bar.
      const line = rect.bottom + 24;
      let current: string | null = null;
      for (const i of items) {
        if (i.spy === false) continue;
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top <= line) current = i.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  // The phone menu closes on Escape or a tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Keep the current section in view when the row scrolls sideways (narrow desktops).
  useEffect(() => {
    const list = listRef.current;
    const el = active ? list?.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [active]);

  const current = items.find((i) => i.id === active);

  return (
    <nav
      ref={barRef}
      className={`jump-bar${stuck ? " is-stuck" : ""}${open ? " is-open" : ""}`}
      aria-label={label}
    >
      <div className="wrap jump-bar-inner">
        <span className="jump-bar-title">{label}</span>
        <button
          type="button"
          className="jump-bar-toggle"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={current ? `${label}: ${current.label}` : label}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="jump-bar-burger" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="jump-bar-toggle-text">
            {label}
            {current ? <strong>{current.label}</strong> : null}
          </span>
        </button>
        <ul id={listId} ref={listRef}>
          {items.map((i) => (
            <li key={i.id} data-id={i.id} className={i.alert ? "is-alert" : undefined}>
              <a
                href={`#${i.id}`}
                className={active === i.id ? "is-current" : undefined}
                aria-current={active === i.id ? "location" : undefined}
                onClick={() => setOpen(false)}
              >
                {i.alert ? <AlertIcon /> : null}
                {i.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
