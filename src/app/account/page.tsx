import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listDesigns } from "@/lib/designs";
import { listVeneerDesigns } from "@/lib/veneer";
import { AccountNav } from "./AccountNav";
import { DesignCard, type CardDesign } from "./DesignCard";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const [stoveDesigns, veneerDesigns] = await Promise.all([
    listDesigns(user.id),
    listVeneerDesigns(user.id),
  ]);

  const stoves: CardDesign[] = stoveDesigns.map((d) => ({
    id: d.id,
    title: d.title,
    room_photo_id: d.room_photo_id,
    share_slug: d.share_slug,
    updated_at: d.updated_at,
    count: d.item_count,
  }));

  const veneers: CardDesign[] = veneerDesigns.map((d) => ({
    id: d.id,
    title: d.title,
    room_photo_id: d.room_photo_id,
    share_slug: d.share_slug,
    updated_at: d.updated_at,
    count: d.region_count,
  }));

  const nothingYet = stoves.length === 0 && veneers.length === 0;

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{user.name ? `Welcome back, ${user.name.split(" ")[0]}` : "My account"}</h1>
          <AccountNav />
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {nothingYet ? (
            <div className="empty-state">
              <h2>Nothing saved yet</h2>
              <p>
                Upload a photo of your room and try a stove in it, or mark out a wall and see it in
                stone. Save as many as you like, then bring them in and we&rsquo;ll talk through the
                real thing.
              </p>
              <div className="empty-actions">
                <Link className="btn" href="/visualizer/">
                  Try a stove
                </Link>
                <Link className="tool" href="/veneer/">
                  Try stone veneer
                </Link>
              </div>
            </div>
          ) : (
            <>
              {stoves.length > 0 ? (
                <section>
                  <div className="section-head">
                    <h2>Stove &amp; fireplace designs</h2>
                    <Link className="btn" href="/visualizer/">
                      New design
                    </Link>
                  </div>
                  <ul className="design-grid">
                    {stoves.map((design) => (
                      <li key={design.id}>
                        <DesignCard design={design} kind="stove" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className={stoves.length > 0 ? "account-section" : undefined}>
                <div className="section-head">
                  <h2>Stone veneer mock-ups</h2>
                  <Link className="btn" href="/veneer/">
                    New mock-up
                  </Link>
                </div>
                {veneers.length === 0 ? (
                  <p className="viz-hint">
                    None yet — <Link href="/veneer/">try stone on a wall</Link>.
                  </p>
                ) : (
                  <ul className="design-grid">
                    {veneers.map((design) => (
                      <li key={design.id}>
                        <DesignCard design={design} kind="veneer" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
