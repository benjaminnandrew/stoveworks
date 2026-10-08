import type { Metadata } from "next";
import Link from "next/link";

import { Visualizer } from "@/components/visualizer/Visualizer";
import { currentUser } from "@/lib/auth";
import { listPlaceableProducts } from "@/lib/placeable";

export const metadata: Metadata = {
  title: "Room Visualizer",
  description:
    "See how a stove, insert or fireplace will look in your own room. Upload a photo, drop in a model from our lineup, and set it to true scale.",
  alternates: { canonical: "/visualizer/" },
};

export const dynamic = "force-dynamic";

export default async function VisualizerPage() {
  const [user, products] = await Promise.all([currentUser(), listPlaceableProducts()]);
  const anyRealCutouts = products.some((p) => !p.isPlaceholder);

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Room Visualizer</h1>
          <p className="page-lede">
            Upload a photo of your room, drop in a stove, insert or fireplace, and set it to true
            scale. {user ? "Save it to your account" : "Sign in to save your work"} or download the
            image to bring in with you.
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {!anyRealCutouts ? (
            <p className="notice">
              <strong>Product photography is on the way.</strong> The lineup below is our real
              catalog, shown for now with placeholder shapes at each model&rsquo;s true size. Come
              in or <Link href="/contact-us/">give us a call</Link> and we&rsquo;ll walk you through
              the actual units.
            </p>
          ) : null}

          <Visualizer products={products} isSignedIn={Boolean(user)} />
        </div>
      </div>
    </>
  );
}
