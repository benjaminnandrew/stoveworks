import "server-only";

import { randomBytes } from "node:crypto";

import { query, queryOne } from "./db";
import { parseRegions, type Region } from "./veneer-types";

export type VeneerDesignRow = {
  id: string;
  user_id: string;
  room_photo_id: string;
  title: string;
  regions: unknown;
  share_slug: string | null;
  created_at: Date;
  updated_at: Date;
};

export type VeneerSummary = {
  id: string;
  title: string;
  room_photo_id: string;
  region_count: number;
  updated_at: Date;
  share_slug: string | null;
};

export async function listVeneerDesigns(userId: string): Promise<VeneerSummary[]> {
  const { rows } = await query<VeneerSummary>(
    `SELECT id, title, room_photo_id, share_slug, updated_at,
            jsonb_array_length(regions) AS region_count
       FROM veneer_designs WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  return rows;
}

export function getVeneerDesign(id: string): Promise<VeneerDesignRow | null> {
  return queryOne<VeneerDesignRow>(`SELECT * FROM veneer_designs WHERE id = $1`, [id]);
}

export function getVeneerDesignByShareSlug(slug: string): Promise<VeneerDesignRow | null> {
  return queryOne<VeneerDesignRow>(`SELECT * FROM veneer_designs WHERE share_slug = $1`, [slug]);
}

type SaveInput = {
  userId: string;
  roomPhotoId: string;
  title: string;
  regions: Region[];
};

export async function createVeneerDesign(input: SaveInput): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO veneer_designs (user_id, room_photo_id, title, regions)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [input.userId, input.roomPhotoId, input.title.slice(0, 80), JSON.stringify(parseRegions(input.regions))],
  );
  return row!;
}

/** Scoped by user_id so one customer can never overwrite another's mock-up. */
export function updateVeneerDesign(id: string, input: SaveInput): Promise<{ id: string } | null> {
  return queryOne<{ id: string }>(
    `UPDATE veneer_designs
        SET title = $3, regions = $4::jsonb, room_photo_id = $5, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [
      id,
      input.userId,
      input.title.slice(0, 80),
      JSON.stringify(parseRegions(input.regions)),
      input.roomPhotoId,
    ],
  );
}

export async function deleteVeneerDesign(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM veneer_designs WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
  return rowCount > 0;
}

export async function ensureVeneerShareSlug(id: string, userId: string): Promise<string | null> {
  const existing = await queryOne<{ share_slug: string | null }>(
    `SELECT share_slug FROM veneer_designs WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!existing) return null;
  if (existing.share_slug) return existing.share_slug;

  const slug = randomBytes(12).toString("base64url");
  await query(`UPDATE veneer_designs SET share_slug = $3 WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
    slug,
  ]);
  return slug;
}

export async function revokeVeneerShareSlug(id: string, userId: string): Promise<void> {
  await query(`UPDATE veneer_designs SET share_slug = NULL WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
}
