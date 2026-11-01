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

/**
 * "Choose a maker": every maker on the page as a card of the same size, with its logo, two of its
 * models and its count, first thing under the title. Each jumps to its maker's section. It was a
 * row of small tiles under a small "Jump to a maker", so the first maker's big card took the eye
 * (Ben, 1 Nov 2026: "so all brands are notable upon initial load").
 */
function MakerJump({ slugs, lineup }: { slugs: string[]; lineup: PageLineup }) {
  const items = slugs.map((slug) => ({
    slug,
    name: brandBySlug(slug)!.name,
    count: lineup.byBrand.get(slug)?.length ?? 0,
  }));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  // columns: all in one row on a wide screen (two rows past 8), else two even rows (4 + 3, not 5 + 2)
  const n = items.length;
  const cols = { "--row": n > 8 ? Math.ceil(n / 2) : n, "--two": n > 4 ? Math.ceil(n / 2) : n } as React.CSSProperties;
  return (
    <>
      <MakerBar items={items} stripId="maker-strip" />
      <nav className="maker-jump" id="maker-strip" aria-labelledby="maker-jump-title">
        <h2 id="maker-jump-title">Choose a maker</h2>
        <p className="maker-jump-lede">
          {total} model{total === 1 ? "" : "s"} from {items.length} makers, in their current lineups
        </p>
        <ul style={cols}>
          {items.map(({ slug, name, count }) => {
            const { logo } = brandContent(slug);
            const photos = (lineup.byBrand.get(slug) ?? []).filter((m) => m.hero_image).slice(0, 2);
            return (
              <li key={slug}>
                <a href={`#maker-${slug}`}>
                  <span className="maker-jump-logo">
                    {logo ? (
                      <Image src={logo.src} alt="" width={logo.width} height={logo.height} sizes="170px" />
                    ) : (
                      <span className="brand-wordmark" aria-hidden="true">
                        {name}
                      </span>
                    )}
                  </span>
                  <span className="maker-jump-photos" aria-hidden="true">
                    {photos.length ? (
                      photos.map((m) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.id} src={m.hero_image!} alt="" loading="lazy" />
                      ))
                    ) : (
                      <span className="maker-jump-ask">Ask us about these</span>
                    )}
                  </span>
                  <span className="maker-jump-name">
                    <strong>{name}</strong>
                    <small>{count ? `${count} model${count === 1 ? "" : "s"}` : "Ask us"}</small>
                  </span>
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

    // shown in the page's title (src/app/[...slug]/page.tsx)
    case "intro":
      return null;

    case "fuels":
      if (fuels?.length) return <FuelCards heading={section.heading} intro={section.intro} fuels={fuels} />;
      // without the catalog, the line and its links to the fuels' pages
      return section.intro ? <Html className="prose" html={section.intro} /> : null;

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
