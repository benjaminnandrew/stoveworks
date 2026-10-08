import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoomStudio } from "@/components/studio/RoomStudio";
import { requireUser } from "@/lib/auth";
import { designStateOf, getDesign, getRoomPhoto } from "@/lib/designs";
import { listPlaceableProducts } from "@/lib/placeable";
import { listSwatches } from "@/lib/stone";
import { AccountNav } from "../../AccountNav";

export const metadata: Metadata = { title: "Edit design", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditDesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const design = await getDesign(id);
  if (!design || design.user_id !== user.id) notFound();

  const [photo, products, stones] = await Promise.all([
    getRoomPhoto(design.room_photo_id),
    listPlaceableProducts(),
    listSwatches(),
  ]);
  if (!photo) notFound();

  const state = designStateOf(design);

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
          <RoomStudio
            products={products}
            stones={stones}
            isSignedIn
            initialLayer={state.items.length === 0 && state.regions.length > 0 ? "stone" : "stove"}
            initial={{
              designId: design.id,
              title: design.title,
              photo: {
                url: `/api/photos/${photo.id}`,
                width: photo.width,
                height: photo.height,
                roomPhotoId: photo.id,
                label: design.title,
                isSample: false,
              },
              state,
            }}
          />
        </div>
      </div>
    </>
  );
}
