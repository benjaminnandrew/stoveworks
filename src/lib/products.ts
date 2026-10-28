import "server-only";

import { query, queryOne } from "./db";

export type Category = "stove" | "insert" | "fireplace" | "hearth";
export type Fuel = "gas" | "wood" | "electric" | "pellet" | "multi";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  fuel: Fuel;
  summary: string | null;
  width_in: string | null;
  height_in: string | null;
  depth_in: string | null;
  cutout_path: string | null;
  product_url: string | null;
  is_active: boolean;
  /** The manufacturer catalog's model this product is (catalog_models.id). */
  catalog_model_id: string | null;
  brand_id: number | null;
  brand_name: string | null;
  brand_slug: string | null;
  brand_logo: string | null;
};

export type Brand = {
  id: number;
  slug: string;
  name: string;
  website_url: string | null;
  logo_path: string | null;
};

const SELECT = `
  SELECT p.id, p.slug, p.name, p.category, p.fuel, p.summary,
         p.width_in, p.height_in, p.depth_in, p.cutout_path, p.product_url,
         p.is_active, p.catalog_model_id, p.brand_id,
         b.name AS brand_name, b.slug AS brand_slug, b.logo_path AS brand_logo
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id`;

export type ProductFilter = {
  category?: Category;
  fuel?: Fuel;
  brand?: string;
  /** Only products with a cutout — the ones the visualizer can actually place. */
  placeableOnly?: boolean;
  includeInactive?: boolean;
};

export async function listProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!filter.includeInactive) where.push("p.is_active");
  if (filter.category) where.push(`p.category = $${params.push(filter.category)}`);
  if (filter.fuel) where.push(`p.fuel = $${params.push(filter.fuel)}`);
  if (filter.brand) where.push(`b.slug = $${params.push(filter.brand)}`);
  if (filter.placeableOnly) where.push("p.cutout_path IS NOT NULL");

  const { rows } = await query<Product>(
    `${SELECT}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY b.name NULLS LAST, p.category, p.sort, p.name`,
    params,
  );
  return rows;
}

export function getProduct(id: string): Promise<Product | null> {
  return queryOne<Product>(`${SELECT} WHERE p.id = $1`, [id]);
}

export async function getProductsByIds(ids: string[]): Promise<Map<string, Product>> {
  if (ids.length === 0) return new Map();
  const { rows } = await query<Product>(`${SELECT} WHERE p.id = ANY($1::uuid[])`, [ids]);
  return new Map(rows.map((p) => [p.id, p]));
}

export async function listBrands(): Promise<Brand[]> {
  const { rows } = await query<Brand>(`SELECT * FROM brands ORDER BY name`);
  return rows;
}

/** Counts for the visualizer's filter chips. */
export async function catalogCounts() {
  const { rows } = await query<{ category: Category; n: number; placeable: number }>(
    `SELECT category,
            count(*)::int AS n,
            count(cutout_path)::int AS placeable
       FROM products WHERE is_active GROUP BY category ORDER BY category`,
  );
  return rows;
}
