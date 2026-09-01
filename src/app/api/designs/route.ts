import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { parseItems } from "@/lib/design-types";
import { createDesign, getRoomPhoto } from "@/lib/designs";

const DESIGN_LIMIT = 60;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.roomPhotoId !== "string") {
    return NextResponse.json({ error: "Missing the room photo." }, { status: 400 });
  }

  // The photo must belong to whoever is saving.
  const photo = await getRoomPhoto(body.roomPhotoId);
  if (!photo || photo.user_id !== user.id) {
    return NextResponse.json({ error: "That room photo isn't yours." }, { status: 403 });
  }

  const items = parseItems(body.items);
  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one product before saving." }, { status: 400 });
  }

  const { rows } = await import("@/lib/db").then(({ query }) =>
    query<{ n: number }>(`SELECT count(*)::int AS n FROM designs WHERE user_id = $1`, [user.id]),
  );
  if ((rows[0]?.n ?? 0) >= DESIGN_LIMIT) {
    return NextResponse.json(
      { error: `You've reached the limit of ${DESIGN_LIMIT} saved designs.` },
      { status: 409 },
    );
  }

  const design = await createDesign({
    userId: user.id,
    roomPhotoId: body.roomPhotoId,
    title: typeof body.title === "string" ? body.title : "Untitled design",
    items,
    pctPerInch: typeof body.pctPerInch === "number" ? body.pctPerInch : null,
  });

  return NextResponse.json({ id: design.id }, { status: 201 });
}
