import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageSections } from "@/components/PageSections";
import { pageBySlug, pages } from "@/content/pages";
import { nav } from "@/content/site";

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

  return {
    title: page.title,
    description: page.description ?? descriptionFor(page.slug, page.title),
    alternates: { canonical: `/${page.slug}` },
    openGraph: { title: page.title, url: `/${page.slug}` },
  };
}

function descriptionFor(slug: string, title: string) {
  return `${title} from The Stove Works in Hayward, Wisconsin — quality brands, expert advice and factory-trained installation.`.replace(
    /\s+/g,
    " ",
  );
}

/** Walk the nav tree to build a breadcrumb trail for the current path. */
function trailFor(slug: string) {
  const trail: { label: string; href: string }[] = [];
  for (const item of nav) {
    if (item.href === `/${slug}`) {
      trail.push({ label: item.label, href: item.href });
      return trail;
    }
    const child = item.children?.find((c) => c.href === `/${slug}`);
    if (child) {
      trail.push({ label: item.label, href: item.href }, { label: child.label, href: child.href });
      return trail;
    }
  }
  return trail;
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const page = pageBySlug.get(slug.join("/"));
  if (!page) notFound();

  const trail = trailFor(page.slug);

  return (
    <>
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
