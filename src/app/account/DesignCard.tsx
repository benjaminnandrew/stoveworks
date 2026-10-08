import Link from "next/link";

import { deleteDesignAction, toggleShareAction } from "./actions";

export type CardDesign = {
  id: string;
  title: string;
  room_photo_id: string;
  share_slug: string | null;
  updated_at: Date;
  itemCount: number;
  regionCount: number;
  isCompare: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DesignCard({ design }: { design: CardDesign }) {
  const href = `/account/designs/${design.id}/`;
  const contents = [
    design.itemCount ? plural(design.itemCount, "product", "products") : null,
    design.regionCount ? plural(design.regionCount, "stone area", "stone areas") : null,
    design.isCompare ? "A/B compare" : null,
  ].filter(Boolean);
  const updated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(design.updated_at));

  return (
    <article className="design-card">
      <Link href={href} className="design-thumb">
        {/* Room photos are private and served through the authenticated route,
            so next/image's optimizer is the wrong tool here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photos/${design.room_photo_id}?variant=thumb`} alt="" loading="lazy" />
      </Link>

      <div className="design-body">
        <h3>
          <Link href={href}>{design.title}</Link>
        </h3>
        <p className="design-meta">
          {[...contents, `updated ${updated}`].join(" · ")}
        </p>

        {design.share_slug ? (
          <p className="design-share">
            Shared: <Link href={`/d/${design.share_slug}/`}>/d/{design.share_slug.slice(0, 8)}…</Link>
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
