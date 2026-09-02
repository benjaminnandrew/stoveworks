import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DesignPreview } from "@/components/visualizer/DesignPreview";
import { VeneerPreview } from "@/components/veneer/VeneerPreview";
import { business } from "@/content/site";
import { parseItems } from "@/lib/design-types";
import { getDesignByShareSlug, getRoomPhoto } from "@/lib/designs";
import { toPlaceable } from "@/lib/placeable";
import { getProductsByIds } from "@/lib/products";
import { getSwatchesByIds } from "@/lib/stone";
import { getVeneerDesignByShareSlug } from "@/lib/veneer";
import { estimateRegion, parseRegions, totalEstimate } from "@/lib/veneer-types";

export const metadata: Metadata = {
  title: "Shared design",
  // Share links are unguessable, not secret. Keep them out of search results.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One share URL for both tools. The slug namespaces are separate tables but a
 * single route, so a link a customer has already sent keeps working when the
 * two editors eventually merge.
 */
export default async function SharedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const stoveDesign = await getDesignByShareSlug(slug);
  if (stoveDesign) return <SharedStove slug={slug} design={stoveDesign} />;

  const veneerDesign = await getVeneerDesignByShareSlug(slug);
  if (veneerDesign) return <SharedVeneer slug={slug} design={veneerDesign} />;

  notFound();
}

async function SharedStove({
  slug,
  design,
}: {
  slug: string;
  design: NonNullable<Awaited<ReturnType<typeof getDesignByShareSlug>>>;
}) {
  const items = parseItems(design.items);
  const [photo, productRows] = await Promise.all([
    getRoomPhoto(design.room_photo_id),
    getProductsByIds([...new Set(items.map((i) => i.productId))]),
  ]);
  if (!photo) notFound();

  const products = new Map([...productRows].map(([id, p]) => [id, toPlaceable(p)]));

  return (
    <Shell title={design.title} lede="A room design shared from the Stove Works visualizer.">
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
                  <span>{(item.widthPct / Number(design.pct_per_inch)).toFixed(0)}&Prime; wide</span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Cta />
      </aside>
    </Shell>
  );
}

async function SharedVeneer({
  slug,
  design,
}: {
  slug: string;
  design: NonNullable<Awaited<ReturnType<typeof getVeneerDesignByShareSlug>>>;
}) {
  const regions = parseRegions(design.regions);
  const [photo, stones] = await Promise.all([
    getRoomPhoto(design.room_photo_id),
    getSwatchesByIds([...new Set(regions.map((r) => r.stoneId))]),
  ]);
  if (!photo) notFound();

  const total = totalEstimate(regions, stones);

  return (
    <Shell title={design.title} lede="A stone veneer mock-up shared from the Stove Works studio.">
      <VeneerPreview
        photoUrl={`/api/photos/${photo.id}?share=${encodeURIComponent(slug)}`}
        photoWidth={photo.width}
        photoHeight={photo.height}
        regions={regions}
        stones={stones}
      />

      <aside className="share-side">
        <h2>In this mock-up</h2>
        <ul className="share-products">
          {regions.map((region, i) => {
            const stone = stones.get(region.stoneId);
            const e = estimateRegion(region, stone);
            return (
              <li key={region.id}>
                <strong>{stone?.name ?? `Area ${i + 1}`}</strong>
                <span>
                  {(region.realWidthIn / 12).toFixed(1)}′ × {(region.realHeightIn / 12).toFixed(1)}′
                  {" · "}
                  {e.netSqft.toFixed(0)} sq ft
                </span>
              </li>
            );
          })}
        </ul>

        <p>
          <strong>{total.netSqft.toFixed(0)} sq ft</strong> in total
          {total.cornerLnft > 0.05 ? (
            <>
              , plus <strong>{total.cornerLnft.toFixed(0)} lin ft</strong> of outside corners
            </>
          ) : null}
          . An estimate from the sizes entered — we&rsquo;ll confirm before ordering.
        </p>

        <Cta />
      </aside>
    </Shell>
  );
}

function Shell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{title}</h1>
          <p className="page-lede">{lede}</p>
        </div>
      </div>
      <div className="page-body">
        <div className="wrap">
          <div className="share-layout">{children}</div>
        </div>
      </div>
    </>
  );
}

function Cta() {
  return (
    <>
      <p>
        Want to see it in person? We&rsquo;re at {business.street}, {business.city}.
      </p>
      <Link className="btn" href="/contact-us">
        Get in touch
      </Link>
      <p className="share-cta">
        <Link href="/visualizer">Try a stove in your room →</Link>
        <br />
        <Link href="/veneer">Try stone on your wall →</Link>
      </p>
    </>
  );
}
