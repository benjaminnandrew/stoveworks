import { ShortlistButtons } from "@/components/ShortlistButtons";
import { LINEUP_GROUPS, pageForType, typeLabel } from "@/content/lineup";
import { business } from "@/content/site";
import type { ModelPageData } from "@/lib/model-page";
import { modelHref } from "@/lib/model-url";

/**
 * A model, briefly (Ben, 22 Oct 2026: "basic details for Stoveworks and the
 * customer. Then a link to the manufacturer's page"). The same body serves the
 * full page and the pop-up over a list; only the heading levels and the
 * "More …" row differ.
 */
export function ModelDetail({ data, variant }: { data: ModelPageData; variant: "page" | "modal" }) {
  const { brand, model, view, related } = data;
  const full = `${brand.name} ${model.name}`;
  const H = variant === "modal" ? "h3" : "h2";
  const kind = typeLabel(model.form, model.fuel);
  const plural = LINEUP_GROUPS.find((g) => g.form === model.form && g.fuel === model.fuel)?.label.toLowerCase();
  const listPage = pageForType(model.form, model.fuel);
  const ask = `mailto:${business.email}?subject=${encodeURIComponent(`Question about the ${full}`)}`;
  const temporarilyOut = model.us_availability?.startsWith("temporarily_unavailable");

  // The hero first, then the rest of the maker's photos, without repeats.
  const photos = [
    ...new Map(
      [
        ...(model.hero_image ? [{ url: model.hero_image, alt: full }] : []),
        ...model.photos.map((p) => ({ url: p.url, alt: p.alt || full })),
      ].map((p) => [p.url, p]),
    ).values(),
  ].slice(0, 5);

  return (
    <div className={`model-detail is-${variant}`} data-enlarge-scope>
      <div className="model-detail-grid">
        <div className="model-gallery">
          {photos.length ? (
            photos.map((p, i) => (
              <div key={p.url} className={`model-photo${i === 0 ? " is-main" : ""}`}>
                <button
                  type="button"
                  className="model-zoom"
                  data-enlarge={p.url}
                  data-caption={full}
                  data-detail={kind}
                  aria-label={`Enlarge photo ${i + 1} of the ${full}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={i === 0 ? full : p.alt} loading={i === 0 ? "eager" : "lazy"} />
                </button>
              </div>
            ))
          ) : (
            <div className="model-photo is-main">
              <span className="model-photo-none">Photo coming</span>
            </div>
          )}
        </div>

        <div className="model-summary">
          {model.carry_status === "on_floor" ? (
            <p className="model-status is-floor">On our showroom floor</p>
          ) : model.carry_status === "carried" ? (
            <p className="model-status">We carry it</p>
          ) : null}

          {view.description ? <p className="model-desc">{view.description}</p> : null}

          {view.facts.length ? (
            <dl className="model-facts">
              {view.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {temporarilyOut ? <p className="model-note">Temporarily unavailable from the maker.</p> : null}

          <div className="model-cta">
            <a className="btn" href={ask}>
              Ask about it
            </a>
            <a className="tool" href={business.phoneHref}>
              Call {business.phoneDisplay}
            </a>
          </div>
          <div className="model-keep">
            <ShortlistButtons
              size="large"
              item={{ id: model.id, name: model.name, brand: brand.name, type: kind, href: modelHref(model), photo: model.hero_image }}
            />
          </div>
          {model.carry_status !== "on_floor" ? (
            <p className="model-stock">
              Not every model is on our showroom floor. Call or stop in and we&rsquo;ll tell you what we have.
            </p>
          ) : null}

          <ul className="model-links-list">
            {model.product_url ? (
              <li>
                <a href={model.product_url} target="_blank" rel="noopener noreferrer">
                  Full specs on {brand.name}&rsquo;s site&nbsp;&#8599;
                </a>
              </li>
            ) : null}
            {model.guides.map((g) => (
              <li key={g.id}>
                <a href={g.url}>
                  Owner &amp; installer guide{g.configuration ? ` (${g.configuration})` : ""}
                </a>
              </li>
            ))}
          </ul>
          {model.guides.length ? (
            <p className="model-install">
              Clearances, venting and installation details are in the owner &amp; installer guide, each with the page of
              the maker&rsquo;s manual it comes from.
            </p>
          ) : null}
        </div>
      </div>

      <p className="model-more">
        <a href={`/brands/${brand.slug}/`}>All {brand.name} models</a>
        {listPage && plural ? (
          <>
            {" · "}
            <a href={listPage}>All {plural}</a>
          </>
        ) : null}
      </p>

      {variant === "page" && related.length ? (
        <section className="model-related" aria-labelledby="model-related">
          <H id="model-related">
            More {brand.name} {plural ?? `${kind}s`}
          </H>
          <ul>
            {related.map((r) => (
              <li key={r.id}>
                <a href={modelHref(r)}>
                  <span className="model-related-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.hero_image ? <img src={r.hero_image} alt="" loading="lazy" /> : null}
                  </span>
                  <span>{r.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
