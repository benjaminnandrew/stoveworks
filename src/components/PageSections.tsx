import Image from "next/image";
import { Fragment } from "react";

import { FuelCards, type HubFuel } from "@/components/FuelCards";
import { MakerBar } from "@/components/MakerBar";
import { ModelCard } from "@/components/ModelCard";
import { brandBySlug, brandContent, brandForName, type Brand } from "@/content/brands";
import { LINEUP_GROUPS } from "@/content/lineup";
import type { Media, Section } from "@/content/types";
import type { CatalogModelSummary } from "@/lib/catalog";

/** A product page's models from the catalog, by brand slug. */
export type PageLineup = { byBrand: Map<string, CatalogModelSummary[]> };

/** Shown before the rest fold away: two rows on a desktop. */
const FIRST = 10;

function Figure({ media, sizes }: { media: Media; sizes?: string }) {
  const img = <Image src={media.src} alt={media.alt} width={media.width} height={media.height} sizes={sizes} />;

  if (!media.href) return img;

  const external = !media.href.startsWith("/");
  return (
    <a className="logo-link" href={media.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {img}
    </a>
  );
}

/**
 * Content HTML is authored in `src/content` — it is not user input, so it is
 * safe to render directly.
 */
function Html({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** "wood stoves", or "electric fireplaces & electric inserts" when a brand has both. */
function typeLabel(models: CatalogModelSummary[]) {
  const labels = LINEUP_GROUPS.filter((g) => models.some((m) => m.form === g.form && m.fuel === g.fuel)).map((g) =>
    g.label.toLowerCase(),
  );
  return labels.join(" & ");
}

/** The brand's models for this page, under its card. Past the first two rows they fold away. */
function BrandModels({ brand, models }: { brand: Brand; models: CatalogModelSummary[] }) {
  const what = `${brand.name} ${typeLabel(models)}`;
  const cards = (list: CatalogModelSummary[]) => (
    <div className="lineup-grid">
      {list.map((m) => (
        <ModelCard key={m.id} model={m} brandName={brand.name} />
      ))}
    </div>
  );
  return (
    <div className="brand-models">
      <p className="brand-models-head">
        <strong>{what}</strong> <small>{models.length} in the maker&rsquo;s current lineup</small>
      </p>
      {cards(models.slice(0, FIRST))}
      {models.length > FIRST ? (
        <details className="lineup-more">
          <summary>
            Show all {models.length} {what}
          </summary>
          {cards(models.slice(FIRST))}
        </details>
      ) : null}
    </div>
  );
}

/** Logo tiles that jump to each brand on the page. */
function MakerJump({ slugs, lineup }: { slugs: string[]; lineup: PageLineup }) {
  const items = slugs.map((slug) => ({
    slug,
    name: brandBySlug(slug)!.name,
    count: lineup.byBrand.get(slug)?.length ?? 0,
  }));
  return (
    <>
      <MakerBar items={items} stripId="maker-strip" />
      <nav className="maker-jump" id="maker-strip" aria-label="Makers on this page">
        <p className="maker-jump-head">Jump to a maker</p>
        <ul>
          {slugs.map((slug) => {
            const brand = brandBySlug(slug)!;
            const { logo } = brandContent(slug);
            const n = lineup.byBrand.get(slug)?.length ?? 0;
            return (
              <li key={slug}>
                <a href={`#maker-${slug}`}>
                  <span className="maker-jump-logo">
                    {logo ? (
                      <Image src={logo.src} alt="" width={logo.width} height={logo.height} sizes="120px" />
                    ) : (
                      <span className="brand-wordmark" aria-hidden="true">
                        {brand.name}
                      </span>
                    )}
                  </span>
                  <strong>{brand.name}</strong>
                  <small>{n ? `${n} model${n === 1 ? "" : "s"}` : "Ask us"}</small>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** A brand that has models of this type but no card on the page: its card is built from its other pages. */
function BrandCard({ brand }: { brand: Brand }) {
  const { body, logo } = brandContent(brand.slug);
  return (
    <article className="brand">
      <div>
        <h3>{brand.name}</h3>
        {body ? <Html className="brand-body" html={body} /> : null}
        <a className="brand-lineup-link" href={`/brands/${brand.slug}/`}>
          See the {brand.name} lineup &rarr;
        </a>
      </div>
      <div className="brand-logo">
        {logo ? (
          <Figure media={logo} sizes="(max-width: 768px) 60vw, 320px" />
        ) : (
          <a className="brand-wordmark" href={brand.website} target="_blank" rel="noopener noreferrer">
            {brand.name}
          </a>
        )}
      </div>
    </article>
  );
}

function SectionBlock({ section, fuels }: { section: Section; fuels?: HubFuel[] }) {
  switch (section.type) {
    case "prose":
      return <Html className="prose" html={section.html} />;

    case "prose-aside":
      return (
        <div className="prose-aside">
          <Html className="prose" html={section.html} />
          <div className="aside">
            {section.aside.map((m) => (
              <Figure key={m.src + (m.href ?? "")} media={m} sizes="(max-width: 768px) 60vw, 320px" />
            ))}
          </div>
        </div>
      );

    case "brand":
      return (
        <article className="brand">
          <div>
            <h3>{section.name}</h3>
            <Html className="brand-body" html={section.body} />
            {brandForName(section.name) ? (
              <a className="brand-lineup-link" href={`/brands/${brandForName(section.name)!.slug}/`}>
                See the {brandForName(section.name)!.name} lineup &rarr;
              </a>
            ) : null}
          </div>
          <div className="brand-logo">
            {section.logo ? (
              <Figure media={section.logo} sizes="(max-width: 768px) 60vw, 320px" />
            ) : section.website ? (
              <a className="brand-wordmark" href={section.website} target="_blank" rel="noopener noreferrer">
                {section.name}
              </a>
            ) : (
              <span className="brand-wordmark">{section.name}</span>
            )}
          </div>
        </article>
      );

    case "media-grid":
      return (
        <div className="media-grid" data-cols={section.cols}>
          {section.items.map((m) => (
            <Figure
              key={m.src + (m.href ?? "")}
              media={m}
              sizes={`(max-width: 700px) 90vw, ${Math.round(100 / section.cols)}vw`}
            />
          ))}
        </div>
      );

    case "photos":
      return (
        <section className="photo-set" aria-label={section.heading ?? "Photos from the store"}>
          {section.heading ? <h2>{section.heading}</h2> : null}
          <ul className="photo-set-grid">
            {section.items.map((m) => (
              <li key={m.src}>
                {/* Click to enlarge: the one lightbox in the layout (ImageLightbox) opens it. */}
                <button
                  type="button"
                  className="print photo-set-zoom"
                  data-enlarge={m.src}
                  data-caption={m.alt}
                  aria-label={`Enlarge: ${m.alt}`}
                >
                  <Image src={m.src} alt={m.alt} width={m.width} height={m.height} sizes="(max-width: 700px) 90vw, 33vw" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      );

    case "fuels":
      return fuels?.length ? <FuelCards heading={section.heading} fuels={fuels} /> : null;

    case "embed":
      return (
        <div className="embed-frame">
          <iframe
            src={extractSrc(section.html)}
            title="Map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      );
  }
}

function extractSrc(html: string) {
  return html.match(/src="([^"]+)"/)?.[1] ?? "";
}

export function PageSections({
  sections,
  lineup,
  fuels,
}: {
  sections: Section[];
  lineup?: PageLineup;
  fuels?: HubFuel[];
}) {
  if (!lineup) {
    return (
      <>
        {sections.map((section, i) => (
          <div className="section" key={i}>
            <SectionBlock section={section} fuels={fuels} />
          </div>
        ))}
      </>
    );
  }

  // Each brand card gets its models beneath it. Brands with models of this type
  // but no card here follow the last card, and a strip of logos leads to them all.
  const slugOf = (section: Section) => (section.type === "brand" ? brandForName(section.name)?.slug : undefined);
  const carded = sections.map(slugOf).filter((s): s is string => Boolean(s));
  const extra = [...lineup.byBrand.keys()].filter((slug) => !carded.includes(slug) && brandBySlug(slug));
  const firstBrand = sections.findIndex((s) => s.type === "brand");
  const lastBrand = sections.findLastIndex((s) => s.type === "brand");
  const all = [...carded, ...extra];

  const block = (slug: string, card: React.ReactNode) => {
    const models = lineup.byBrand.get(slug) ?? [];
    return (
      <div className="section brand-block" id={`maker-${slug}`} key={`maker-${slug}`}>
        {card}
        {models.length ? <BrandModels brand={brandBySlug(slug)!} models={models} /> : null}
      </div>
    );
  };

  return (
    <>
      {sections.map((section, i) => {
        const slug = slugOf(section);
        return (
          <Fragment key={i}>
            {i === firstBrand && all.length > 1 ? <MakerJump slugs={all} lineup={lineup} /> : null}
            {slug ? (
              block(slug, <SectionBlock section={section} />)
            ) : (
              <div className="section">
                <SectionBlock section={section} fuels={fuels} />
              </div>
            )}
            {i === lastBrand ? extra.map((s) => block(s, <BrandCard brand={brandBySlug(s)!} />)) : null}
          </Fragment>
        );
      })}
      {lastBrand === -1 ? extra.map((s) => block(s, <BrandCard brand={brandBySlug(s)!} />)) : null}
    </>
  );
}
