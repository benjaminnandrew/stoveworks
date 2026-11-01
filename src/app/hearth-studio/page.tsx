import type { Metadata } from "next";

import { SHARE_IMAGE } from "@/lib/share-image";

const title = "Hearth Studio, Stone Visualizer";
const description =
  "Try Buechel stone on a chimney, hearth or accent wall, in a sample room or on a photo of your own. From Hayward Stoveworks in Hayward, WI.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/hearth-studio/" },
  openGraph: { title, description, url: "/hearth-studio/", images: [SHARE_IMAGE] },
};

/**
 * Hearth Studio, the stone and stove visualizer (handoff/hearth-studio/INTEGRATION.md, Phase 1).
 * The app is static files in public/hs/ and owns the whole screen, top bar included, so it's
 * framed full height with the site's header and footer left off (SiteChrome). Same origin, so it
 * can call the site's /api/ routes. The showroom's touch screen opens /showroom/ instead.
 *
 * A stove page's "See it in a room" opens /hearth-studio/?stove=<id>: the app starts with that
 * stove on the lake cabin's hearth (src/lib/hearth-studio.ts).
 */
type Props = { searchParams: Promise<{ stove?: string | string[] }> };

export default async function HearthStudioPage({ searchParams }: Props) {
  const { stove } = await searchParams;
  const id = typeof stove === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(stove) ? stove : null;
  return (
    <iframe
      className="hs-frame"
      src={id ? `/hs/index.html?stove=${id}` : "/hs/index.html"}
      title="Hearth Studio"
      allow="fullscreen; clipboard-write; web-share"
    />
  );
}
