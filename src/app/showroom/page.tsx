import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Showroom Studio",
  robots: { index: false, follow: false },
};

/**
 * The shop's touch screen: Hearth Studio locked in showroom mode (`#showroom`), with its welcome
 * screen, big touch targets and the idle reset between customers. This is the URL the kiosk's
 * Chrome opens in kiosk mode. No site header or footer (SiteChrome).
 */
export default function ShowroomPage() {
  return (
    <iframe
      className="hs-frame"
      src="/hs/index.html#showroom"
      title="Hearth Studio, showroom screen"
      allow="fullscreen; clipboard-write; web-share"
    />
  );
}
