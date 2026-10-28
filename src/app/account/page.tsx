import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listDesigns } from "@/lib/designs";
import { listVeneerDesigns } from "@/lib/veneer";
import { AccountNav } from "./AccountNav";
import { DesignCard, type CardDesign } from "./DesignCard";

export const metadata: Metadata = {
  title: "My designs",
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
          <h1>{user.name ? `Welcome back, ${user.name.split(" ")[0]}` : "My designs"}</h1>
          <AccountNav />
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {nothingYet ? (
            <div className="empty-state">
              <h2>Nothing saved here</h2>
              <p>
                Try stone on your own wall in Hearth Studio. The ideas you save there stay on this
                device; download or share a picture to bring in, and we&rsquo;ll talk through the
                real thing.
              </p>
              <div className="empty-actions">
                <Link className="btn" href="/hearth-studio/">
                  Open Hearth Studio
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* The room visualizer is retired for now (28 Oct 2026); designs saved in it still
                  list here and open. */}
              {stoves.length > 0 ? (
                <section>
                  <div className="section-head">
                    <h2>Stove &amp; fireplace designs</h2>
                  </div>
                  <p className="viz-hint">Saved in our room visualizer, which is retired for now.</p>
                  <ul className="design-grid">
                    {stoves.map((design) => (
                      <li key={design.id}>
                        <DesignCard design={design} kind="stove" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* The old stone mock-up studio is retired (Hearth Studio replaced it, 28 Oct 2026);
                  mock-ups saved in it still list here and open. */}
              {veneers.length > 0 ? (
                <section className={stoves.length > 0 ? "account-section" : undefined}>
                  <div className="section-head">
                    <h2>Stone mock-ups</h2>
                    <Link className="btn" href="/hearth-studio/">
                      Open Hearth Studio
                    </Link>
                  </div>
                  <p className="viz-hint">
                    Saved in our old stone mock-up studio. New stone ideas are made in Hearth Studio.
                  </p>
                  <ul className="design-grid">
                    {veneers.map((design) => (
                      <li key={design.id}>
                        <DesignCard design={design} kind="veneer" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
