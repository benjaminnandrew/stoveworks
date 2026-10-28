import type { Metadata } from "next";
import Link from "next/link";

import { JumpBar } from "@/components/JumpBar";
import { SearchBox, type GuideFinder } from "@/components/SearchBox";
import { brands } from "@/content/brands";
import { LINEUP_GROUPS } from "@/content/lineup";
import { business } from "@/content/site";
import { guideUrl, listPublicLineup, type CatalogModelSummary } from "@/lib/catalog";

// From the database (the Big Brain plus Steve's carry marks), per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // "Manuals" is the nav's word for this page (27 Oct 2026); it's what owners call them.
  title: "Stove & Fireplace Manuals & Guides",
  description:
    "Manuals and owner & installer guides for the stoves, inserts and fireplaces we sell: lighting, everyday care, troubleshooting and installation.",
  alternates: { canonical: "/guides/" },
};

type BrandGuides = { slug: string; name: string; groups: { label: string; models: CatalogModelSummary[] }[] };

/**
 * Every guide, by brand and then by type, for the models the site lists (so none for a fuel
 * Stoveworks doesn't sell). The Services page's owner's-manual links come here as
 * /guides/?for=owner (27 Oct 2026), and then each guide opens on its homeowner side
 * (the guides' own #homeowner deep link) instead of asking homeowner or installer.
 */
async function guidesByBrand(): Promise<BrandGuides[] | null> {
  try {
    const models = (await listPublicLineup()).filter((m) => m.guide_id);
    return brands.flatMap((b) => {
      const own = models.filter((m) => m.brand_slug === b.slug);
      const groups = LINEUP_GROUPS.flatMap((g) => {
        const these = own
          .filter((m) => m.form === g.form && m.fuel === g.fuel)
          .sort((x, y) => x.name.localeCompare(y.name, "en", { numeric: true }));
        return these.length ? [{ label: g.label, models: these }] : [];
      });
      return groups.length ? [{ slug: b.slug, name: b.name, groups }] : [];
    });
  } catch (err) {
    console.error("[guides] hub:", err);
    return null;
  }
}

type Props = { searchParams: Promise<{ for?: string }> };

export default async function GuidesPage({ searchParams }: Props) {
  const list = await guidesByBrand();
  const side = (await searchParams).for === "owner" ? "#homeowner" : "";

  // What the finder opens: each model's guide (on the owner side in owner mode), each maker's list.
  const finder: GuideFinder = { models: {}, brands: {} };
  for (const b of list ?? []) {
    finder.brands[b.slug] = `#${b.slug}`;
    for (const g of b.groups) {
      for (const m of g.models) finder.models[m.id] = { href: `${guideUrl(m.guide_id!)}${side}`, name: m.name, brand: b.name };
    }
  }

  return (
    <>
      {/* The heading and a shorter line beside a type-or-talk finder (Ben, 28 Oct 2026): a model
          opens its guide, so the title area is shorter than before even with the box in it. */}
      <div className="page-title guide-hub-title">
        <div className="wrap guide-hub-head">
          <div>
            <nav aria-label="Breadcrumb">
              <ol className="breadcrumbs">
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <span aria-current="page">Manuals</span>
                </li>
              </ol>
            </nav>
            <h1>Manuals &amp; guides</h1>
            <p className="page-lede guide-hub-lede">
              Lighting, everyday care and troubleshooting for owners, and installation details for installers.
            </p>
          </div>
          {list?.length ? (
            <div className="guide-hub-find">
              <SearchBox variant="hero" surface="page" placeholder="Type or say the model" guides={finder} />
            </div>
          ) : null}
        </div>
      </div>

      {list?.length ? <JumpBar items={list.map((b) => ({ id: b.slug, label: b.name }))} label="Brands" /> : null}

      <div className="page-body">
        <div className="wrap">
          {list?.length ? (
            list.map((b) => (
              <section key={b.slug} id={b.slug} className="guide-hub-brand" aria-labelledby={`${b.slug}-heading`}>
                <h2 id={`${b.slug}-heading`}>{b.name}</h2>
                {b.groups.map((g) => (
                  <div key={g.label} className="guide-hub-group">
                    <h3>{g.label}</h3>
                    <ul>
                      {g.models.map((m) => (
                        <li key={m.id}>
                          <a href={`${guideUrl(m.guide_id!)}${side}`}>{m.name}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))
          ) : (
            <p className="notice">
              The guides aren&rsquo;t available right now. Call us at{" "}
              <a href={business.phoneHref}>{business.phone}</a> and we&rsquo;ll help.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
