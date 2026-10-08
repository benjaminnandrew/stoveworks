import type { Metadata } from "next";
import Link from "next/link";

import { VeneerStudio } from "@/components/veneer/VeneerStudio";
import { currentUser } from "@/lib/auth";
import { listSwatches } from "@/lib/stone";

export const metadata: Metadata = {
  title: "Stone Veneer Mock-up",
  description:
    "See Cultured Stone veneer on your own wall. Mark out the area, pick a profile, and get a square-footage estimate for the job.",
  alternates: { canonical: "/veneer/" },
};

export const dynamic = "force-dynamic";

export default async function VeneerPage() {
  const [user, stones] = await Promise.all([currentUser(), listSwatches()]);
  const anyRealSwatches = stones.some((s) => !s.isPlaceholder);

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Stone Veneer Mock-up</h1>
          <p className="page-lede">
            Photograph the wall or fireplace, drag the corners onto it, and try Cultured Stone
            profiles on for size. Tell us how big the area really is and we&rsquo;ll work out the
            square footage as you go.
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {stones.length === 0 ? (
            <p className="notice">
              <strong>No stone profiles yet.</strong> Ask us to add them, or{" "}
              <Link href="/stonework-mantels/">see the stonework we carry</Link>.
            </p>
          ) : !anyRealSwatches ? (
            <p className="notice">
              <strong>These are sample textures, not the real stone.</strong> The profiles listed
              are the Cultured Stone lines we carry, shown for now with generic stone images at
              the correct scale so you can judge proportion and layout. Come in and see the actual
              sample boards, or <Link href="/contact-us/">give us a call</Link>.
            </p>
          ) : null}

          <VeneerStudio stones={stones} isSignedIn={Boolean(user)} />
        </div>
      </div>
    </>
  );
}
