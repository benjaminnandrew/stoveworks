import type { Metadata, Viewport } from "next";
import {
  Barlow,
  Barlow_Condensed,
  Barlow_Semi_Condensed,
  Besley,
  Calistoga,
  Libre_Franklin,
  Literata,
  Roboto_Serif,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";

import { CompareTray } from "@/components/CompareTray";
import { ImageLightbox } from "@/components/ImageLightbox";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { SiteChrome } from "@/components/SiteChrome";
import { SiteHeader } from "@/components/SiteHeader";
import { TypeSwitcher } from "@/components/TypeSwitcher";
import { business } from "@/content/site";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";
import { DEFAULT_TYPE, TYPE_BOOT } from "@/lib/type-review";

import "./globals.css";
import "./app.css";
import "./veneer.css";

/**
 * Three faces, per the Hayward Stoveworks type scheme — display, reading, UI.
 * Self-hosted through next/font, so no third-party request and no layout shift.
 */

/** Show: hero words and short display lines only. Never body, nav or forms. */
const calistoga = Calistoga({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-calistoga",
  display: "swap",
  preload: false,
});

/** Story: page titles and all reading copy. Variable, with an italic. */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
  preload: false,
});

/** Shop: nav, buttons, labels, prices, forms, captions. */
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-sans",
  display: "swap",
  preload: false,
});

/*
 * Type review (Ben, 22 Oct 2026: "not sold … a little AI-ish. Looking for warm, northwoodsy,
 * but an established brand selling wood stoves"). Four alternative directions, previewed with
 * ?type=foundry|nameplate|trail|trail-serif|current and the switcher (src/components/TypeSwitcher.tsx).
 * Ben liked Trail + serif ("that feels more like it"), so it's the default: html[data-type="trail-serif"]
 * and its three faces preloaded. The rest download only while previewed. Once he confirms, fold it
 * into :root and delete the other faces.
 */
const besley = Besley({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-besley",
  display: "swap",
  preload: false,
});
const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-franklin",
  display: "swap",
  preload: false,
});
const robotoSerif = Roboto_Serif({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  style: ["normal", "italic"],
  variable: "--font-roboto-serif",
  display: "swap",
  preload: false,
});
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
  display: "swap",
  preload: false,
});
const barlowSemi = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-semi",
  display: "swap",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-cond",
  display: "swap",
});
const literata = Literata({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-literata",
  display: "swap",
});
const reviewFonts = [besley, libreFranklin, robotoSerif, barlow, barlowSemi, barlowCondensed, literata].map(
  (f) => f.variable,
);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `Fireplace & Stove Store in ${business.city}, ${business.state} | ${business.name}`,
    template: `%s | ${business.name}`,
  },
  description:
    "Wood, gas and electric stoves, inserts and fireplaces, stone and mantels, with factory-trained installation and service. Hayward, Wisconsin.",
  openGraph: {
    type: "website",
    siteName: `${business.name} – ${business.city}, Wisconsin`,
    locale: "en_US",
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE.url] },
};

export const viewport: Viewport = {
  themeColor: "#96382c",
  width: "device-width",
  initialScale: 1,
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: business.name,
  description: business.tagline,
  url: siteUrl,
  telephone: business.phone,
  email: business.email,
  image: `${siteUrl}/images/logo-badge.png`,
  logo: `${siteUrl}/images/logo-badge.png`,
  address: {
    "@type": "PostalAddress",
    streetAddress: business.street,
    addressLocality: business.city,
    addressRegion: business.state,
    postalCode: business.zip,
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: business.geo.lat,
    longitude: business.geo.lng,
  },
  openingHoursSpecification: business.hoursSpec.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: h.days,
    opens: h.opens,
    closes: h.closes,
  })),
  sameAs: [business.facebook],
};

export default function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <html
      lang="en-US"
      className={[calistoga.variable, sourceSerif.variable, sourceSans.variable, ...reviewFonts].join(" ")}
      data-type={DEFAULT_TYPE}
      suppressHydrationWarning
    >
      <head>
        {/* Sets html[data-type] before first paint, so a previewed direction doesn't flash. */}
        <script dangerouslySetInnerHTML={{ __html: TYPE_BOOT }} />
      </head>
      <body>
        <JsonLd data={localBusinessJsonLd} />
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <div className="site">
          {/* Off the full-screen pages (Hearth Studio, the showroom screen): see SiteChrome. */}
          <SiteChrome>
            <SiteHeader />
          </SiteChrome>
          <main id="content" className="site-main">
            {children}
          </main>
          <SiteChrome>
            <SiteFooter />
          </SiteChrome>
          <ImageLightbox />
        </div>
        {/* A model opened from a list (src/app/@modal). */}
        {modal}
        <SiteChrome>
          <CompareTray />
          <TypeSwitcher />
        </SiteChrome>
      </body>
    </html>
  );
}
