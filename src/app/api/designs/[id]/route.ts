import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { parseItems } from "@/lib/design-types";
import { deleteDesign, getRoomPhoto, updateDesign } from "@/lib/designs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.roomPhotoId !== "string") {
    return NextResponse.json({ error: "Missing the room photo." }, { status: 400 });
  }

  const photo = await getRoomPhoto(body.roomPhotoId);
  if (!photo || photo.user_id !== user.id) {
    return NextResponse.json({ error: "That room photo isn't yours." }, { status: 403 });
  }

  const items = parseItems(body.items);
  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one product before saving." }, { status: 400 });
  }

  const updated = await updateDesign(id, {
    userId: user.id,
    roomPhotoId: body.roomPhotoId,
    title: typeof body.title === "string" ? body.title : "Untitled design",
    items,
    pctPerInch: typeof body.pctPerInch === "number" ? body.pctPerInch : null,
  });

  if (!updated) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { id } = await params;
  const removed = await deleteDesign(id, user.id);
  if (!removed) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
