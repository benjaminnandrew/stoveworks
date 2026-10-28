import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Chooser } from "@/components/Chooser";
import { JsonLd } from "@/components/JsonLd";
import { SearchBox } from "@/components/SearchBox";
import { collage, decor, hero, history, showroom } from "@/content/home";
import { brandsForHref } from "@/content/nav-data";
import { business, shopMenu } from "@/content/site";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * The round badge, front and centre in the hero (Steve wanted the logo there; Ben chose it
 * straight, on the photos where they meet, 28 Oct 2026). The header's own logo stays on show
 * beside it. Both copies share one `sizes`, so they load the same file.
 */
const HERO_BADGE = {
  src: "/images/logo-badge.png",
  alt: `${business.name}, Hayward, Wisconsin, established 1975`,
  width: 622,
  height: 640,
  sizes: "250px",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: business.name,
  url: `${siteUrl}/`,
};

/**
 * The planning tools, shown as cards in "See it in your own room". Just Hearth Studio for now:
 * the room visualizer is retired until Hearth Studio has stoves (Ben, 28 Oct 2026).
 */
const tools = [
  {
    href: "/hearth-studio/",
    title: "Hearth Studio",
    blurb: "Try Buechel stone on a chimney, hearth or accent wall, in a sample room or a photo of your own, and see how much stone the job takes.",
    photo: { src: "/images/fb13.jpg", width: 720, height: 960 },
  },
];

/** Under the search box: a model, a type and a question, all ones the search answers. */
const searchExamples = ["Jøtul F 500", "gas inserts", "how do I clean the glass"];

/** Every heating brand the product pages carry, in the order they first appear. */
const brands = [...new Set(shopMenu.heat.flatMap((l) => brandsForHref(l.href)))];

