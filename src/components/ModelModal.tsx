"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A model's page, opened over the list it was clicked from (Ben, 22 Oct 2026).
 * The address is the model's own, so a refresh or a shared link shows the full
 * page; closing goes back, which returns to the list where it was scrolled.
 *
 * The arrows step through the models in the list underneath (its cards'
 * `data-model-link`s, in page order) and replace the address rather than
 * adding to history, so Back always closes.
 */
export function ModelModal({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState<{ prev?: string; next?: string; at?: string }>({});

  const close = useCallback(() => router.back(), [router]);
  const go = useCallback((href?: string) => href && router.replace(href, { scroll: false }), [router]);

  // Neighbours in the list underneath, and back to the top of the panel for each model.
  useEffect(() => {
    const hrefs = [
      ...new Set(
        [...document.querySelectorAll<HTMLAnchorElement>("a[data-model-link]")]
          .filter((a) => !a.closest(".model-modal"))
          .map((a) => new URL(a.href).pathname),
      ),
    ];
    const i = hrefs.indexOf(pathname);
    setNav(i < 0 ? {} : { prev: hrefs[i - 1], next: hrefs[i + 1], at: `${i + 1} of ${hrefs.length}` });
    panelRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // The photo lightbox, when open over this, has the keys.
      if (document.querySelector(".lightbox")) return;
      if (e.key === "Escape") close();
      const typing = (e.target as Element | null)?.closest("input, textarea, select");
      if (!typing && e.key === "ArrowLeft") go(nav.prev);
      if (!typing && e.key === "ArrowRight") go(nav.next);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [close, go, nav.prev, nav.next]);

  return (
    <div
      className="model-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="model-modal-panel" role="dialog" aria-modal="true" aria-labelledby="model-modal-title" tabIndex={-1} ref={panelRef}>
        <header className="model-modal-head">
          <div>
            <h2 id="model-modal-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="model-modal-tools">
            {nav.at ? (
              <>
                <button type="button" onClick={() => go(nav.prev)} disabled={!nav.prev} aria-label="Previous model">
                  <Arrow dir="left" />
                </button>
                <span className="model-modal-at">{nav.at}</span>
                <button type="button" onClick={() => go(nav.next)} disabled={!nav.next} aria-label="Next model">
                  <Arrow dir="right" />
                </button>
              </>
            ) : null}
            <button type="button" className="model-modal-close" onClick={close} aria-label="Close">
              &times;
            </button>
          </div>
        </header>
        <div className="model-modal-body">{children}</div>
      </div>
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
