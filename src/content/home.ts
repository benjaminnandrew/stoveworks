export const hero = {
  src: "/images/home-hero-rev.jpg",
  width: 1920,
  height: 653,
  alt: "The Stove Works showroom in Hayward, Wisconsin",
};

export const intro = {
  heading: "Welcome to Stove Works, Northwest Wisconsin's Most Complete Fireplace Center!",
  body: "We are proud to offer you an excellent selection of top quality products by the best manufacturers in the industry, and an experienced, knowledgeable staff to assist you with any of your heating questions. Click below to learn about our main product lines.",
};

export const featureTiles = [
  {
    title: "Stoves",
    href: "/stoves",
    blurb: "A stove is a freestanding heating unit that can go just about anywhere in your home.",
    image: { src: "/images/feature-stoves.jpg", width: 281, height: 281 },
  },
  {
    title: "Inserts",
    href: "/inserts",
    blurb: "A fireplace insert is a device inserted into an existing masonry (real) fireplace.",
    image: { src: "/images/feature-inserts.jpg", width: 281, height: 281 },
  },
  {
    title: "Fireplaces",
    href: "/fireplaces",
    blurb: "A fireplace can vary in size from 20 inches wide to 54 inches wide.",
    image: { src: "/images/feature-fireplaces.jpg", width: 281, height: 281 },
  },
  {
    title: "Facings",
    href: "/facings",
    blurb: "Personalize your fireplace with a mantel and facing.",
    image: { src: "/images/feature-facings-2.jpg", width: 281, height: 281 },
  },
];

export const history = {
  heading: "A History of Service",
  background: "/images/bg-dark-2.jpg",
  photo: {
    src: "/images/stove-works-sign.jpg",
    width: 1801,
    height: 1200,
    alt: "The Stove Works sign outside the Hayward, Wisconsin store",
  },
  columnHtml: `<p>The Stove Works began in the energy crisis of the 1970’s and has changed with the passing decades. New technologies have emerged and we have grown and narrowed our choices of heating appliances. Today we carry only what we have found to be the most reliable lines, with highest in quality being our top priority.</p>
<p>We are more than just a fireplace store.</p>
<p>We have <a href="/specialty-hearth/refrigerators-cook-stoves">cook stoves</a>, <a href="/specialty-hearth/outdoor-rings-grills">barbeques</a>, <a href="/facings">manufactured stone/brick</a>, <a href="/facings">mantels</a>, and many more hearth accessories like gas &amp; electric logs, fireplace screens, tool sets and wood holders.</p>`,
  bodyHtml: `<p>We also carry a wide selection of home and cabin decor including lamps, art work for above mantels, and so much more.</p>
<p>The Stove Works carries top name brands like Mendota, Jotul, Pacific Energy, RSF, Hearthstone, Morso, Kozy Heat, Majestic, Heartland, Wilkening, Blazeking, Enviro, and many more.</p>
<p>If you find yourself in the Hayward area, we invite you to stop in and see what we have to offer. Our friendly and very knowledgeable staff is ready to help you find the right stove or fireplace to fit your needs and as well as your home.</p>`,
};

export const galleryHeading = "Come See What We Have In Store!";

/** Showroom photos, in the order the previous site's carousel used. */
export const gallery = [
  { src: "/images/fb6.jpg", width: 720, height: 960 },
  { src: "/images/fb7.jpg", width: 720, height: 960 },
  { src: "/images/fb1.jpg", width: 720, height: 960 },
  { src: "/images/fb3.jpg", width: 960, height: 720 },
  { src: "/images/fb4.jpg", width: 604, height: 960 },
  { src: "/images/fb13.jpg", width: 720, height: 960 },
  { src: "/images/fb8.jpg", width: 720, height: 960 },
  { src: "/images/fb9.jpg", width: 960, height: 720 },
  { src: "/images/fb10.jpg", width: 960, height: 720 },
  { src: "/images/fb11.jpg", width: 960, height: 720 },
  { src: "/images/fb12.jpg", width: 720, height: 960 },
  { src: "/images/fb14.jpg", width: 720, height: 960 },
  { src: "/images/fb2.jpg", width: 960, height: 580 },
].map((g, i) => ({ ...g, alt: `Stove Works showroom photo ${i + 1}` }));
