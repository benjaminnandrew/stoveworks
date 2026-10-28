export type Media = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Outbound link wrapped around the image (manufacturer sites). */
  href?: string;
};

export type Section =
  /** Heading + paragraphs of editorial copy. */
  | { type: "prose"; html: string }
  /** Copy on the left, a stack of logos/images on the right. */
  | { type: "prose-aside"; html: string; aside: Media[] }
  /**
   * A manufacturer we carry: name, blurb, and linked logo. Without a logo file
   * yet, the name is shown as a text wordmark linking to `website`.
   */
  | { type: "brand"; name: string; body: string; logo?: Media; website?: string }
  /** A row of images (logos or photos). */
  | { type: "media-grid"; cols: number; items: Media[] }
  /**
   * Photos from the store, laid out as prints; each enlarges on click with its
   * alt text as the caption. They came from the home page's gallery (Ben, 22 Oct
   * 2026), which now lives on the pages each photo belongs to.
   */
  | { type: "photos"; heading?: string; items: Media[] }
  /**
   * On a hub page (/inserts/), a card for each fuel's page with a few of its
   * models and its makers, filled from the catalog. Fuels listed on another
   * hub's page (the electric insert, on Electric Fireplaces) follow as a short row.
   */
  | { type: "fuels"; heading: string }
  /** Trusted third-party embed (the Google Map). */
  | { type: "embed"; html: string };

export type Page = {
  /** Path without leading slash, e.g. "fireplaces/gas-fireplaces". */
  slug: string;
  title: string;
  /**
   * The <title>, before " | Hayward Stoveworks" is appended. Defaults to
   * "{title} in Hayward, WI": people searching from the Cities for their cabin
   * type the town, and Google can't infer it from where they are.
   */
  metaTitle?: string;
  /** Optional override for the meta description. */
  description?: string;
  sections: Section[];
};
