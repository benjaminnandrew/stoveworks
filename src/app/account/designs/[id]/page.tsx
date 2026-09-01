import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Visualizer } from "@/components/visualizer/Visualizer";
import { requireUser } from "@/lib/auth";
import { parseItems } from "@/lib/design-types";
import { getDesign, getRoomPhoto } from "@/lib/designs";
import { listPlaceableProducts } from "@/lib/placeable";
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

  const [photo, products] = await Promise.all([
    getRoomPhoto(design.room_photo_id),
    listPlaceableProducts(),
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
          <Visualizer
            products={products}
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
              state: {
                items: parseItems(design.items),
                pctPerInch: design.pct_per_inch ? Number(design.pct_per_inch) : null,
              },
            }}
          />
        </div>
      </div>
    </>
  );
}
