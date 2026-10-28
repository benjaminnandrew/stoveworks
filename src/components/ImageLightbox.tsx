"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Click to enlarge, for every model photo on the site (Ben, 21 Oct 2026).
 *
 * Mounted once in the layout. Any button marked `data-enlarge="<image url>"`
 * opens it here, with `data-caption` and `data-detail` underneath, the caption
 * linking to `data-href` when there is one (a model's page, Ben 22 Oct 2026); the arrows
 * step through the other enlargeable photos on the page (skipping ones folded
 * away in "Show all"). The cards themselves stay server-rendered.
 */

type Shot = { src: string; caption: string; detail: string; href: string | null };

export function ImageLightbox() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-enlarge]");
      if (!btn) return;
      e.preventDefault();
      // Only photos someone can see: not those inside a closed "Show all", and
      // within a model's pop-up or gallery (data-enlarge-scope), only its own.
      const scope = btn.closest("[data-enlarge-scope]") ?? document;
      const all = [...scope.querySelectorAll<HTMLElement>("[data-enlarge]")].filter(
        (el) => el === btn || !el.closest("details:not([open])"),
      );
      setShots(
        all.map((el) => ({
          src: el.dataset.enlarge ?? "",
          caption: el.dataset.caption ?? "",
          detail: el.dataset.detail ?? "",
          href: el.dataset.href ?? null,
        })),
      );
      setIndex(all.indexOf(btn));
      opener.current = btn;
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    opener.current?.focus();
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + shots.length) % shots.length)),
    [shots.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [index, step, close]);

  const shot = index === null ? null : shots[index];
  if (!shot) return null;
  const many = shots.length > 1;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={shot.caption || "Photo"}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {many ? (
        <button type="button" className="lightbox-nav prev" onClick={() => step(-1)} aria-label="Previous photo">
          <Arrow dir="left" />
        </button>
      ) : null}
      <figure className="lightbox-figure">
        {/* On the photo's top-right corner, where the eye already is (Ben, 21 Oct). */}
        <button ref={closeRef} type="button" className="lightbox-close" onClick={close} aria-label="Close">
          &times;
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.src} alt={shot.caption} />
        <figcaption>
          <span>
            {shot.href ? (
              // From a list this opens the model's pop-up (src/app/@modal); the photo closes first.
              <Link href={shot.href} scroll={false} className="lightbox-title" onClick={() => setIndex(null)}>
                <strong>{shot.caption}</strong>
              </Link>
            ) : (
              <strong>{shot.caption}</strong>
            )}
            {shot.detail || shot.href ? (
              <small>
                {shot.detail}
                {shot.href ? (
                  <>
                    {shot.detail ? " · " : ""}
                    <Link href={shot.href} scroll={false} onClick={() => setIndex(null)}>
                      See details &rarr;
                    </Link>
                  </>
                ) : null}
              </small>
            ) : null}
          </span>
          {many ? (
            <span className="lightbox-count">
              {index! + 1} of {shots.length}
            </span>
          ) : null}
        </figcaption>
      </figure>
      {many ? (
        <button type="button" className="lightbox-nav next" onClick={() => step(1)} aria-label="Next photo">
          <Arrow dir="right" />
        </button>
      ) : null}
    </div>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
