import Link from "next/link";

import { ShortlistButtons } from "@/components/ShortlistButtons";
import { typeLabel } from "@/content/lineup";
import { business } from "@/content/site";
import type { CatalogModelSummary } from "@/lib/catalog";
import { modelHref } from "@/lib/model-url";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

function MagnifierIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
    </svg>
  );
}

/**
 * A model's photo, clicked to enlarge: the one lightbox in the layout (ImageLightbox) opens it,
 * with the model's name linking to its page. `linkToPage` is off where the photo is already on
 * that page. (On a model's card the photo opens its page instead; see ModelCard.)
 */
export function ModelZoom({
  model,
  brandName,
  linkToPage = true,
}: {
  model: CatalogModelSummary;
  brandName: string;
  linkToPage?: boolean;
}) {
  const full = `${brandName} ${model.name}`;
  if (!model.hero_image) return null;
  return (
    <button
      type="button"
      className="model-zoom"
      data-enlarge={model.hero_image}
      data-caption={full}
      data-detail={typeLabel(model.form, model.fuel)}
      data-href={linkToPage ? modelHref(model) : undefined}
      aria-label={`Enlarge the photo of the ${full}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={model.hero_image} alt={full} loading="lazy" />
      <span className="model-zoom-hint" aria-hidden="true">
        <MagnifierIcon />
      </span>
    </button>
  );
}

/**
 * One model from the maker's lineup. Maker's figures only, with the basis
 * beside efficiency (makers measure it differently). No BTUs: the bases differ
 * too much to set side by side. No prices: ask us.
 */
export function ModelCard({ model, brandName }: { model: CatalogModelSummary; brandName: string }) {
  const full = `${brandName} ${model.name}`;
  const ask = `mailto:${business.email}?subject=${encodeURIComponent(`Question about the ${full}`)}`;
  const temporarilyOut = model.us_availability?.startsWith("temporarily_unavailable");

  return (
    <article className="model-card" id={model.id}>
      <div className="model-photo">
        {model.hero_image ? (
          <>
            {/* The photo opens the model's page, over the list like its name does, and the
                magnifier in its corner enlarges it (Ben, 28 Oct 2026). Keyboards and screen
                readers have the name for the page, so this link stays out of their way. */}
            <Link href={modelHref(model)} className="model-photo-link" scroll={false} tabIndex={-1} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={model.hero_image} alt="" loading="lazy" />
            </Link>
            <button
              type="button"
              className="model-zoom-hint model-zoom-corner"
              data-enlarge={model.hero_image}
              data-caption={full}
              data-detail={typeLabel(model.form, model.fuel)}
              data-href={modelHref(model)}
              aria-label={`Enlarge the photo of the ${full}`}
            >
              <MagnifierIcon />
            </button>
          </>
        ) : (
          <span className="model-photo-none">Photo coming</span>
        )}
        {model.carry_status === "on_floor" ? (
          <span className="model-badge is-floor">On our showroom floor</span>
        ) : model.carry_status === "carried" ? (
          <span className="model-badge">We carry it</span>
        ) : null}
      </div>

      <div className="model-body">
        <h3>
          {/* Opens the model's page over the list (src/app/@modal), keeping the list's place. */}
          <Link href={modelHref(model)} data-model-link scroll={false}>
            {model.name}
          </Link>
        </h3>
        <ul className="model-specs">
          {model.heating_area_sqft_max ? <li>Heats up to {fmt(model.heating_area_sqft_max)} sq ft</li> : null}
          {model.efficiency_pct ? (
            <li>
              {fmt(model.efficiency_pct)}% efficient
              {model.efficiency_basis ? <small> ({model.efficiency_basis})</small> : null}
            </li>
          ) : null}
          {model.burn_time_hr_max && model.fuel === "wood" ? <li>Burns up to {fmt(model.burn_time_hr_max)} hrs</li> : null}
        </ul>
        {temporarilyOut ? <p className="model-note">Temporarily unavailable from the maker.</p> : null}
        <ShortlistButtons
          item={{
            id: model.id,
            name: model.name,
            brand: brandName,
            type: typeLabel(model.form, model.fuel),
            href: modelHref(model),
            photo: model.hero_image,
          }}
        />

        <div className="model-links">
          <Link href={modelHref(model)} scroll={false}>
            Details
          </Link>
          {model.guide_id ? <a href={`/guides/${model.guide_id}/`}>Owner &amp; installer guide</a> : null}
          {model.product_url ? (
            <a href={model.product_url} target="_blank" rel="noopener noreferrer">
              On {brandName}&rsquo;s site
            </a>
          ) : null}
          <a href={ask} className="model-ask">
            Ask about it
          </a>
        </div>
      </div>
    </article>
  );
}
