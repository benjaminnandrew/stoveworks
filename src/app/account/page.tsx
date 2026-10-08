import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listDesigns } from "@/lib/designs";
import { AccountNav } from "./AccountNav";
import { DesignCard, type CardDesign } from "./DesignCard";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const designs: CardDesign[] = (await listDesigns(user.id)).map((d) => ({
    id: d.id,
    title: d.title,
    room_photo_id: d.room_photo_id,
    share_slug: d.share_slug,
    updated_at: d.updated_at,
    itemCount: d.item_count,
    regionCount: d.region_count,
    isCompare: d.is_compare,
  }));

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
          {designs.length === 0 ? (
            <div className="empty-state">
              <h2>Nothing saved yet</h2>
              <p>
                Upload a photo of your room and try a stove in it, with stone on the wall behind.
                Save as many as you like, then bring them in and we&rsquo;ll talk through the real
                thing.
              </p>
              <div className="empty-actions">
                <Link className="btn" href="/visualizer/">
                  Open Room Studio
                </Link>
              </div>
            </div>
          ) : (
            <section>
              <div className="section-head">
                <h2>Room designs</h2>
                <Link className="btn" href="/visualizer/">
                  New design
                </Link>
              </div>
              <ul className="design-grid">
                {designs.map((design) => (
                  <li key={design.id}>
                    <DesignCard design={design} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
