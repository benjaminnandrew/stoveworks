import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { brandContent, brands } from "@/content/brands";
import { publicLineupCounts } from "@/lib/catalog";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brands We Carry in Hayward, WI",
  description:
    "Blaze King, Jøtul, HearthStone, Pacific Energy, Kozy Heat, Mendota and more: the stove, insert and fireplace brands at Hayward Stoveworks in Hayward, WI.",
  alternates: { canonical: "/brands/" },
};

export default async function BrandsPage() {
  const counts = await publicLineupCounts();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Brands", item: `${siteUrl}/brands/` },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <div className="page-title">
        <div className="wrap">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <span aria-current="page">Brands</span>
              </li>
            </ol>
          </nav>
          <h1>Brands we carry</h1>
          <p className="page-lede">
            The stove, insert and fireplace makers we sell. Each brand&rsquo;s page has the maker&rsquo;s
            current lineup, with specs and owner &amp; installer guides.
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <ul className="brand-grid">
            {brands.map((b) => {
              const { logo } = brandContent(b.slug);
              const n = counts.get(b.slug) ?? 0;
              return (
                <li key={b.slug}>
                  <Link href={`/brands/${b.slug}/`} className="brand-tile">
                    <span className="brand-tile-logo">
                      {logo ? (
                        <Image src={logo.src} alt="" width={logo.width} height={logo.height} sizes="200px" />
                      ) : (
                        <span className="brand-wordmark">{b.name}</span>
                      )}
                    </span>
                    <strong>{b.name}</strong>
                    <small>{n ? `${n} models in the lineup` : "Ask about the lineup"}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