export default function HomePage() {
  const [before, picked, after] = hero.heading;

  return (
    <>
      <JsonLd data={websiteJsonLd} />

      {/* The first screen: the hero and the hours strip fill the window together,
          so the strip sits on its bottom edge and nothing below peeks in. */}
      <div className="home-first">
        <section className="home-hero">
          <div className="wrap home-hero-grid">
            <div className="home-hero-copy">
              {/* On a phone the photos come after the copy, so the badge leads it instead. */}
              <Image
                className="hero-badge hero-badge-top"
                src={HERO_BADGE.src}
                alt={HERO_BADGE.alt}
                width={HERO_BADGE.width}
                height={HERO_BADGE.height}
                sizes={HERO_BADGE.sizes}
              />
              <h1 className="display home-title">
                {before} <em>{picked}</em> {after}
              </h1>
              <p className="home-lede">{hero.lede}</p>
              <Chooser />
              <div className="home-search">
                <SearchBox variant="hero" surface="home" placeholder="Search, or ask a question" />
                <p className="home-search-try">
                  Try{" "}
                  {searchExamples.map((e, i) => (
                    <span key={e}>
                      {i ? (i === searchExamples.length - 1 ? " or " : ", ") : ""}
                      <Link href={`/search/?q=${encodeURIComponent(e)}&from=home`}>{e}</Link>
                    </span>
                  ))}
                  .
                </p>
              </div>
            </div>

            <div className="collage">
              {collage.map((photo, i) => (
                <figure key={photo.src} className={`snap snap-${i + 1}`}>
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={photo.width}
                    height={photo.height}
                    sizes="(max-width: 900px) 60vw, 380px"
                    priority={i === 0}
                  />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}
              <Image
                className="hero-badge"
                src={HERO_BADGE.src}
                alt={HERO_BADGE.alt}
                width={HERO_BADGE.width}
                height={HERO_BADGE.height}
                sizes={HERO_BADGE.sizes}
                priority
              />
            </div>
          </div>
        </section>

        <section className="visit-band" aria-label="Visit the showroom">
          <div className="wrap visit-grid">
            <div>
              <p className="visit-label">Hours</p>
              <p className="visit-big">{business.hoursShort}</p>
              <p className="visit-small">Closed Sundays</p>
            </div>
            <div>
              <p className="visit-label">Find us</p>
              <p className="visit-big">{business.street}</p>
              <p className="visit-small">
                {business.city}, {business.state} {business.zip} ·{" "}
                <a href={business.mapLink} target="_blank" rel="noopener noreferrer">
                  Directions
                </a>
              </p>
            </div>
            <div>
              <p className="visit-label">Call</p>
              <p className="visit-big">
                <a href={business.phoneHref}>{business.phoneDisplay}</a>
              </p>
              <p className="visit-small">Installation &amp; service</p>
            </div>
          </div>
        </section>
      </div>

      <section className="history-band" aria-labelledby="history-heading">
        <div className="wrap history-grid">
          <Image
            className="history-photo"
            src={history.photo.src}
            alt={history.photo.alt}
            width={history.photo.width}
            height={history.photo.height}
            sizes="(max-width: 900px) 92vw, 580px"
          />
          <div>
            <h2 id="history-heading" className="section-title">
              {history.heading}
            </h2>
            {history.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className="brand-sentence">
              We carry {[...brands, ...history.alsoCarried].join(", ")}, and many more.
            </p>
            <p>{history.closing}</p>
          </div>
        </div>
      </section>

      <section className="plan-band" aria-labelledby="plan-heading">
        <div className="wrap">
          <h2 id="plan-heading" className="section-title">
            See it in your own room
          </h2>
          <div className={`plan-grid${tools.length === 1 ? " is-single" : ""}`}>
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="plan-card">
                <span className="plan-photo">
                  <Image
                    src={tool.photo.src}
                    alt=""
                    width={tool.photo.width}
                    height={tool.photo.height}
                    sizes="(max-width: 900px) 92vw, 620px"
                  />
                  <span className="firelight" aria-hidden="true" />
                  {/* The same nameplate as the showroom cards; it opens on hover. */}
                  <span className="plate">
                    <strong>{tool.title}</strong>
                    <small>
                      <span className="plate-blurb">{tool.blurb}</span>
                      <span className="plate-go">Try it &rarr;</span>
                    </small>
                  </span>
                </span>
              </Link>
            ))}
            {/* One tool for now: what it does sits beside its card, so the band isn't half empty. */}
            {tools.length === 1 ? (
              <div className="plan-text">
                <p>{tools[0].blurb}</p>
                <Link className="btn" href={tools[0].href}>
                  Open {tools[0].title} &rarr;
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="home-section showroom-band" aria-labelledby="showroom-heading">
        <div className="wrap">
          <h2 id="showroom-heading" className="section-title">
            {showroom.heading}
          </h2>
          <ul className="showroom-grid">
            {showroom.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="showroom-card">
                  <span className="print">
                    <Image
                      src={item.photo.src}
                      alt={item.photo.alt}
                      width={item.photo.width}
                      height={item.photo.height}
                      sizes="(max-width: 700px) 46vw, (max-width: 1100px) 30vw, 240px"
                    />
                    {/* A warm glow that rises on hover, like the fire catching. */}
                    <span className="firelight" aria-hidden="true" />
                    {/* Styled after the store's cast nameplate. */}
                    <span className="plate">
                      <strong>{item.title}</strong>
                      <small>{item.sub}</small>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="decor-band" aria-labelledby="decor-heading">
        <div className="wrap decor-grid">
          <div>
            <h2 id="decor-heading" className="section-title">
              {decor.heading}
            </h2>
            <p>{decor.body}</p>
            <Link href="/home-cabin-decor/" className="btn">
              Home &amp; cabin decor
            </Link>
          </div>
          <ul className="decor-photos">
            {decor.photos.map((photo) => (
              <li key={photo.src}>
                <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="(max-width: 900px) 30vw, 200px" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
