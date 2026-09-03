"use client";

import Image from "next/image";
import Link from "next/link";

import { brandsForHref } from "@/content/nav-data";
import type { NavItem } from "@/content/site";

/**
 * The panel that drops out of a top-level nav item.
 *
 * Each child link carries the manufacturers actually carried on that page,
 * derived from the page content — so the menu tells a customer something real
 * ("Wood Stoves: Pacific Energy, HearthStone, Jotul…") rather than just
 * repeating the link text at them.
 */
export function MegaMenu({
  item,
  open,
  id,
}: {
  item: NavItem;
  open: boolean;
  id: string;
}) {
  if (!item.children?.length) return null;

  const hasFeature = Boolean(item.feature);

  return (
    <div
      id={id}
      className={`mega${open ? " is-open" : ""}${hasFeature ? " has-feature" : ""}`}
      // Closed panels must not be reachable by tab, or the keyboard order runs
      // through every hidden menu on the page.
      inert={!open}
    >
      <div className="wrap mega-inner">
        <div className="mega-links" role="list">
          {item.children.map((child) => {
            const brands = brandsForHref(child.href);
            return (
              <Link key={child.href} href={child.href} className="mega-link" role="listitem">
                <span className="mega-link-label">{child.label}</span>
                {child.blurb ? (
                  <span className="mega-link-blurb">{child.blurb}</span>
                ) : brands.length ? (
                  <span className="mega-link-brands">{brands.join(" · ")}</span>
                ) : null}
              </Link>
            );
          })}
        </div>

        {item.feature ? (
          <div className="mega-feature">
            <Image
              src={item.feature.src}
              alt=""
              width={item.feature.width}
              height={item.feature.height}
              sizes="220px"
            />
            <p>{item.feature.blurb}</p>
          </div>
        ) : null}
      </div>

      {/* Some menus point at their own parent page as one of the children — the
          Visualizer does. There "All Visualizer" is meaningless and the CTA is a
          third link to the same place, so the footer is dropped entirely. */}
      {item.children.every((child) => child.href !== item.href) ? (
        <div className="mega-foot">
          <div className="wrap">
            <Link href={item.href} className="mega-all">
              All {item.label} &rarr;
            </Link>
            <Link href="/visualizer" className="mega-cta">
              See it in your own room &rarr;
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
