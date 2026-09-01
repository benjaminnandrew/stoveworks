import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, storeRoomPhoto } from "@/lib/storage";

/** How many room photos one account may hold. */
const PHOTO_LIMIT = 40;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo was included." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That photo is larger than 12 MB." }, { status: 413 });
  }
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Please upload a JPEG, PNG, WebP or HEIC image." }, { status: 415 });
  }

  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM room_photos WHERE user_id = $1`,
    [user.id],
  );
  if ((rows[0]?.n ?? 0) >= PHOTO_LIMIT) {
    return NextResponse.json(
      { error: `You've reached the limit of ${PHOTO_LIMIT} saved photos. Delete one to add another.` },
      { status: 409 },
    );
  }

  try {
    const stored = await storeRoomPhoto(user.id, file);

    const inserted = await query<{ id: string }>(
      `INSERT INTO room_photos (user_id, storage_key, original_name, mime, width, height, bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        user.id,
        stored.storageKey,
        file.name?.slice(0, 200) || null,
        stored.mime,
        stored.width,
        stored.height,
        stored.bytes,
      ],
    );

    const id = inserted.rows[0].id;
    return NextResponse.json({
      id,
      url: `/api/photos/${id}`,
      width: stored.width,
      height: stored.height,
    });
  } catch (err) {
    console.error("room photo upload failed:", err);
    return NextResponse.json({ error: "We couldn't process that image." }, { status: 400 });
  }
}
