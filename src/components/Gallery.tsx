"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { src: string; alt: string; width: number; height: number };

export function Gallery({ items }: { items: Item[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const scrollBy = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: "smooth" });
  };

  const step = useCallback(
    (dir: 1 | -1) => setLightbox((i) => (i === null ? i : (i + dir + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (lightbox === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lightbox, step]);

  const active = lightbox === null ? null : items[lightbox];

  return (
    <>
      <div className="gallery" ref={trackRef}>
        {items.map((item, i) => (
          <button
            key={item.src}
            type="button"
            className="gallery-item"
            onClick={() => setLightbox(i)}
            aria-label={`Enlarge ${item.alt}`}
          >
            <Image
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes="(max-width: 1200px) 45vw, 210px"
              loading={i < 6 ? "eager" : "lazy"}
            />
          </button>
        ))}
      </div>

      <div className="gallery-controls">
        <button type="button" className="gallery-btn" onClick={() => scrollBy(-1)} aria-label="Previous photos">
          <Arrow dir="left" />
        </button>
        <button type="button" className="gallery-btn" onClick={() => scrollBy(1)} aria-label="Next photos">
          <Arrow dir="right" />
        </button>
      </div>

      {active ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Showroom photo"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          }}
        >
          <button type="button" className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close">
            &times;
          </button>
          <button type="button" className="lightbox-nav prev" onClick={() => step(-1)} aria-label="Previous photo">
            <Arrow dir="left" />
          </button>
          <Image
            src={active.src}
            alt={active.alt}
            width={active.width}
            height={active.height}
            sizes="90vw"
            priority
          />
          <button type="button" className="lightbox-nav next" onClick={() => step(1)} aria-label="Next photo">
            <Arrow dir="right" />
          </button>
        </div>
      ) : null}
    </>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
