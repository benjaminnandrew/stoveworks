"use client";

import Link from "next/link";

import { announce, COMPARE_MAX, toggle, useShortlist, type ShortItem } from "@/lib/shortlist";

/** Save (a heart) and Compare, for a model card, a model page or its pop-up. */
export function ShortlistButtons({ item, size = "small" }: { item: ShortItem; size?: "small" | "large" }) {
  const saved = useShortlist("saved").some((i) => i.id === item.id);
  const comparing = useShortlist("compare").some((i) => i.id === item.id);
  const full = `${item.brand} ${item.name}`;

  return (
    <div className={`shortlist-buttons is-${size}`}>
      <button
        type="button"
        className={`shortlist-save${saved ? " is-on" : ""}`}
        aria-pressed={saved}
        aria-label={saved ? `Remove the ${full} from your saved models` : `Save the ${full}`}
        onClick={() => {
          const { added } = toggle("saved", item);
          announce(added ? `Saved the ${full}.` : `Removed the ${full} from saved.`);
        }}
      >
        <Heart filled={saved} />
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
      <button
        type="button"
        className={`shortlist-compare${comparing ? " is-on" : ""}`}
        aria-pressed={comparing}
        aria-label={comparing ? `Take the ${full} out of the comparison` : `Compare the ${full}`}
        onClick={() => {
          const { added, full: isFull } = toggle("compare", item);
          if (isFull) announce(`You can compare ${COMPARE_MAX} at a time. Take one out first.`);
          else announce(added ? `Added the ${full} to compare.` : `Took the ${full} out of compare.`);
        }}
      >
        <span className="shortlist-box" aria-hidden="true">
          {comparing ? "✓" : ""}
        </span>
        <span>Compare</span>
      </button>
    </div>
  );
}

/** The header's way to the saved list, with how many are in it. */
export function SavedLink() {
  const n = useShortlist("saved").length;
  return (
    <Link href="/saved/" className="header-search header-saved" aria-label={n ? `Saved models (${n})` : "Saved models"}>
      <Heart filled={n > 0} />
      {n ? <span className="header-saved-count">{n}</span> : null}
    </Link>
  );
}

export function Heart({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.3l-1.2-1.1C6.2 15 3.2 12.3 3.2 8.9 3.2 6.2 5.3 4.1 8 4.1c1.5 0 3 .7 4 1.9 1-1.2 2.5-1.9 4-1.9 2.7 0 4.8 2.1 4.8 4.8 0 3.4-3 6.1-7.6 10.3L12 20.3z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
