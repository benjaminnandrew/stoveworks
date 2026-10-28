"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ShortlistButtons } from "@/components/ShortlistButtons";
import { business } from "@/content/site";
import { clear, COMPARE_MAX, compareHref, setCompare, useShortlist } from "@/lib/shortlist";

/** The saved models, from this browser (src/lib/shortlist.ts). */
export function SavedList() {
  const items = useShortlist("saved");
  const router = useRouter();

  if (!items.length) {
    return (
      <p className="notice">
        <strong>Nothing saved yet.</strong> Tap <em>Save</em> on any model and it waits here for you, ready to compare
        or ask us about. Start with <Link href="/stoves/">stoves</Link>, <Link href="/inserts/">inserts</Link> or{" "}
        <Link href="/fireplaces/">fireplaces</Link>.
      </p>
    );
  }

  const first = items.slice(0, COMPARE_MAX);
  const names = items.map((i) => `- ${i.brand} ${i.name}`).join("\n");
  const ask = `mailto:${business.email}?subject=${encodeURIComponent("My saved models")}&body=${encodeURIComponent(
    `I've saved these and would like to know more:\n\n${names}\n\n`,
  )}`;

  return (
    <div className="saved">
      <div className="saved-tools">
        <p>
          {items.length} saved
          {items.length > COMPARE_MAX ? ` · compare takes the first ${COMPARE_MAX}` : ""}
        </p>
        <div>
          {items.length > 1 ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCompare(first);
                router.push(compareHref(first));
              }}
            >
              Compare {first.length}
            </button>
          ) : null}
          <a className="tool" href={ask}>
            Ask about these
          </a>
          <button type="button" className="linklike" onClick={() => clear("saved")}>
            Clear all
          </button>
        </div>
      </div>
      <ul className="saved-grid">
        {items.map((item) => (
          <li key={item.id} className="saved-card">
            <Link href={item.href} className="saved-photo" scroll={false} data-model-link>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.photo ? <img src={item.photo} alt="" /> : null}
            </Link>
            <div className="saved-body">
              <Link href={item.href} scroll={false} className="saved-name">
                {item.brand} {item.name}
              </Link>
              <span className="saved-type">{item.type}</span>
              <ShortlistButtons item={item} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
