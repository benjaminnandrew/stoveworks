import "server-only";

import { randomBytes } from "node:crypto";

import { query, queryOne } from "./db";
import { parseDesignState, type DesignState } from "./design-types";

export type DesignRow = {
  id: string;
  user_id: string;
  room_photo_id: string;
  title: string;
  items: unknown;
  regions: unknown;
  occluders: unknown;
  compare: unknown;
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
  region_count: number;
  is_compare: boolean;
  updated_at: Date;
  share_slug: string | null;
};

/** A stored row as the editor and the share page use it, validated on the way out. */
export function designStateOf(row: DesignRow): DesignState {
  return parseDesignState({
    items: row.items,
    regions: row.regions,
    occluders: row.occluders,
    compare: row.compare,
    pctPerInch: row.pct_per_inch,
  });
}

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
            jsonb_array_length(items) AS item_count,
            jsonb_array_length(regions) AS region_count,
            compare IS NOT NULL AS is_compare
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
  /** Already validated with parseDesignState. */
  design: DesignState;
};

const designParams = (d: DesignState) => [
  JSON.stringify(d.items),
  JSON.stringify(d.regions),
  JSON.stringify(d.occluders),
  d.compare ? JSON.stringify(d.compare) : null,
  d.pctPerInch,
];

export async function createDesign(input: SaveInput): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO designs (user_id, room_photo_id, title, items, regions, occluders, compare, pct_per_inch)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
     RETURNING id`,
    [input.userId, input.roomPhotoId, input.title.slice(0, 80), ...designParams(input.design)],
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
        SET title = $3, items = $4::jsonb, regions = $5::jsonb, occluders = $6::jsonb,
            compare = $7::jsonb, pct_per_inch = $8, room_photo_id = $9, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [id, input.userId, input.title.slice(0, 80), ...designParams(input.design), input.roomPhotoId],
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

/**
 * Checks what the editor sent before it is saved. Products and stone are both
 * optional, but a design needs at least one of them — an empty room isn't a
 * design.
 */
export function readSaveBody(
  body: unknown,
): { ok: true; roomPhotoId: string; title: string; design: DesignState } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Missing the design." };
  const b = body as Record<string, unknown>;
  if (typeof b.roomPhotoId !== "string") return { ok: false, error: "Missing the room photo." };

  const design = parseDesignState(b);
  if (design.items.length === 0 && design.regions.length === 0) {
    return { ok: false, error: "Add a stove or some stone before saving." };
  }

  return {
    ok: true,
    roomPhotoId: b.roomPhotoId,
    title: typeof b.title === "string" && b.title.trim() ? b.title : "Untitled design",
    design,
  };
}
