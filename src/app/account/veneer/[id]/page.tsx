import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VeneerStudio } from "@/components/veneer/VeneerStudio";
import { requireUser } from "@/lib/auth";
import { getRoomPhoto } from "@/lib/designs";
import { listSwatches } from "@/lib/stone";
import { getVeneerDesign } from "@/lib/veneer";
import { parseRegions } from "@/lib/veneer-types";
import { AccountNav } from "../../AccountNav";

export const metadata: Metadata = { title: "Edit mock-up", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditVeneerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const design = await getVeneerDesign(id);
  if (!design || design.user_id !== user.id) notFound();

  const [photo, stones] = await Promise.all([
    getRoomPhoto(design.room_photo_id),
    listSwatches(),
  ]);
  if (!photo) notFound();

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{design.title}</h1>
          <AccountNav />
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <VeneerStudio
            stones={stones}
            isSignedIn
            initial={{
              designId: design.id,
              title: design.title,
              photo: {
                url: `/api/photos/${photo.id}`,
                width: photo.width,
                height: photo.height,
                roomPhotoId: photo.id,
              },
              state: { regions: parseRegions(design.regions) },
            }}
          />
        </div>
      </div>
    </>
  );
}
