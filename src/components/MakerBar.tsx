"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The slim "jump to a maker" bar on the product pages (Ben, 21 Oct 2026).
 *
 * The logo strip at the top of the brands stays where it is; once it has
 * scrolled up under the header, this bar slides in below the header with the
 * makers' names and marks the one you're reading. It leaves again once the
 * last maker's block has gone by, so it never sits over the footer.
 */

export type MakerBarItem = { slug: string; name: string; count: number };

export function MakerBar({ items, stripId }: { items: MakerBarItem[]; stripId: string }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const strip = document.getElementById(stripId);
      const header = document.querySelector(".site-header");
      const blocks = items.map((i) => document.getElementById(`maker-${i.slug}`)).filter((b): b is HTMLElement => !!b);
      if (!strip || !blocks.length) return;
      const top = header?.getBoundingClientRect().bottom ?? 0;
      const barH = barRef.current?.offsetHeight ?? 0;

      // Shown between the strip going under the header and the last block ending.
      const pastStrip = strip.getBoundingClientRect().bottom < top;
      const beforeEnd = blocks[blocks.length - 1].getBoundingClientRect().bottom > top + barH + 40;
      setShown(pastStrip && beforeEnd);

      // The maker you're reading: the last block whose top has reached the bar.
      const line = top + barH + 24;
      let current: string | null = null;
      blocks.forEach((b, i) => {
        if (b.getBoundingClientRect().top <= line) current = items[i].slug;
      });
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
  }, [items, stripId]);

  // Keep the current maker in view when the row scrolls sideways (phones).
  useEffect(() => {
    if (!active || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-slug="${active}"]`);
    if (!el) return;
    const list = listRef.current;
    const left = el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2;
    list.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  return (
    <nav
      ref={barRef}
      className={`maker-bar${shown ? " is-shown" : ""}`}
      aria-label="Jump to a maker"
      aria-hidden={!shown}
      inert={!shown}
    >
      <div className="wrap maker-bar-inner">
        <span className="maker-bar-label">Jump to</span>
        <ul ref={listRef}>
          {items.map((i) => (
            <li key={i.slug} data-slug={i.slug}>
              <a
                href={`#maker-${i.slug}`}
                className={active === i.slug ? "is-current" : undefined}
                aria-current={active === i.slug ? "true" : undefined}
              >
                {i.name}
                <small>{i.count || "Ask"}</small>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
