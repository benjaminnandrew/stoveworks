import type { Metadata } from "next";
import Link from "next/link";

import { RoomStudio } from "@/components/studio/RoomStudio";
import { currentUser } from "@/lib/auth";
import { listPlaceableProducts } from "@/lib/placeable";
import { listSwatches } from "@/lib/stone";

export const metadata: Metadata = {
  title: "Room Studio — Stove & Stone Visualizer",
  description:
    "See a stove, insert or fireplace and a stone wall together in a photo of your own room. Set it to true scale, compare two options side by side, and get a square-footage estimate for the stone.",
  alternates: { canonical: "/visualizer/" },
};

export const dynamic = "force-dynamic";

export default async function VisualizerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, products, stones, params] = await Promise.all([
    currentUser(),
    listPlaceableProducts(),
    listSwatches(),
    searchParams,
  ]);
  // Say plainly what isn't real yet, and only what isn't.
  const caveats = [
    products.some((p) => !p.isPlaceholder) ? null : "stoves show as placeholder shapes at their true size",
    stones.some((s) => s.isPlaceholder)
      ? "stone marked “sample image” is a generic texture at the right scale"
      : null,
  ].filter(Boolean);
  const caveat = caveats.join(", and ");

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Room Studio</h1>
          <p className="page-lede">
            Bring the whole hearth together — your room, your stove, your stone. Try it on our sample
            cabin, then upload a photo of your own room.
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {caveat ? (
            <p className="notice studio-notice">
              <strong>Photography is on the way:</strong> {caveat}.{" "}
              <Link href="/contact-us/">Ask us</Link> about the real thing.
            </p>
          ) : null}

          <RoomStudio
            products={products}
            stones={stones}
            isSignedIn={Boolean(user)}
            initialLayer={params.layer === "stone" ? "stone" : "stove"}
            resumeId={typeof params.resume === "string" ? params.resume.slice(0, 64) : null}
          />
        </div>
      </div>
    </>
  );
}
