import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/JsonLd";
import { ModelCard } from "@/components/ModelCard";
import { LINEUP_GROUPS } from "@/content/lineup";
import { brandBySlug, brandContent } from "@/content/brands";
import { business } from "@/content/site";
import { listPublicLineup, type CatalogModelSummary } from "@/lib/catalog";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };

// The lineup comes from the database (the Big Brain, plus Steve's carry marks),
// so it renders per request rather than at build, when there may be no database.
export const dynamic = "force-dynamic";

const plain = (html: string | null) =>
  html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;

/** "wood and gas stoves, inserts and fireplaces", from what the lineup holds. */
function typesPhrase(models: CatalogModelSummary[]) {
  const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] ?? "");
  const fuels = [...new Set(models.map((m) => m.fuel).filter(Boolean))] as string[];
  const forms = [...new Set(models.map((m) => m.form).filter(Boolean))].map((f) =>
    f === "cook_stove" ? "cook stoves" : `${f}s`,
  );
  return forms.length ? `${and(fuels)} ${and(forms)}` : "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = brandBySlug(slug);
  if (!brand) return {};
  const lineup = brand.inCatalog ? await listPublicLineup(slug) : [];
  const types = typesPhrase(lineup);
  const title = `${brand.name} in Hayward, WI`;
  const description = brand.inCatalog
    ? `${brand.name} ${types} at Hayward Stoveworks in Hayward, Wisconsin: the maker's current lineup, with specs and owner & installer guides.`
    : `${brand.name} at Hayward Stoveworks in Hayward, Wisconsin. Ask us about the current lineup, or stop in on County Road B.`;
  return {
    title,
    description,
    alternates: { canonical: `/brands/${slug}/` },
    openGraph: { title, url: `/brands/${slug}/`, images: [SHARE_IMAGE] },
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = brandBySlug(slug);
  if (!brand) notFound();

  const { body, logo, pages: onPages } = brandContent(slug);
  const lineup = brand.inCatalog ? await listPublicLineup(slug) : [];
  const groups = LINEUP_GROUPS.map((g) => ({
    ...g,
    models: lineup.filter((m) => m.form === g.form && m.fuel === g.fuel),
  })).filter((g) => g.models.length);
  const onFloor = lineup.filter((m) => m.carry_status === "on_floor").length;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Home", href: "/" },
      { name: "Brands", href: "/brands/" },
      { name: brand.name, href: `/brands/${slug}/` },
    ].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${siteUrl}${c.href}` })),
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <div className="page-title">
        <div className="wrap brand-hero">
          <div>
            <nav aria-label="Breadcrumb">
              <ol className="breadcrumbs">
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <Link href="/brands/">Brands</Link>
                </li>
                <li>
                  <span aria-current="page">{brand.name}</span>
                </li>
              </ol>
            </nav>
            <h1>{brand.name}</h1>
            {body ? <p className="page-lede">{plain(body)}</p> : null}
          </div>
          {logo ? (
            <div className="brand-hero-logo">
              <Image src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} sizes="260px" />
            </div>
          ) : (
            <span className="brand-wordmark">{brand.name}</span>
          )}
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {onPages.length ? (
            <p className="brand-where">
              On our site:{" "}
              {onPages.map((p, i) => (
                <span key={p.slug}>
                  {i ? " · " : ""}
                  <Link href={`/${p.slug}/`}>{p.title}</Link>
                </span>
              ))}
            </p>
          ) : null}

          {groups.length ? (
            <>
              <p className="notice lineup-notice">
                <strong>This is {brand.name}&rsquo;s current US lineup,</strong> with the maker&rsquo;s own
                figures.{" "}
                {onFloor
                  ? `${onFloor === 1 ? "One of these is" : `${onFloor} of these are`} on our showroom floor. `
                  : "Not every model is on our showroom floor, "}
                {onFloor ? "For the rest, " : "so "}
                call <a href={business.phoneHref}>{business.phoneDisplay}</a> or stop in and we&rsquo;ll tell you
                what we have.
              </p>

              {groups.map((g) => (
                <section key={g.label} className="lineup-group" aria-labelledby={`g-${g.form}-${g.fuel}`}>
                  <h2 id={`g-${g.form}-${g.fuel}`}>
                    {g.label} <small>{g.models.length}</small>
                  </h2>
                  <div className="lineup-grid">
                    {g.models.map((m) => (
                      <ModelCard key={m.id} model={m} brandName={brand.name} />
                    ))}
                  </div>
                </section>
              ))}
            </>
          ) : (
            <p className="notice">
              <strong>Ask us about {brand.name}&rsquo;s current lineup.</strong> Call{" "}
              <a href={business.phoneHref}>{business.phoneDisplay}</a>, stop in, or see{" "}
              <a href={brand.website} target="_blank" rel="noopener noreferrer">
                {brand.name}&rsquo;s website
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </>
  );
}
