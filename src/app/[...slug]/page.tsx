import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/JsonLd";
import { PageSections } from "@/components/PageSections";
import { brandsForHref } from "@/content/nav-data";
import { pageBySlug, pages } from "@/content/pages";
import { business } from "@/content/site";
import type { Page } from "@/content/types";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string[] }> };

/** Pre-render every known page at build time; unknown paths still 404. */
export function generateStaticParams() {
  return pages.map((page) => ({ slug: page.slug.split("/") }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = pageBySlug.get(slug.join("/"));
  if (!page) return {};

  const title = page.metaTitle ?? `${page.title} in ${business.city}, ${business.state}`;

  return {
    title,
    description: page.description ?? descriptionFor(page),
    alternates: { canonical: `/${page.slug}/` },
    openGraph: { title, url: `/${page.slug}/` },
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
          <h1>{page.title}</h1>
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
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <PageSections sections={page.sections} />
        </div>
      </div>
    </>
  );
}
