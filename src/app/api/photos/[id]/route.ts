import { NextResponse, type NextRequest } from "next/server";

import { currentUser, isStaff } from "@/lib/auth";
import { getDesignByShareSlug, getRoomPhoto } from "@/lib/designs";
import { readRoomPhoto } from "@/lib/storage";

/**
 * Serves a customer's room photo.
 *
 * Access is granted to the owner, to Steve's staff (they need to see what a
 * customer is asking about), and to anyone holding the unguessable share slug
 * of a design that uses the photo. Everyone else gets a 404 — not a 403, which
 * would confirm the photo exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });

  const photo = await getRoomPhoto(id);
  if (!photo) return new NextResponse(null, { status: 404 });

  const user = await currentUser();
  let allowed = user?.id === photo.user_id || isStaff(user);

  if (!allowed) {
    const share = request.nextUrl.searchParams.get("share");
    if (share) {
      // A design's share link grants access to the photo it is built on.
      const design = await getDesignByShareSlug(share);
      allowed = design?.room_photo_id === photo.id;
    }
  }

  if (!allowed) return new NextResponse(null, { status: 404 });

  const variant = request.nextUrl.searchParams.get("variant") === "thumb" ? "thumb" : "full";

  try {
    const data = await readRoomPhoto(photo.storage_key, variant);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": photo.mime,
        "content-length": String(data.byteLength),
        // Private: the image is per-customer, so shared caches must not keep it.
        "cache-control": "private, max-age=3600, must-revalidate",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
