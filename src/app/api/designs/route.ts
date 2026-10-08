import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createDesign, getRoomPhoto, readSaveBody } from "@/lib/designs";

// 60 each for the two tools before they merged; one design now holds both.
const DESIGN_LIMIT = 120;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const parsed = readSaveBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The photo must belong to whoever is saving.
  const photo = await getRoomPhoto(parsed.roomPhotoId);
  if (!photo || photo.user_id !== user.id) {
    return NextResponse.json({ error: "That room photo isn't yours." }, { status: 403 });
  }

  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM designs WHERE user_id = $1`,
    [user.id],
  );
  if ((rows[0]?.n ?? 0) >= DESIGN_LIMIT) {
    return NextResponse.json(
      { error: `You've reached the limit of ${DESIGN_LIMIT} saved designs.` },
      { status: 409 },
    );
  }

  const design = await createDesign({
    userId: user.id,
    roomPhotoId: parsed.roomPhotoId,
    title: parsed.title,
    design: parsed.design,
  });

  return NextResponse.json({ id: design.id }, { status: 201 });
}
