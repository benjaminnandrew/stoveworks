export const business = {
  name: "The Stove Works, Inc.",
  shortName: "Stove Works",
  tagline: "Northwest Wisconsin's Most Complete Fireplace Center",
  street: "15593 County Road B",
  streetShort: "15593 County Rd. B",
  city: "Hayward",
  state: "WI",
  zip: "54843",
  phone: "(715) 634-2360",
  phoneHref: "tel:+17156342360",
  phoneDisplay: "715-634-2360",
  fax: "(715) 634-2360",
  email: "stoveworksstorefront@gmail.com",
  emailSubject: "Stove Works Website Request",
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

export type NavItem = { label: string; href: string; children?: NavItem[] };

export const nav: NavItem[] = [
  { label: "Services", href: "/services" },
  {
    label: "Stoves",
    href: "/stoves",
    children: [
      { label: "Gas Stoves", href: "/stoves/gas-stoves" },
      { label: "Wood Stoves", href: "/stoves/wood-stoves" },
    ],
  },
  {
    label: "Inserts",
    href: "/inserts",
    children: [
      { label: "Gas Inserts", href: "/inserts/gas-inserts" },
      { label: "Wood Inserts", href: "/inserts/wood-inserts" },
    ],
  },
  {
    label: "Fireplaces",
    href: "/fireplaces",
    children: [
      { label: "Gas Fireplaces", href: "/fireplaces/gas-fireplaces" },
      { label: "Wood Fireplaces", href: "/fireplaces/wood-fireplaces" },
      { label: "Electric Fireplaces", href: "/fireplaces/electric-fireplaces" },
    ],
  },
  {
    label: "Specialty Hearth",
    href: "/specialty-hearth",
    children: [
      { label: "Glass Doors", href: "/specialty-hearth/glass-doors" },
      { label: "Hearth Pads", href: "/specialty-hearth/hearth-pads" },
      { label: "Gas Logs", href: "/specialty-hearth/gas-logs" },
      { label: "Outdoor Rings & Grills", href: "/specialty-hearth/outdoor-rings-grills" },
      { label: "Refrigerators & Cook Stoves", href: "/specialty-hearth/refrigerators-cook-stoves" },
      { label: "Hot Tubs / Sauna Stoves", href: "/specialty-hearth/hot-tubs-sauna-stoves" },
    ],
  },
  { label: "Facings", href: "/facings" },
  { label: "Visualizer", href: "/visualizer" },
  { label: "Home & Cabin Decor", href: "/home-cabin-decor" },
  { label: "Contact Us", href: "/contact-us" },
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
