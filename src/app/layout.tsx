import type { Metadata, Viewport } from "next";
import { Calistoga, Source_Sans_3, Source_Serif_4 } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { business } from "@/content/site";
import { siteUrl } from "@/lib/site-url";

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
});

/** Story: page titles and all reading copy. Variable, with an italic. */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

/** Shop: nav, buttons, labels, prices, forms, captions. */
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${business.name} – ${business.city}, Wisconsin – ${business.tagline}`,
    template: `%s – ${business.name}`,
  },
  description: `${business.name} in ${business.city}, Wisconsin. Gas, wood and electric stoves, fireplaces, inserts, facings and specialty hearth products, with factory-trained installers.`,
  openGraph: {
    type: "website",
    siteName: `${business.name} – ${business.city}, Wisconsin`,
    locale: "en_US",
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#d63d45",
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
  faxNumber: business.fax,
  email: business.email,
  image: `${siteUrl}/images/logo-hayward-stoveworks.png`,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-US"
      className={`${calistoga.variable} ${sourceSerif.variable} ${sourceSans.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <div className="site">
          <SiteHeader />
          <main id="content" className="site-main">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
