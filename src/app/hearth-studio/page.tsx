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
 */
export default function HearthStudioPage() {
  return (
    <iframe
      className="hs-frame"
      src="/hs/index.html"
      title="Hearth Studio"
      allow="fullscreen; clipboard-write; web-share"
    />
  );
}
