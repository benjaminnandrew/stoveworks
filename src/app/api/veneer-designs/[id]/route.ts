import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { getRoomPhoto } from "@/lib/designs";
import { deleteVeneerDesign, updateVeneerDesign } from "@/lib/veneer";
import { parseRegions } from "@/lib/veneer-types";

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

  const regions = parseRegions(body.regions);
  if (regions.length === 0) {
    return NextResponse.json({ error: "Mark at least one area before saving." }, { status: 400 });
  }

  const updated = await updateVeneerDesign(id, {
    userId: user.id,
    roomPhotoId: body.roomPhotoId,
    title: typeof body.title === "string" ? body.title : "Untitled mock-up",
    regions,
  });

  if (!updated) return NextResponse.json({ error: "Mock-up not found." }, { status: 404 });
  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { id } = await params;
  const removed = await deleteVeneerDesign(id, user.id);
  if (!removed) return NextResponse.json({ error: "Mock-up not found." }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
