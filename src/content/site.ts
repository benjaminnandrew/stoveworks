export const business = {
  name: "Hayward Stoveworks",
  shortName: "Hayward Stoveworks",
  tagline: "Northwest Wisconsin's Most Complete Fireplace Center",
  street: "15593 County Road B",
  streetShort: "15593 County Rd. B",
  city: "Hayward",
  state: "WI",
  zip: "54843",
  phone: "(715) 634-2360",
  phoneHref: "tel:+17156342360",
  phoneDisplay: "715-634-2360",
  // No fax: the old site listed the phone number as the fax. Add one here only
  // once Steve confirms a real fax line.
  email: "stoveworksstorefront@gmail.com",
  emailSubject: "Hayward Stoveworks Website Request",
  facebook: "https://www.facebook.com/profile.php?id=100063251977232",
  geo: { lat: 46.0043449, lng: -91.4747434 },
  mapEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2771.343043090308!2d-91.47474344866146!3d46.00434487900848!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x52abf671c1dbd12f%3A0x5c842bef82089b69!2sStove%20Works%20%26%20Fireplace%20Center!5e0!3m2!1sen!2sus!4v1628624265028!5m2!1sen!2sus",
  mapLink: "https://www.google.com/maps/place/Stove+Works+%26+Fireplace+Center",
  hours: [
    { days: "Monday – Friday", time: "9:00 AM – 5:00 PM" },
    { days: "Saturday", time: "10:00 AM – 2:00 PM" },
    { days: "Sunday", time: "Closed" },
  ],
  /** schema.org openingHours, kept alongside the display copy above. */
  hoursSpec: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "17:00" },
    { days: ["Saturday"], opens: "10:00", closes: "14:00" },
  ],
} as const;

export const mailtoHref = `mailto:${business.email}?subject=${encodeURIComponent(business.emailSubject)}`;

export type NavLink = {
  label: string;
  href: string;
  /** One true line under the link, where there is something to say. */
  blurb?: string;
};

/** A "what are you working with?" entry: a situation, not a product name. */
export type NeedLink = NavLink & { image: string };

/**
 * The Shop menu, organised the way people arrive: by the situation they're in,
 * then by product, then by the tools that help them decide. Every entry is an
 * existing page; brand lists under product links come from the pages themselves
 * (see nav-data.ts), so the menu can't drift from the content.
 */
export const shopMenu = {
  needs: [
    { label: "An open fireplace", href: "/inserts/", blurb: "Inserts · gas & wood", image: "/images/feature-inserts.jpg" },
    { label: "A room with no fireplace", href: "/stoves/", blurb: "Stoves · wood & gas", image: "/images/feature-stoves.jpg" },
    { label: "Building or remodeling", href: "/fireplaces/", blurb: "Fireplaces · gas, wood & electric", image: "/images/feature-fireplaces.jpg" },
    { label: "Re-doing the look", href: "/fireplace-walls-mantels/", blurb: "Stone, wall panels & mantels", image: "/images/fb14.jpg" },
  ] satisfies NeedLink[],
  heat: [
    { label: "Wood stoves", href: "/stoves/wood-stoves/" },
    { label: "Gas stoves", href: "/stoves/gas-stoves/" },
    { label: "Wood inserts", href: "/inserts/wood-inserts/" },
    { label: "Gas inserts", href: "/inserts/gas-inserts/" },
    { label: "Wood fireplaces", href: "/fireplaces/wood-fireplaces/" },
    { label: "Gas fireplaces", href: "/fireplaces/gas-fireplaces/" },
    { label: "Electric fireplaces", href: "/fireplaces/electric-fireplaces/" },
  ] satisfies NavLink[],
  more: [
    { label: "Fireplace walls & mantels", href: "/fireplace-walls-mantels/" },
    { label: "Glass doors", href: "/hearth-accessories/glass-doors/" },
    { label: "Hearth pads", href: "/hearth-accessories/hearth-pads/" },
    { label: "Gas logs", href: "/hearth-accessories/gas-logs/" },
    { label: "Outdoor fire rings & grills", href: "/outdoor/" },
    { label: "Cook stoves & refrigerators", href: "/cook-stoves/" },
    { label: "Sauna stoves", href: "/sauna-stoves/" },
    { label: "Wood-fired hot tubs", href: "/wood-fired-hot-tubs/" },
  ] satisfies NavLink[],
  // The room visualizer is retired for now (Ben, 28 Oct 2026).
  tools: [
    { label: "Hearth Studio", href: "/hearth-studio/", blurb: "Buechel stone on your wall, with an estimate" },
  ] satisfies NavLink[],
};

/**
 * The Hearth Studio menu (Ben, 28 Oct 2026): the stone visualizer, which replaced the stone
 * mock-up studio and stands in for the retired room visualizer, in its two versions. The shop's
 * touch screen runs the website, so staff open the showroom version from here; its blurb tells
 * everyone else it's the in-store one.
 */
export const studioMenu: NavLink[] = [
  {
    label: "Online Studio",
    href: "/hearth-studio/",
    blurb: "Try Buechel stone on a chimney, hearth or accent wall, in a sample room or a photo of your own.",
  },
  {
    label: "Showroom Studio",
    href: "/showroom/",
    blurb: "The version on the touch screen in our showroom.",
  },
];

/**
 * The Services menu (Ben, 27 Oct 2026): the service page, and the owner & installer guides,
 * which owners know as manuals. Blurbs come from the pages' own copy. Under the service page,
 * its main sections, so the menu says a little more (Ben, 28 Oct 2026): the anchors are the
 * section ids in src/content/services.ts, the labels its headings.
 */
export const servicesMenu: (NavLink & { sections?: NavLink[] })[] = [
  {
    label: "Service & installation",
    href: "/services/",
    blurb: "Yearly service, repairs, genuine parts and warranty help, from our crew in Hayward.",
    sections: [
      { label: "Yearly service", href: "/services/#yearly" },
      { label: "Repairs", href: "/services/#repairs" },
      { label: "Warranty help", href: "/services/#warranty" },
      { label: "Parts", href: "/services/#parts" },
      { label: "Chimneys & gas lines", href: "/services/#chimneys" },
      { label: "Installation", href: "/services/#installation" },
    ],
  },
  {
    label: "Manuals",
    href: "/guides/",
    blurb: "Your model's owner guide: lighting, everyday care and troubleshooting.",
  },
];

/** The top-level bar. Shop, Brands, Hearth Studio and Services open panels; the rest are plain links. */
export const primaryNav: (NavLink & { menu?: "shop" | "brands" | "studio" | "services" })[] = [
  { label: "Shop", href: "/stoves/", menu: "shop" },
  { label: "Brands", href: "/brands/", menu: "brands" },
  { label: "Hearth Studio", href: "/hearth-studio/", menu: "studio" },
  { label: "Services", href: "/services/", menu: "services" },
  { label: "Cabin Decor", href: "/home-cabin-decor/" },
  { label: "Visit", href: "/contact-us/" },
];

export const associations = [
  {
    name: "North Central Hearth, Patio & Barbeque Association, Inc.",
    href: "https://northcentralhpba.org/",
    logo: { src: "/images/nchpba-logo.png", width: 139, height: 71 },
  },
  {
    name: "National Association of Home Builders",
    href: "https://www.nahb.org/",
    logo: { src: "/images/nahb-logo.png", width: 139, height: 71 },
  },
  {
    name: "Northland Area Builders Association",
    href: "https://northlandareabuilders.com/",
    logo: { src: "/images/naba-logo.png", width: 207, height: 115 },
  },
];
