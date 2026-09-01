import Link from "next/link";

import type { DesignSummary } from "@/lib/designs";
import { deleteDesignAction, toggleShareAction } from "./actions";

export function DesignCard({ design }: { design: DesignSummary }) {
  const updated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(design.updated_at));

  return (
    <article className="design-card">
      <Link href={`/account/designs/${design.id}`} className="design-thumb">
        {/* Room photos are private and served through the authenticated route,
            so next/image's optimizer is the wrong tool here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photos/${design.room_photo_id}?variant=thumb`} alt="" loading="lazy" />
      </Link>

      <div className="design-body">
        <h3>
          <Link href={`/account/designs/${design.id}`}>{design.title}</Link>
        </h3>
        <p className="design-meta">
          {design.item_count} {design.item_count === 1 ? "product" : "products"} · updated {updated}
        </p>

        {design.share_slug ? (
          <p className="design-share">
            Shared:{" "}
            <Link href={`/d/${design.share_slug}`}>/d/{design.share_slug.slice(0, 8)}…</Link>
          </p>
        ) : null}

        <div className="design-actions">
          <form action={toggleShareAction}>
            <input type="hidden" name="id" value={design.id} />
            <input type="hidden" name="shared" value={String(Boolean(design.share_slug))} />
            <button type="submit" className="linklike">
              {design.share_slug ? "Stop sharing" : "Get share link"}
            </button>
          </form>

          <form action={deleteDesignAction}>
            <input type="hidden" name="id" value={design.id} />
            <button type="submit" className="linklike danger">
              Delete
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
