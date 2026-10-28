import type { Metadata } from "next";
import Link from "next/link";

import { CompareView } from "@/components/CompareView";
import { COMPARE_ROWS, loadComparison } from "@/lib/compare";

type Props = { searchParams: Promise<{ ids?: string }> };

export const dynamic = "force-dynamic";

// A visitor's own picks: nothing here for a search engine.
export const metadata: Metadata = {
  title: "Compare Models",
  robots: { index: false, follow: true },
  alternates: { canonical: "/compare/" },
};

/** Up to five models side by side (Ben, 22 Oct 2026), from ?ids=a,b,c. */
export default async function ComparePage({ searchParams }: Props) {
  const { ids = "" } = await searchParams;
  const wanted = [...new Set(ids.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 5);
  const columns = wanted.length ? await loadComparison(wanted) : [];

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Compare</h1>
          <p className="page-lede">
            {columns.length > 1
              ? `${columns.length} models side by side, with the makers’ own figures.`
              : "Pick Compare on up to five models, then see them side by side here."}
          </p>
        </div>
      </div>
      <div className="page-body">
        <div className="wrap">
          {columns.length ? (
            <CompareView columns={columns} rows={COMPARE_ROWS} />
          ) : (
            <p className="notice">
              <strong>Nothing to compare yet.</strong> Tick <em>Compare</em> on any model (on the{" "}
              <Link href="/stoves/">stove</Link>, <Link href="/inserts/">insert</Link> or{" "}
              <Link href="/fireplaces/">fireplace</Link> pages, or a <Link href="/brands/">brand&rsquo;s</Link> page) and
              the tray at the bottom of the screen brings you back here.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
