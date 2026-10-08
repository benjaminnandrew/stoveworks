import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { deleteDesign, getRoomPhoto, readSaveBody, updateDesign } from "@/lib/designs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { id } = await params;
  const parsed = readSaveBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const photo = await getRoomPhoto(parsed.roomPhotoId);
  if (!photo || photo.user_id !== user.id) {
    return NextResponse.json({ error: "That room photo isn't yours." }, { status: 403 });
  }

  const updated = await updateDesign(id, {
    userId: user.id,
    roomPhotoId: parsed.roomPhotoId,
    title: parsed.title,
    design: parsed.design,
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
