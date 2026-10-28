/**
 * Home page copy and imagery. Every claim here comes from the previous site's own
 * wording; the photos are the store's showroom shots.
 */

type Photo = { src: string; width: number; height: number; alt: string };

export const hero = {
  label: "Hayward, Wisconsin · Since the 1970s",
  /** Rendered with the middle phrase picked out in the accent colour. */
  heading: ["Northwest Wisconsin’s", "most complete", "fireplace center"] as const,
  lede: "Wood, gas and electric stoves, inserts and fireplaces, and a knowledgeable staff to help you find the right one for your needs and your home.",
};

/** The tilted snapshots beside the hero. */
export const collage: (Photo & { caption: string })[] = [
  {
    src: "/images/fb7.jpg",
    width: 720,
    height: 960,
    alt: "A stone-faced fireplace with a log mantel and a firewood niche in the showroom",
    caption: "In the showroom",
  },
  {
    src: "/images/fb2.jpg",
    width: 960,
    height: 580,
    alt: "The Hayward Stoveworks storefront, a log building with a green roof",
    caption: "County Rd. B, since the 1970s",
  },
  {
    src: "/images/fb11.jpg",
    width: 960,
    height: 720,
    alt: "Shelves of cabin decor in the store",
    caption: "Cabin decor",
  },
];

export const showroom = {
  label: "On the floor",
  heading: "What’s on the showroom floor",
  items: [
    {
      href: "/fireplaces/",
      title: "Fireplaces",
      sub: "Gas, wood & electric",
      photo: { src: "/images/decor-2.jpg", width: 435, height: 350, alt: "A wood fire burning behind glass doors in a stone wall, under a log mantel" },
    },
    {
      href: "/stoves/wood-stoves/",
      title: "Wood stoves",
      sub: "Blaze King · Jøtul · Pacific Energy",
      photo: { src: "/images/feature-stoves.jpg", width: 281, height: 281, alt: "A freestanding wood stove with a fire burning" },
    },
    {
      href: "/inserts/",
      title: "Inserts",
      sub: "For the fireplace you already have",
      photo: { src: "/images/feature-inserts.jpg", width: 281, height: 281, alt: "A fireplace insert with a fire burning, set into a brick fireplace" },
    },
    {
      href: "/fireplace-walls-mantels/",
      title: "Fireplace walls & mantels",
      sub: "Cultured Stone · TriLite · log mantels",
      photo: { src: "/images/fb14.jpg", width: 720, height: 960, alt: "A corner fireplace faced in stacked stone with a log mantel" },
    },
    {
      href: "/outdoor/",
      title: "Outdoor",
      sub: "Fire rings & grills",
      photo: { src: "/images/fb12.jpg", width: 720, height: 960, alt: "A grill and hanging bags on a pine-panelled wall in the store" },
    },
  ],
};

export const history = {
  label: "A history of service",
  heading: "Born in the energy crisis of the 1970s",
  photo: {
    src: "/images/fb1.jpg",
    width: 720,
    height: 960,
    alt: "A row of stoves along the showroom floor, under pine ceilings and stained-glass lamps",
  },
  paragraphs: [
    "Hayward Stoveworks began in the energy crisis of the 1970’s and has changed with the passing decades. New technologies have emerged and we have grown and narrowed our choices of heating appliances.",
    "Today we carry only what we have found to be the most reliable lines, with highest in quality being our top priority. All of our installers are factory trained.",
    // Word for word from the live site's "A History of Service" block (Ben, 21 Oct 2026).
    "We are more than just a fireplace store. We have cook stoves, barbeques, manufactured stone/brick, mantels, and many more hearth accessories like gas & electric logs, fireplace screens, tool sets and wood holders.",
  ],
  /** From the live site's "A History of Service" block, after its brand list. */
  closing:
    "Our friendly and very knowledgeable staff is ready to help you find the right stove or fireplace to fit your needs as well as your home.",
  /** On the live site's brand list but not on a heating page: the cook stove maker. */
  alsoCarried: ["Heartland"],
};

export const decor = {
  label: "More than a fireplace store",
  heading: "Lamps, art for over the mantel, and so much more",
  // The live site's wording. Its hearth-accessories sentence is in the history section above.
  body: "We also carry a wide selection of home and cabin decor, including lamps, art work for above mantels, and so much more. If you find yourself in the Hayward area, we invite you to stop in and see what we have to offer.",
  photos: [
    { src: "/images/fb10.jpg", width: 960, height: 720, alt: "Stained-glass table lamps and deer metal art" },
    { src: "/images/fb9.jpg", width: 960, height: 720, alt: "Metal welcome signs, wall hooks and a carved bear" },
    { src: "/images/fb3.jpg", width: 960, height: 720, alt: "Rustic shelves of cabin decor" },
  ] satisfies Photo[],
};

