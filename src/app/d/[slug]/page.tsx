import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DesignPreview } from "@/components/visualizer/DesignPreview";
import { parseItems } from "@/lib/design-types";
import { getDesignByShareSlug, getRoomPhoto } from "@/lib/designs";
import { toPlaceable } from "@/lib/placeable";
import { getProductsByIds } from "@/lib/products";
import { business } from "@/content/site";

export const metadata: Metadata = {
  title: "Shared design",
  // Share links are unguessable, not secret. Keep them out of search results.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SharedDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const design = await getDesignByShareSlug(slug);
  if (!design) notFound();

  const items = parseItems(design.items);
  const [photo, productRows] = await Promise.all([
    getRoomPhoto(design.room_photo_id),
    getProductsByIds([...new Set(items.map((i) => i.productId))]),
  ]);
  if (!photo) notFound();

  const products = new Map([...productRows].map(([id, p]) => [id, toPlaceable(p)]));

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{design.title}</h1>
          <p className="page-lede">A room design shared from the {business.shortName} visualizer.</p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <div className="share-layout">
            <DesignPreview
              photoUrl={`/api/photos/${photo.id}?share=${encodeURIComponent(slug)}`}
              photoWidth={photo.width}
              photoHeight={photo.height}
              items={items}
              products={products}
            />

            <aside className="share-side">
              <h2>In this design</h2>
              <ul className="share-products">
                {items.map((item) => {
                  const p = products.get(item.productId);
                  if (!p) return null;
                  return (
                    <li key={item.id}>
                      <strong>{p.name}</strong>
                      {design.pct_per_inch ? (
                        <span>
                          {(item.widthPct / Number(design.pct_per_inch)).toFixed(0)}&Prime; wide
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <p>
                Want to see these in person? We&rsquo;re at {business.street}, {business.city}.
              </p>
              <Link className="btn" href="/contact-us">
                Get in touch
              </Link>
              <p className="share-cta">
                <Link href="/visualizer">Try it with your own room →</Link>
              </p>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
