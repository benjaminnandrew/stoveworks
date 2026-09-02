"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser, signOut } from "@/lib/auth";
import { query } from "@/lib/db";
import { deleteDesign, ensureShareSlug, revokeShareSlug } from "@/lib/designs";
import {
  deleteVeneerDesign,
  ensureVeneerShareSlug,
  revokeVeneerShareSlug,
} from "@/lib/veneer";

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function updateProfileAction(_prev: { ok?: boolean; error?: string }, formData: FormData) {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);

  if (name.length === 0) return { error: "Please tell us your name." };

  await query(`UPDATE users SET name = $2, phone = $3 WHERE id = $1`, [
    user.id,
    name,
    phone || null,
  ]);

  revalidatePath("/account");
  return { ok: true };
}

/** Both tools save into their own table; the kind says which one to reach for. */
const isVeneer = (formData: FormData) => formData.get("kind") === "veneer";

export async function deleteDesignAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (isVeneer(formData)) await deleteVeneerDesign(id, user.id);
  else await deleteDesign(id, user.id);
  revalidatePath("/account");
}

export async function toggleShareAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const isShared = formData.get("shared") === "true";

  if (isVeneer(formData)) {
    if (isShared) await revokeVeneerShareSlug(id, user.id);
    else await ensureVeneerShareSlug(id, user.id);
  } else if (isShared) {
    await revokeShareSlug(id, user.id);
  } else {
    await ensureShareSlug(id, user.id);
  }

  revalidatePath("/account");
}
