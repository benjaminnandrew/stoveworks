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
  /** A manufacturer we carry: name, blurb, and linked logo. */
  | { type: "brand"; name: string; body: string; logo: Media }
  /** A row of images (logos or photos). */
  | { type: "media-grid"; cols: number; items: Media[] }
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
