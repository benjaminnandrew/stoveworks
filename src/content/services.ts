import { business } from "./site";
import type { Page } from "./types";

/**
 * The Services page (/services/), from Ben's service-page handoff of 27 Oct 2026, which was built
 * from Steve's own answers, the brand list, Jøtul's manuals and NFPA 211. Use the copy as written
 * and add nothing to it. It leaves out, on purpose:
 * - any price;
 * - that Stoveworks sometimes installs or services its brands bought elsewhere;
 * - emergency or no-heat calls, either way;
 * - shopping material (sizing, install cost, financing, installing it yourself).
 * The gas-smell steps are the manufacturer's, word for word.
 *
 * Rendered by src/app/services/page.tsx; `servicePage` below gives the same copy to the site
 * search, the sitemap and the page list.
 */

export type ServiceSection = {
  id: string;
  heading: string;
  /** Its name in the page's jump bar, where the heading is long. */
  nav?: string;
  /** Copy before the brand list, on the section that shows one. */
  lead?: string;
  /** The brands we sell (src/content/brands.ts, Majestic included), after the lead. */
  brandList?: boolean;
  html: string;
};

export type ServiceQuestion = { q: string; a: string };

/** The guide hub, opening each model's guide on its homeowner side (Ben, 27 Oct 2026). */
const OWNER_GUIDES = "/guides/?for=owner";

const CSIA = `<a href="https://csia.org/faq.html" target="_blank" rel="noopener noreferrer">CSIA</a>`;

