import type { Metadata } from "next";

import { SavedList } from "@/components/SavedList";

// Each visitor's own list, kept in their browser.
export const metadata: Metadata = {
  title: "Saved Models",
  robots: { index: false, follow: true },
  alternates: { canonical: "/saved/" },
};

export default function SavedPage() {
  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Saved</h1>
          <p className="page-lede">The models you&rsquo;ve saved, kept in this browser. No email needed.</p>
        </div>
      </div>
      <div className="page-body">
        <div className="wrap">
          <SavedList />
        </div>
      </div>
    </>
  );
}
