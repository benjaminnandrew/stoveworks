"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { query } from "@/lib/db";
import { storeProductCutout, storeStoneSwatch } from "@/lib/storage";

export type AdminState = { ok?: boolean; error?: string };

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function saveProductAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "A product needs a name." };

  const cutout = formData.get("cutout");
  let cutoutPath: string | null = null;

  if (cutout instanceof File && cutout.size > 0) {
    if (!cutout.type.startsWith("image/")) return { error: "The cutout must be an image." };
    if (cutout.size > 8 * 1024 * 1024) return { error: "Keep the cutout under 8 MB." };
    try {
      const slug = String(formData.get("slug") ?? "product");
      cutoutPath = await storeProductCutout(slug, cutout);
    } catch {
      return { error: "We couldn't process that image. A transparent PNG works best." };
    }
  }

  await query(
    `UPDATE products
        SET name = $2,
            summary = $3,
            width_in = $4,
            height_in = $5,
            depth_in = $6,
            product_url = $7,
            is_active = $8,
            cutout_path = COALESCE($9, cutout_path),
            updated_at = now()
      WHERE id = $1`,
    [
      id,
      name.slice(0, 200),
      String(formData.get("summary") ?? "").trim().slice(0, 1200) || null,
      num(formData.get("width_in")),
      num(formData.get("height_in")),
      num(formData.get("depth_in")),
      String(formData.get("product_url") ?? "").trim().slice(0, 500) || null,
      formData.get("is_active") === "on",
      cutoutPath,
    ],
  );

  revalidatePath("/admin");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/visualizer");
  return { ok: true };
}

export async function clearCutoutAction(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  await query(`UPDATE products SET cutout_path = NULL, updated_at = now() WHERE id = $1`, [id]);
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin");
}

export async function saveStoneAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const texture = String(formData.get("texture") ?? "").trim();
  if (!texture) return { error: "A profile needs a texture name." };

  const swatch = formData.get("swatch");
  let swatchPath: string | null = null;

  if (swatch instanceof File && swatch.size > 0) {
    if (!swatch.type.startsWith("image/")) return { error: "The swatch must be an image." };
    if (swatch.size > 8 * 1024 * 1024) return { error: "Keep the swatch under 8 MB." };
    try {
      swatchPath = await storeStoneSwatch(String(formData.get("slug") ?? "stone"), swatch);
    } catch {
      return { error: "We couldn't process that image. A seamlessly tiling JPEG or PNG works best." };
    }
  }

  const color = String(formData.get("color") ?? "").trim();

  await query(
    `UPDATE stone_products
        SET texture = $2,
            color = $3,
            name = $4,
            summary = $5,
            swatch_width_in = $6,
            swatch_height_in = $7,
            flat_sqft_per_box = $8,
            corner_lnft_per_box = $9,
            product_url = $10,
            is_active = $11,
            swatch_path = COALESCE($12, swatch_path),
            updated_at = now()
      WHERE id = $1`,
    [
      id,
      texture.slice(0, 120),
      color.slice(0, 120) || null,
      String(formData.get("name") ?? texture).trim().slice(0, 200),
      String(formData.get("summary") ?? "").trim().slice(0, 1200) || null,
      num(formData.get("swatch_width_in")) ?? 24,
      num(formData.get("swatch_height_in")) ?? 16,
      num(formData.get("flat_sqft_per_box")),
      num(formData.get("corner_lnft_per_box")),
      String(formData.get("product_url") ?? "").trim().slice(0, 500) || null,
      formData.get("is_active") === "on",
      swatchPath,
    ],
  );

  revalidatePath("/admin/stone");
  revalidatePath(`/admin/stone/${id}`);
  revalidatePath("/veneer");
  return { ok: true };
}

export async function clearSwatchAction(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  await query(`UPDATE stone_products SET swatch_path = NULL, updated_at = now() WHERE id = $1`, [id]);
  revalidatePath(`/admin/stone/${id}`);
  revalidatePath("/admin/stone");
}