export const service = {
  title: "Services",
  metaTitle: "Stove & Fireplace Service & Repair",
  description:
    "Yearly service, repairs, genuine parts and warranty help for every stove and fireplace brand we sell, from our factory-trained crew in Hayward.",
  headline: "We service what we sell.",
  intro:
    "The same shop that sells and installs your stove keeps it running: yearly service, repairs, genuine parts and warranty help, from our crew in Hayward.",
  cta: `Call to book · ${business.phone}`,

  sections: [
    {
      id: "brands",
      heading: "The brands we work on",
      nav: "Brands",
      lead: "We install and service every brand we sell:",
      brandList: true,
      html: `<p>Selling a brand gives us the maker's training, the parts and the warranty access to work on it properly. That covers older and discontinued models from these brands too, as long as parts are still available.</p>
<p>Not sure about yours? Call with the brand and model. Both are on the unit's data plate, and your <a href="${OWNER_GUIDES}">owner's manual</a> shows where to find it.</p>
<p>If we sold you a brand we no longer carry, we may not be able to service it, since we stop stocking a brand's parts once we're no longer its dealer. Call anyway; when we can, we'll try to help.</p>`,
    },
    {
      id: "yearly",
      heading: "Yearly service",
      html: `<p>How often your unit needs service depends on how much you use it. As a baseline, Jøtul's manuals, for example, say the unit and its venting should be inspected before use and at least once a year by a qualified technician. NFPA 211, the National Fire Protection Association's safety standard for chimneys, fireplaces and vents, also calls for a yearly inspection, with cleaning and repairs as needed (${CSIA}).</p>
<p><strong>Our basic gas service</strong> covers everything that keeps a gas unit working safely for another year. We check the gas valve and gas delivery system, the burners, the pilot system and the blowers, and we clean the glass.</p>
<p><strong>Wood stoves and fireplaces:</strong> We don't sweep chimneys, so for yearly sweeping and chimney inspections, call one of the sweeps we recommend under <a href="#chimneys">Chimneys, venting and gas lines</a>. We do handle wood-stove repairs like replacing gaskets.</p>
<p><strong>No service plan to sign up for.</strong> We'll talk through what your unit needs when you buy.</p>`,
    },
    {
      id: "repairs",
      heading: "Repairs",
      html: `<p>Most of our service calls are dead batteries and pilot lights that won't light. Before you call, try two things:</p>
<ul>
<li>Replace the batteries in the remote, and in the unit if it has a battery pack.</li>
<li>Re-sync the remote to the unit. Your <a href="${OWNER_GUIDES}">owner's manual</a> shows how.</li>
</ul>
<p>Still not working? Call us, and we'll find the cause and fix it with genuine parts. If you smell gas, stop and follow the steps under <a href="#gas-smell">If you smell gas</a>.</p>`,
    },
    {
      id: "warranty",
      heading: "Warranty help",
      nav: "Warranty",
      html: `<p>Bought it from us? Call us first. We handle warranty claims with the manufacturer for every brand we sell, and we try to make it as easy as we can for you.</p>
<p>Three things protect your warranty:</p>
<ul>
<li><strong>Call promptly.</strong> Some warranties set a deadline. Jøtul's gas stove warranty needs notice within 60 days of finding the problem.</li>
<li><strong>Keep your dated receipt.</strong> It's your proof of purchase.</li>
<li><strong>Use an authorized installer and service tech.</strong> Some warranties are void if anyone else installs or services the unit; Jøtul's gas insert warranty is one.</li>
</ul>
<p><strong>Know your data plate.</strong> Every unit has one, showing its serial number and date of manufacture. Some makers let you register your unit directly, though some European brands don't, and we'll ask for your data plate details if we don't have them on file.</p>
<p>Worn parts are usually yours to replace; Jøtul's gas warranties, for example, exclude gaskets and glass unless heat stress damaged them. Repairs that take extended time or several trips can carry some labor charges, which we handle case by case.</p>`,
    },
    {
      id: "parts",
      heading: "Parts",
      html: `<p>We stock gaskets in several sizes, pilot assemblies and remotes for the brands we sell. Glass, and anything else we don't stock, is special order. Makers specify their own parts; Jøtul's gas stove manual, for example, says to use only Jøtul's own ceramic glass.</p>
<p>Doing it yourself? We sell replacement parts over the counter. Have your model and serial number ready; both are on the data plate.</p>`,
    },
    {
      id: "chimneys",
      heading: "Chimneys, venting and gas lines",
      nav: "Chimneys & gas lines",
      html: `<p>A stove is only as safe as the chimney or vent above it. Even gas vents and little-used chimneys need the yearly check, since nests and debris can block them (${CSIA}).</p>
<ul>
<li><strong>Chimney sweeping and inspections:</strong> We don't sweep chimneys. We recommend The Chimney Sweep, <a href="tel:+17159349607">(715) 934-9607</a>, or East Central Chimney &amp; Masonry, <a href="tel:+16126690739">(612) 669-0739</a>.</li>
<li><strong>Blocked vents:</strong> Keep your gas unit's vent cap clear of snow and ice. If something is blocking a chimney or gas vent, call us to take a look; a chimney sweep can also check a blocked wood chimney.</li>
<li><strong>Gas lines and conversions:</strong> We run gas lines for our installs. Very long runs, lines through several floors and buried lines go to your general contractor or gas supplier. We convert any unit between propane and natural gas as needed.</li>
</ul>`,
    },
    {
      id: "installation",
      heading: "Installation",
      html: `<p>We install the brands we sell, and all our installers are factory trained.</p>
<p>Site visits and estimates are free. An install includes:</p>
<ul>
<li>Removing your old unit and its venting</li>
<li>Installing the new unit and all of its venting</li>
<li>A hearth pad, if you need one</li>
</ul>
<p>In our experience, installs without structural changes don't need a permit. Some installs happen in as little as two to three months from order; others, especially new construction, can run past six months.</p>
<p><strong>Building or adding on?</strong> Call us as soon as you know you want a fireplace or stove. We'll sort out placement early, and you'll know the whole process and timeline. Bring your plans or drawings.</p>
<p><strong><a href="/hearth-accessories/gas-logs/">Gas logs</a>:</strong> We install and service them, the same as stoves and fireplaces.</p>
<p><strong>Fireplace doors:</strong> We install new custom doors from <a href="/hearth-accessories/glass-doors/">Wilkening</a>, and we'll service them if they're damaged or need a new gasket.</p>
<p><strong>Stone and mantels:</strong> We don't install stone; we'll point you to the local masons we work with. Most customers supply their own mantel, and we also offer non-combustible mantels from Magra Hearth. Either way, our crew installs the mantel before the stone goes up.</p>
<p><strong>Used stoves:</strong> We can install a used stove if it's in safe working condition and UL listed.</p>
<p>Already own one? Your model's <a href="${OWNER_GUIDES}">owner guide</a> covers lighting, everyday care and troubleshooting.</p>`,
    },
    {
      id: "crew",
      heading: "Our crew",
      html: `<p>Our install crew: Gabe, Drew, Mike and Gary. All our installers are factory trained.</p>
<p>Members of <a href="https://www.nahb.org/" target="_blank" rel="noopener noreferrer" title="National Association of Home Builders">NAHB</a>, <a href="https://northcentralhpba.org/" target="_blank" rel="noopener noreferrer" title="North Central Hearth, Patio &amp; Barbeque Association">NCHPBA</a> and <a href="https://northlandareabuilders.com/" target="_blank" rel="noopener noreferrer" title="Northland Area Builders Association">NABA</a>, the builders' and hearth trade groups.</p>`,
    },
  ] satisfies ServiceSection[],

  /** Beside the sections, with the gas-smell steps under it. Booking starts with a call; no form. */
  book: {
    heading: "Book service",
    items: [
      {
        label: "Call the shop to start:",
        html: `<a href="${business.phoneHref}">${business.phone}</a>, Mon–Fri 9–5 and Sat 10–2. Calling is always the best way to get things going.`,
      },
      { label: "Have ready:", html: "the brand and model. If a photo would help, we'll ask you to email one." },
      {
        label: "Book early:",
        // Ben, 27 Oct 2026, replacing the handoff's "about three weeks out".
        html: "We're busy all year, not just in fall, and we're usually booked out many weeks.",
      },
      {
        label: "Where we go:",
        html: "Serving the greater Hayward lakes within a 1.5-hour radius. Extended travel time is charged.",
      },
      { label: "Pricing:", html: "Every job is different, so we don't list prices. Call the shop for a quote." },
    ],
  },

  /** The manufacturer's steps, word for word: don't edit them. */
  gasSmell: {
    id: "gas-smell",
    heading: "If you smell gas",
    intro:
      "Suspect a gas leak? Stop, and don't try to fix anything yourself. Follow these steps, and if you suspect a large leak, call 911.",
    steps: [
      "Put out any open flame.",
      "Open windows.",
      "Do not light any appliance.",
      "Do not touch any electrical switches.",
      "Do not use any phone in your building.",
      "Immediately call your gas supplier from a neighbor's phone.",
      "If you can't reach your gas supplier, call the fire department.",
    ],
  },

  /** Also marked up as schema.org FAQPage. */
  questions: {
    id: "questions",
    heading: "Common questions",
    nav: "Questions",
    items: [
      {
        q: "How often does my stove need service?",
        a: "It depends on how much you use it, and we'll talk it through when you buy. As a baseline, makers like Jøtul and NFPA 211 call for an inspection at least once a year, and chimneys should be swept whenever an inspection finds buildup.",
      },
      {
        q: "Do you work on brands you don't sell?",
        a: "No. We stick to the brands we sell, where we have the maker's training, the parts and the warranty access.",
      },
      {
        q: "What can I do between visits?",
        a: "Keep anything that burns away from the unit. Vacuum dust and pet hair from the screen and the controls area; Jøtul suggests the controls area at least monthly. Clean the glass only when it's cool, and never with abrasive or ammonia-based cleaners.",
      },
      {
        q: "Why does the glass on my gas stove fog up when I light it?",
        a: "That's normal condensation, and it clears as the unit heats up.",
      },
      {
        q: "Is it normal for a new stove to smell?",
        a: "Yes, for the first few fires. It's manufacturing residue burning off and materials curing, so open a window for fresh air.",
      },
      {
        q: "My gas stove keeps shutting itself off. Why?",
        a: "Some vented gas stoves have a safety switch that shuts the burner off when the vent isn't drawing properly. If it keeps happening, turn off the gas supply and call us.",
      },
      {
        q: "My gas fireplace won't start. What should I check first?",
        a: `The batteries, then re-sync the remote. Those two fix most of the calls we get. If you smell gas, stop and follow <a href="#gas-smell">the steps above</a>.`,
      },
      {
        q: "Will my gas stove work in a power outage?",
        a: "A standing-pilot model will, which is why we recommend them for cabins and second homes. Newer electronic models have a battery backup. Either way, blowers and lights won't run until the power's back.",
      },
      {
        q: "How should I leave my unit when I close up the cabin?",
        a: "If you're willing, leave the pilot lit; that's the best way to leave a unit for the off-season. When you start it up again in spring or fall, it can take several tries to bleed the air out of the pilot supply line.",
      },
      {
        q: "I ran out of propane. Now what?",
        a: "Call your gas supplier first; they'll want to check the whole system for leaks. Then call us if you need help getting your stove or fireplace going again.",
      },
      {
        q: "My wood stove won't draft. What can I do?",
        a: "If the chimney's just cold, light a fire starter and some kindling and close the door. That warms the flue enough to get a good draft going.",
      },
      {
        q: "What firewood should I burn?",
        a: "Local hardwoods work best, and oak, maple and ash top the list. Don't burn pellets in any of our wood-burning units.",
      },
      {
        q: "When does my door gasket need replacing?",
        a: "If your stove burns through wood too quickly, or the gasket is fraying or coming off the door, it's time to replace it.",
      },
      {
        q: "How long does a catalytic combustor last?",
        a: "Years, if you don't overfire your stove. Burning properly extends the life of any wood-burning unit, and once a combustor is falling apart, it needs replacing.",
      },
    ] satisfies ServiceQuestion[],
  },
};

/** Plain text from a bit of the copy's HTML, for structured data. */
export const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The page as the page list knows it: its words feed the site search. */
export const servicePage: Page = {
  slug: "services",
  title: service.title,
  metaTitle: service.metaTitle,
  description: service.description,
  sections: [
    {
      type: "prose",
      html: [
        `<p>${service.headline} ${service.intro}</p>`,
        ...service.sections.map((s) => `<h2>${s.heading}</h2>${s.lead ? `<p>${s.lead}</p>` : ""}${s.html}`),
        `<h2>${service.book.heading}</h2>`,
        ...service.book.items.map((i) => `<p>${i.label} ${i.html}</p>`),
        `<h2>${service.gasSmell.heading}</h2><p>${service.gasSmell.intro}</p>`,
        ...service.gasSmell.steps.map((s) => `<p>${s}</p>`),
        `<h2>${service.questions.heading}</h2>`,
        ...service.questions.items.map((i) => `<p>${i.q} ${i.a}</p>`),
      ].join("\n"),
    },
  ],
};
