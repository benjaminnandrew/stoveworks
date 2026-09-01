import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listDesigns } from "@/lib/designs";
import { AccountNav } from "./AccountNav";
import { DesignCard } from "./DesignCard";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const designs = await listDesigns(user.id);

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
              <h2>No saved designs yet</h2>
              <p>
                Upload a photo of your room and try a stove, insert or fireplace in it. Save as many
                arrangements as you like, then bring them in and we&rsquo;ll talk through the real
                thing.
              </p>
              <Link className="btn" href="/visualizer">
                Open the visualizer
              </Link>
            </div>
          ) : (
            <>
              <div className="section-head">
                <h2>Saved designs</h2>
                <Link className="btn" href="/visualizer">
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
