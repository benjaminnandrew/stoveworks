import Image from "next/image";

import { ModelZoom } from "@/components/ModelCard";
import { brandBySlug, brandContent } from "@/content/brands";
import type { CatalogModelSummary } from "@/lib/catalog";

/**
 * One fuel on a hub page (Ben, 21 Oct 2026: "/inserts/ is basically not much"):
 * its product page, the models listed there and the makers, in the page's order.
 * `own` is false for a fuel listed under another hub, like the electric insert on
 * Electric Fireplaces.
 */
export type HubFuel = {
  label: string;
  href: string;
  page: string;
  own: boolean;
  models: CatalogModelSummary[];
  makers: string[];
};

const PHOTOS = 4;

/** A few photos taken in turn from each maker, rather than all from the first. */
function sample(fuel: HubFuel) {
  const queues = fuel.makers.map((slug) => fuel.models.filter((m) => m.brand_slug === slug && m.hero_image));
  const picked: CatalogModelSummary[] = [];
  for (let round = 0; picked.length < PHOTOS && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && picked.length < PHOTOS) picked.push(q[round]);
  }
  return picked;
}

const count = (n: number) => `${n} model${n === 1 ? "" : "s"}`;
/** The name the site uses ("Mendota"), not the catalog's ("Mendota Hearth"). */
const brandName = (m: CatalogModelSummary) => brandBySlug(m.brand_slug)?.name ?? m.brand_name;

function FuelCard({ fuel }: { fuel: HubFuel }) {
  const n = fuel.models.length;
  const photos = sample(fuel);
  return (
    <article className="fuel-card">
      <h3>
        <a href={fuel.href}>{fuel.label}</a>
      </h3>
      <p className="fuel-count">{n ? `${count(n)} in the makers’ current lineups` : "Ask us about these"}</p>
      {photos.length ? (
        <ul className="fuel-photos">
          {photos.map((m) => (
            <li key={m.id} className="model-photo">
              <ModelZoom model={m} brandName={brandName(m)} />
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="fuel-makers" aria-label={`${fuel.label} makers`}>
        {fuel.makers.map((slug) => {
          const brand = brandBySlug(slug)!;
          const { logo } = brandContent(slug);
          return (
            <li key={slug}>
              <a href={`${fuel.href}#maker-${slug}`} title={brand.name}>
                {logo ? (
                  <Image src={logo.src} alt={brand.name} width={logo.width} height={logo.height} sizes="110px" />
                ) : (
                  <span className="brand-wordmark">{brand.name}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      <a className="btn fuel-go" href={fuel.href}>
        {n === 1
          ? `See the ${fuel.label.replace(/s$/, "").toLowerCase()}`
          : `See ${n ? `all ${n}` : "the"} ${fuel.label.toLowerCase()}`}{" "}
        &rarr;
      </a>
    </article>
  );
}

export function FuelCards({ heading, intro, fuels }: { heading: string; intro?: string; fuels: HubFuel[] }) {
  const own = fuels.filter((f) => f.own);
  const elsewhere = fuels.filter((f) => !f.own && f.models.length);
  return (
    <section className="fuel-picker" aria-label={heading}>
      <h2>{heading}</h2>
      {/* The line's links go to the same pages as the cards under it, so they're left out here.
          Content HTML from src/content, not user input. */}
      {intro ? (
        <div className="fuel-picker-lede" dangerouslySetInnerHTML={{ __html: intro.replace(/<\/?a\b[^>]*>/g, "") }} />
      ) : null}
      <div className="fuel-cards">
        {own.map((f) => (
          <FuelCard key={f.href} fuel={f} />
        ))}
      </div>
      {elsewhere.length ? (
        <div className="fuel-also">
          <p className="fuel-also-head">Also in the makers&rsquo; lineups</p>
          <ul>
            {elsewhere.map((f) => {
              const [first] = f.models;
              const one = f.models.length === 1;
              return (
                <li key={f.href}>
                  <span className="model-photo">
                    <ModelZoom model={first} brandName={brandName(first)} />
                  </span>
                  <a href={f.href}>
                    <strong>{one ? f.label.replace(/s$/, "") : f.label}</strong>
                    <span>{one ? `${brandName(first)} ${first.name}` : count(f.models.length)}</span>
                    <small>On the {f.page} page &rarr;</small>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
