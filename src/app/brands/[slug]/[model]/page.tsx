import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/JsonLd";
import { ModelDetail } from "@/components/ModelDetail";
import { loadModelPage, modelJsonLd, modelMetadata } from "@/lib/model-page";

type Props = { params: Promise<{ slug: string; model: string }> };

// From the database (the Big Brain plus Steve's carry marks), per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, model } = await params;
  return modelMetadata(slug, model);
}

/**
 * A model's own page (Ben, 22 Oct 2026). Opened from a list it shows as a
 * pop-up instead (src/app/@modal); a direct visit, a refresh or a shared link
 * lands here.
 */
export default async function ModelPage({ params }: Props) {
  const { slug, model: modelSlug } = await params;
  const data = await loadModelPage(slug, modelSlug);
  if (!data) notFound();
  const { brand, model, view } = data;

  return (
    <>
      {modelJsonLd(data).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <div className="page-title">
        <div className="wrap">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/brands/">Brands</Link>
              </li>
              <li>
                <Link href={`/brands/${brand.slug}/`}>{brand.name}</Link>
              </li>
              <li>
                <span aria-current="page">{model.name}</span>
              </li>
            </ol>
          </nav>
          <h1>
            {brand.name} {model.name}
          </h1>
          <p className="page-lede">{view.typeLine}</p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <ModelDetail data={data} variant="page" />
        </div>
      </div>
    </>
  );
}
