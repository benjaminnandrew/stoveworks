import type { Metadata } from "next";
import Link from "next/link";

import { LINEUP_GROUPS } from "@/content/lineup";
import { brandBySlug } from "@/content/brands";
import { requireStaff } from "@/lib/auth";
import { CARRY_LABEL, CARRY_STATUSES, listCatalogModels, type CarryStatus } from "@/lib/catalog";
import { setCarryAction } from "../actions";

export const metadata: Metadata = { title: "What we carry", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE_LABEL = new Map(LINEUP_GROUPS.map((g) => [`${g.form}/${g.fuel}`, g.label.replace(/s$/, "")]));

const AVAILABILITY_NOTE: Record<string, string> = {
  temporarily_unavailable: "Temporarily unavailable",
  temporarily_unavailable_us: "Temporarily unavailable in the US",
  discontinued: "Discontinued by the maker",
  unclear: "US availability unclear",
};

export default async function CarryPage() {
  await requireStaff();
  const models = await listCatalogModels();

  const byBrand = new Map<string, typeof models>();
  for (const m of models) byBrand.set(m.brand_slug, [...(byBrand.get(m.brand_slug) ?? []), m]);
  const tally = Object.fromEntries(CARRY_STATUSES.map((s) => [s, models.filter((m) => m.carry_status === s).length]));

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>What we carry</h1>
          <p className="page-lede">
            Mark each model in the makers&rsquo; lineups. &ldquo;On our showroom floor&rdquo; and &ldquo;We carry
            it&rdquo; show as badges on the brand pages and list those models first. &ldquo;Not carried&rdquo;
            takes a model off the site. Unmarked models show as part of the maker&rsquo;s lineup.
          </p>
          <p className="admin-crosslinks">
            <Link href="/admin/">&larr; Inventory</Link>
            <Link href="/brands/">See the brand pages &rarr;</Link>
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <div className="admin-stats">
            {CARRY_STATUSES.map((s) => (
              <div key={s} className="admin-stat">
                <strong>{tally[s]}</strong>
                <span>{CARRY_LABEL[s]}</span>
              </div>
            ))}
          </div>

          {[...byBrand].map(([slug, list]) => (
            <section key={slug} className="carry-brand" aria-labelledby={`b-${slug}`}>
              <h2 id={`b-${slug}`}>
                {brandBySlug(slug)?.name ?? list[0].brand_name} <small>{list.length} models</small>
              </h2>
              <table className="admin-table carry-table">
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Type</th>
                    <th scope="col">Carry</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className={`is-${m.carry_status}`}>
                      <td>
                        <strong>{m.name}</strong>
                        {m.lineup_status !== "current" || m.us_availability !== "available" ? (
                          <small className="carry-note">
                            {AVAILABILITY_NOTE[m.us_availability ?? ""] ??
                              (m.lineup_status === "discontinued" ? "Discontinued by the maker" : "Lineup status unclear")}
                          </small>
                        ) : null}
                      </td>
                      <td>{TYPE_LABEL.get(`${m.form}/${m.fuel}`) ?? m.form}</td>
                      <td>
                        <form action={setCarryAction} className="carry-buttons">
                          <input type="hidden" name="id" value={m.id} />
                          {(["on_floor", "carried", "not_carried", "unconfirmed"] as CarryStatus[]).map((s) => (
                            <button
                              key={s}
                              type="submit"
                              name="status"
                              value={s}
                              className={`tool${m.carry_status === s ? " is-on" : ""}`}
                              aria-pressed={m.carry_status === s}
                            >
                              {s !== "unconfirmed" ? CARRY_LABEL[s] : m.carry_status === "unconfirmed" ? "Not marked" : "Clear"}
                            </button>
                          ))}
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
