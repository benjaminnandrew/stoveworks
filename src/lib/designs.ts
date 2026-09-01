import "server-only";

import { randomBytes } from "node:crypto";

import { query, queryOne } from "./db";
import { parseItems, type PlacedItem } from "./design-types";

export type DesignRow = {
  id: string;
  user_id: string;
  room_photo_id: string;
  title: string;
  items: unknown;
  pct_per_inch: string | null;
  share_slug: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DesignSummary = {
  id: string;
  title: string;
  room_photo_id: string;
  item_count: number;
  updated_at: Date;
  share_slug: string | null;
};

export type RoomPhotoRow = {
  id: string;
  user_id: string;
  storage_key: string;
  mime: string;
  width: number;
  height: number;
};

export function getRoomPhoto(id: string): Promise<RoomPhotoRow | null> {
  return queryOne<RoomPhotoRow>(`SELECT * FROM room_photos WHERE id = $1`, [id]);
}

export async function listDesigns(userId: string): Promise<DesignSummary[]> {
  const { rows } = await query<DesignSummary>(
    `SELECT id, title, room_photo_id, share_slug, updated_at,
            jsonb_array_length(items) AS item_count
       FROM designs WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  return rows;
}

export function getDesign(id: string): Promise<DesignRow | null> {
  return queryOne<DesignRow>(`SELECT * FROM designs WHERE id = $1`, [id]);
}

export function getDesignByShareSlug(slug: string): Promise<DesignRow | null> {
  return queryOne<DesignRow>(`SELECT * FROM designs WHERE share_slug = $1`, [slug]);
}

type SaveInput = {
  userId: string;
  roomPhotoId: string;
  title: string;
  items: PlacedItem[];
  pctPerInch: number | null;
};

export async function createDesign(input: SaveInput): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO designs (user_id, room_photo_id, title, items, pct_per_inch)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [
      input.userId,
      input.roomPhotoId,
      input.title.slice(0, 80),
      JSON.stringify(parseItems(input.items)),
      input.pctPerInch,
    ],
  );
  return row!;
}

/** Scoped by user_id, so one customer can never overwrite another's design. */
export async function updateDesign(
  id: string,
  input: SaveInput,
): Promise<{ id: string } | null> {
  return queryOne<{ id: string }>(
    `UPDATE designs
        SET title = $3, items = $4::jsonb, pct_per_inch = $5,
            room_photo_id = $6, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [
      id,
      input.userId,
      input.title.slice(0, 80),
      JSON.stringify(parseItems(input.items)),
      input.pctPerInch,
      input.roomPhotoId,
    ],
  );
}

export async function deleteDesign(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM designs WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
  return rowCount > 0;
}

/** Mints a share slug on first use; returns the existing one afterwards. */
export async function ensureShareSlug(id: string, userId: string): Promise<string | null> {
  const existing = await queryOne<{ share_slug: string | null }>(
    `SELECT share_slug FROM designs WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!existing) return null;
  if (existing.share_slug) return existing.share_slug;

  const slug = randomBytes(12).toString("base64url");
  await query(`UPDATE designs SET share_slug = $3 WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
    slug,
  ]);
  return slug;
}

export async function revokeShareSlug(id: string, userId: string): Promise<void> {
  await query(`UPDATE designs SET share_slug = NULL WHERE id = $1 AND user_id = $2`, [id, userId]);
}
