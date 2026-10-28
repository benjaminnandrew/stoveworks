import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/JsonLd";
import type { HubFuel } from "@/components/FuelCards";
import { PageSections, type PageLineup } from "@/components/PageSections";
import { brandBySlug, brandForName } from "@/content/brands";
import { brandsForHref } from "@/content/nav-data";
import { pageBySlug, pages } from "@/content/pages";
import { business } from "@/content/site";
import type { Page } from "@/content/types";
import { HUB_FORMS, LINEUP_GROUPS, LINEUP_TYPES, pageForType } from "@/content/lineup";
import { listPublicLineup } from "@/lib/catalog";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string[] }> };

/**
 * Rendered per request: the product pages list the makers' current models from
 * the catalog, and what Steve marks at /admin/carry/ should show straight away.
 */
export const dynamic = "force-dynamic";

/** The page's models by brand. Without the database the page still renders its copy. */
async function lineupFor(slug: string): Promise<PageLineup | undefined> {
  const types = LINEUP_TYPES[slug];
  if (!types) return undefined;
  try {
    const models = (await listPublicLineup()).filter((m) =>
      types.some((t) => t.form === m.form && t.fuel === m.fuel),
    );
    const byBrand = new Map<string, typeof models>();
    for (const m of models) byBrand.set(m.brand_slug, [...(byBrand.get(m.brand_slug) ?? []), m]);
    return { byBrand };
  } catch (err) {
    console.error(`[lineup] ${slug}:`, err);
    return undefined;
  }
}

/**
 * A hub page's fuels, for its "fuels" section: each fuel's product page, its models
 * of the hub's form, and its makers in that page's order (its brand cards, then
 * the catalog's other makers). Without the database the section is left out.
 */
async function fuelsFor(page: Page): Promise<HubFuel[] | undefined> {
  const form = HUB_FORMS[page.slug];
  if (!form || !page.sections.some((s) => s.type === "fuels")) return undefined;
  try {
    const all = await listPublicLineup();
    return LINEUP_GROUPS.filter((g) => g.form === form).flatMap((g) => {
      const href = pageForType(g.form, g.fuel);
      const target = href ? pageBySlug.get(href.slice(1, -1)) : undefined;
      if (!href || !target) return [];
      const models = all.filter((m) => m.form === g.form && m.fuel === g.fuel);
      const carded = target.sections.flatMap((s) => (s.type === "brand" ? [brandForName(s.name)?.slug] : []));
      const makers = [...new Set([...carded, ...models.map((m) => m.brand_slug)])].filter(
        (slug): slug is string => !!slug && !!brandBySlug(slug),
      );
      return [{ label: g.label, href, page: target.title, own: target.slug.startsWith(`${page.slug}/`), models, makers }];
    });
  } catch (err) {
    console.error(`[fuels] ${page.slug}:`, err);
    return undefined;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = pageBySlug.get(slug.join("/"));
  if (!page) return {};

  const title = page.metaTitle ?? `${page.title} in ${business.city}, ${business.state}`;

  return {
    title,
    description: page.description ?? descriptionFor(page),
    alternates: { canonical: `/${page.slug}/` },
    openGraph: { title, url: `/${page.slug}/`, images: [SHARE_IMAGE] },
  };
}

/**
 * Names the brands the page actually carries, which is what the searcher wants to
 * know. Hub pages (/stoves/) carry none themselves, so they borrow their children's.
 */
function descriptionFor(page: Page) {
  const own = brandsForHref(page.slug);
  const brands = own.length
    ? own
    : [
        ...new Set(
          pages.filter((p) => p.slug.startsWith(`${page.slug}/`)).flatMap((p) => brandsForHref(p.slug)),
        ),
      ];
  const list =
    brands.length > 4
      ? `${brands.slice(0, 4).join(", ")} and more`
      : brands.length > 1
        ? `${brands.slice(0, -1).join(", ")} and ${brands.at(-1)}`
        : brands[0];
  const from = list ? ` from ${list}` : "";

  return `${page.title}${from} at ${business.name} in ${business.city}, Wisconsin. Stop in or call ${business.phoneDisplay}.`;
}

/**
 * Breadcrumbs follow the URL, one crumb per path segment that is a real page.
 * /hearth-accessories/gas-logs/ → Hearth Accessories › Gas Logs.
 */
function trailFor(slug: string) {
  const segments = slug.split("/");
  return segments.flatMap((_, i) => {
    const path = segments.slice(0, i + 1).join("/");
    const page = pageBySlug.get(path);
    return page ? [{ label: page.title, href: `/${path}/` }] : [];
  });
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const page = pageBySlug.get(slug.join("/"));
  if (!page) notFound();

  const trail = trailFor(page.slug);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ label: "Home", href: "/" }, ...trail].map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      item: `${siteUrl}${crumb.href}`,
    })),
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
              {trail.map((crumb, i) => (
                <li key={crumb.href}>
                  {i === trail.length - 1 ? (
                    <span aria-current="page">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1>{page.title}</h1>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <PageSections sections={page.sections} lineup={await lineupFor(page.slug)} fuels={await fuelsFor(page)} />
        </div>
      </div>
    </>
  );
}
