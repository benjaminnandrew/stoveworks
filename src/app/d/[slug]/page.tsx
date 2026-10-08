import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ScenePreview } from "@/components/studio/ScenePreview";
import { business } from "@/content/site";
import { isUuid } from "@/lib/design-types";
import { designStateOf, getDesignByShareSlug, getRoomPhoto } from "@/lib/designs";
import { toPlaceable } from "@/lib/placeable";
import { getProductsByIds } from "@/lib/products";
import { getSwatchesByIds } from "@/lib/stone";
import { regionStoneId, resolveItems, resolveRegions, type ViewIndex } from "@/lib/studio";
import { estimateRegion, totalEstimate } from "@/lib/veneer-types";

export const metadata: Metadata = {
  title: "Shared design",
  // Share links are unguessable, not secret. Keep them out of search results.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A Room Studio design shared by its owner: the picture (both options when it
 * was saved as a comparison), what's in it, and the stone estimate.
 *
 * Mock-ups from the old standalone veneer tool were moved into designs under
 * their original share slugs, so links sent before the merge still land here.
 */
export default async function SharedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const row = await getDesignByShareSlug(slug);
  if (!row) notFound();

  const design = designStateOf(row);
  const views: ViewIndex[] = design.compare ? [0, 1] : [0];

  const productIds = new Set(design.items.map((i) => i.productId));
  const stoneIds = new Set(design.regions.map((r) => r.stoneId));
  for (const id of Object.values(design.compare?.products ?? {})) productIds.add(id);
  for (const id of Object.values(design.compare?.stones ?? {})) if (id) stoneIds.add(id);

  const [photo, productRows, stones] = await Promise.all([
    getRoomPhoto(row.room_photo_id),
    // Ids come from stored JSON; only well-formed ones go near the uuid queries.
    getProductsByIds([...productIds].filter(isUuid)),
    getSwatchesByIds([...stoneIds].filter(isUuid)),
  ]);
  if (!photo) notFound();

  const products = new Map([...productRows].map(([id, p]) => [id, toPlaceable(p)]));
  const photoProps = {
    url: `/api/photos/${photo.id}?share=${encodeURIComponent(slug)}`,
    width: photo.width,
    height: photo.height,
  };
  const pct = design.pctPerInch;

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{row.title}</h1>
          <p className="page-lede">A room design shared from the {business.shortName} Room Studio.</p>
        </div>
      </div>
      <div className="page-body">
        <div className="wrap">
          <div className="share-layout">
            <div className="share-views">
              {views.map((v) => (
                <figure key={v} className="share-view">
                  <ScenePreview photo={photoProps} design={design} view={v} products={products} stones={stones} />
                  {views.length > 1 ? <figcaption>Option {v === 0 ? "A" : "B"}</figcaption> : null}
                </figure>
              ))}
            </div>

            <aside className="share-side">
              {views.map((v) => {
                const items = resolveItems(design, v, products);
                const regions = resolveRegions(design, v, stones);
                const total = totalEstimate(
                  regions.map((r) => r.region),
                  stones,
                );
                return (
                  <section key={v} className="share-option">
                    <h2>{views.length > 1 ? `Option ${v === 0 ? "A" : "B"}` : "In this design"}</h2>
                    <ul className="share-products">
                      {items.map(({ item, product }) => (
                        <li key={item.id}>
                          <strong>{product.name}</strong>
                          {/* Only a real product's size — a placeholder's would read like a spec. */}
                          {pct && product.widthIn && !product.isPlaceholder ? (
                            <span>{(item.widthPct / pct).toFixed(0)}&Prime; wide in the room</span>
                          ) : null}
                        </li>
                      ))}
                      {regions.map(({ region, stone }) => {
                        const e = estimateRegion(region, stone);
                        return (
                          <li key={region.id}>
                            <strong>
                              {stone.brandName ? `${stone.brandName} ` : ""}
                              {stone.texture}
                            </strong>
                            <span>
                              {(region.realWidthIn / 12).toFixed(1)}′ × {(region.realHeightIn / 12).toFixed(1)}′
                              {" · "}
                              {e.netSqft.toFixed(0)} sq ft
                            </span>
                          </li>
                        );
                      })}
                      {design.regions
                        .filter((r) => !regions.some((shown) => shown.region.id === r.id))
                        .map((r) => (
                          <li key={r.id}>
                            {regionStoneId(design, r, v) === null ? (
                              <>
                                <strong>Bare wall</strong>
                                <span>No stone in this option</span>
                              </>
                            ) : (
                              <>
                                <strong>Stone no longer listed</strong>
                                <span>Ask us about this one</span>
                              </>
                            )}
                          </li>
                        ))}
                    </ul>
                    {regions.length > 0 ? (
                      <p>
                        <strong>{total.netSqft.toFixed(0)} sq ft</strong> of stone
                        {total.cornerLnft > 0.05 ? (
                          <>
                            , plus <strong>{total.cornerLnft.toFixed(0)} lin ft</strong> of outside corners
                          </>
                        ) : null}
                        .
                      </p>
                    ) : null}
                  </section>
                );
              })}

              {design.regions.length > 0 ? (
                <p className="share-note">
                  {design.regions.every((r) => r.measured)
                    ? "Stone quantities are worked out from the measurements entered"
                    : design.pctPerInch
                      ? "Stone quantities are worked out from sizes read off the photo, not measured"
                      : "Stone sizes here are rough guesses from the photo, not measurements"}{" "}
                  — we&rsquo;ll confirm before ordering.
                </p>
              ) : null}

              <p>
                Want to see it in person? We&rsquo;re at {business.street}, {business.city}.
              </p>
              <Link className="btn" href="/contact-us/">
                Get in touch
              </Link>
              <p className="share-cta">
                <Link href="/visualizer/">Try a stove and stone in your own room →</Link>
              </p>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
