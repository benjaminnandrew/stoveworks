import type { Metadata } from "next";
import Link from "next/link";

import { requireStaff } from "@/lib/auth";
import { catalogCounts, listProducts } from "@/lib/products";
import { CATEGORY_LABEL, FUEL_LABEL } from "@/lib/design-types";

export const metadata: Metadata = { title: "Inventory", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireStaff();
  const [products, counts] = await Promise.all([
    listProducts({ includeInactive: true }),
    catalogCounts(),
  ]);

  const missing = products.filter((p) => !p.cutout_path).length;

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Inventory</h1>
          <p className="page-lede">
            What the visualizer offers customers. A product needs a transparent cutout image and a
            real width before it can be placed to scale.
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <div className="admin-stats">
            {counts.map((c) => (
              <div key={c.category} className="admin-stat">
                <strong>{c.placeable}/{c.n}</strong>
                <span>{CATEGORY_LABEL[c.category]} ready</span>
              </div>
            ))}
          </div>

          {missing > 0 ? (
            <p className="notice">
              <strong>{missing} products still need a cutout image.</strong> Until then the
              visualizer shows a category silhouette in their place.
            </p>
          ) : null}

          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Type</th>
                <th scope="col">Width</th>
                <th scope="col">Cutout</th>
                <th scope="col">Live</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>
                    {FUEL_LABEL[p.fuel]} {CATEGORY_LABEL[p.category].toLowerCase()}
                  </td>
                  <td>{p.width_in ? `${Number(p.width_in)}″` : <span className="muted">—</span>}</td>
                  <td>
                    {p.cutout_path ? (
                      <span className="pill pill-ok">Yes</span>
                    ) : (
                      <span className="pill">Needed</span>
                    )}
                  </td>
                  <td>{p.is_active ? "Yes" : <span className="muted">Hidden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
