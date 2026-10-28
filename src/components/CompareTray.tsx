"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { clear, COMPARE_MAX, compareHref, remove, useAnnouncement, useShortlist } from "@/lib/shortlist";

/**
 * The compare tray along the bottom of every page, once a model is picked:
 * five slots, Clear, and Compare (from two). Modelled on the Woodland site's
 * (Ben, 22 Oct 2026). Also shows the short "Saved" notes, which screen readers
 * hear through the status line.
 */
export function CompareTray() {
  const items = useShortlist("compare");
  const note = useAnnouncement();
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    setToast(note.text);
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  // The compare page has its own controls.
  const shown = items.length > 0 && !pathname.startsWith("/compare");

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
                <li key={`empty-${i}`} className="compare-slot is-empty" aria-hidden="true">
                  <span>+</span>
                </li>
              ),
            )}
          </ul>
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
