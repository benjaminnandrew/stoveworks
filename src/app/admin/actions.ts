"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { query } from "@/lib/db";
import { storeProductCutout } from "@/lib/storage";

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
