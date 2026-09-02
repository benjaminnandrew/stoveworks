import type { Metadata } from "next";
import Link from "next/link";

import { requireStaff } from "@/lib/auth";
import { listStoneProducts, stoneCounts } from "@/lib/stone";

export const metadata: Metadata = { title: "Stone catalogue", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminStonePage() {
  await requireStaff();
  const [stones, counts] = await Promise.all([
    listStoneProducts({ includeInactive: true }),
    stoneCounts(),
  ]);

  const missing = stones.filter((s) => !s.swatch_path).length;

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Stone catalogue</h1>
          <p className="page-lede">
            What the veneer mock-up tool offers. A profile needs a seamlessly tiling swatch image
            and the real area that image covers before it looks right on a wall.{" "}
            <Link href="/admin">Hearth inventory →</Link>
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <p className="notice">
            <strong>This list is a starting point, not the full catalogue.</strong> Cultured Stone
            publishes 21+ textures and 100+ colours; only the profile families are seeded here, with
            no colour variants and with typical rather than published coverage figures. Confirm
            everything against the current Cultured Stone catalogue and coverage chart.
          </p>

          <div className="admin-stats">
            {counts.map((c) => (
              <div key={c.texture} className="admin-stat">
                <strong>
                  {c.ready}/{c.n}
                </strong>
                <span>{c.texture}</span>
              </div>
            ))}
          </div>

          {missing > 0 ? (
            <p className="notice">
              <strong>{missing} profiles still need a swatch image.</strong> Until then the tool
              shows a generic stone texture, labelled as a sample.
            </p>
          ) : null}

          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Profile</th>
                <th scope="col">Colour</th>
                <th scope="col">Tile covers</th>
                <th scope="col">Swatch</th>
                <th scope="col">Live</th>
              </tr>
            </thead>
            <tbody>
              {stones.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/stone/${s.id}`}>{s.texture}</Link>
                  </td>
                  <td>{s.color ?? <span className="muted">—</span>}</td>
                  <td>
                    {Number(s.swatch_width_in)}″ × {Number(s.swatch_height_in)}″
                  </td>
                  <td>
                    {s.swatch_path ? (
                      <span className="pill pill-ok">Yes</span>
                    ) : (
                      <span className="pill">Needed</span>
                    )}
                  </td>
                  <td>{s.is_active ? "Yes" : <span className="muted">Hidden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
