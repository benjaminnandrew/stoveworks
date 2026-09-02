import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRoomPhoto } from "@/lib/designs";
import { createVeneerDesign } from "@/lib/veneer";
import { parseRegions } from "@/lib/veneer-types";

const DESIGN_LIMIT = 60;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.roomPhotoId !== "string") {
    return NextResponse.json({ error: "Missing the room photo." }, { status: 400 });
  }

  const photo = await getRoomPhoto(body.roomPhotoId);
  if (!photo || photo.user_id !== user.id) {
    return NextResponse.json({ error: "That room photo isn't yours." }, { status: 403 });
  }

  const regions = parseRegions(body.regions);
  if (regions.length === 0) {
    return NextResponse.json({ error: "Mark at least one area before saving." }, { status: 400 });
  }

  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM veneer_designs WHERE user_id = $1`,
    [user.id],
  );
  if ((rows[0]?.n ?? 0) >= DESIGN_LIMIT) {
    return NextResponse.json(
      { error: `You've reached the limit of ${DESIGN_LIMIT} saved mock-ups.` },
      { status: 409 },
    );
  }

  const design = await createVeneerDesign({
    userId: user.id,
    roomPhotoId: body.roomPhotoId,
    title: typeof body.title === "string" ? body.title : "Untitled mock-up",
    regions,
  });

  return NextResponse.json({ id: design.id }, { status: 201 });
}
