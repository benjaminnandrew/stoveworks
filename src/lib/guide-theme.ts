import { business } from "@/content/site";

/**
 * Dresses a guide from the brain in the site's look as it's served.
 *
 * The guide pages are built in the brain with their own placeholder styling, and
 * the brain is Ben's to rebuild, so nothing here edits them at rest. Instead each
 * one gets, on the way out: the site's fonts in place of its own, the theme sheet
 * (public/styles/guide-theme.css) after its styles, the favicon, the store name
 * in the title, the badge in its header linking back to the site, the
 * installer's search box (public/scripts/guide-installer-search.js), and the
 * owner's yearly-care card first, with a way to book it (guide-owner-service.js).
 */

/** The site's type (Trail + serif): Barlow for labels and big lines, Literata for reading and headings. */
const FONTS =
  "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700" +
  "&family=Barlow+Semi+Condensed:wght@500;600;700&family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&display=swap";

const MIC = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;

/**
 * Ben, 22 Oct 2026: "a really obvious and easy to type and talk search box for the
 * installers side". At the top of the installer view, above the section bar; the
 * script wires it to the guide's own answers and manual pages.
 */
const INSTALLER_SEARCH = `<div class="sw-isearch" role="search">
  <label class="sw-isearch-label" for="sw-iq">Search this guide and its manual</label>
  <div class="sw-isearch-bar">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="sw-iq" type="search" placeholder="Type it, or tap Talk and say it" autocomplete="off" enterkeyhint="search" spellcheck="false">
    <button type="button" class="sw-italk" id="sw-italk" aria-pressed="false">${MIC}<span>Talk</span></button>
  </div>
  <p class="sw-isearch-try" id="sw-itry"></p>
  <div class="sw-isearch-results" id="sw-iresults" aria-live="polite"></div>
</div>
`;

const HEAD = `<link rel="stylesheet" href="/styles/guide-theme.css">
<link rel="icon" href="/icon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-icon.png">
`;

/**
 * Ben, 22 Oct 2026, on the Morsø 6143's "Annual check & summer care" card: "that's something
 * they can call Stoveworks for". public/scripts/guide-owner-service.js puts this under the guide's
 * yearly-care card, which it moves to the front of the owner's "Start here", and at the end of
 * that card's detail. The claim is the Services page's own: "We install and service stoves,
 * inserts and fireplaces."
 */
const SERVICE_CTA = `<template id="sw-service-cta"><div class="sw-service-cta">
  <p><strong>${business.name} services stoves, inserts and fireplaces.</strong> Call us to set up your yearly check.</p>
  <div class="sw-service-actions">
    <a class="sw-call" href="${business.phoneHref}">Call ${business.phoneDisplay}</a>
    <a href="mailto:${business.email}?subject=${encodeURIComponent("Yearly check")}">Email us</a>
    <a href="/services/">Our services &rarr;</a>
  </div>
</div></template>
`;

const HOME =`<a class="sw-home" href="/" aria-label="${business.name} home"><img src="/images/logo-badge-112.png" alt="" width="109" height="112"></a>`;

export function themeGuide(html: string): string {
  let out = html;

  // Their Google Fonts request becomes ours; if it's gone, add ours.
  const fontLink = /href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"/;
  out = fontLink.test(out)
    ? out.replace(fontLink, `href="${FONTS}"`)
    : out.replace("</head>", `<link rel="stylesheet" href="${FONTS}">\n</head>`);

  out = out.replace("</head>", `${HEAD}</head>`);
  out = out.replace(/<title>([^<]*)<\/title>/, (_, t: string) => `<title>${t} | ${business.name}</title>`);
  out = out.replace(/<header>/, `<header>\n  ${HOME}`);
  out = out.replace('<nav class="secnav" id="secNav"', `${INSTALLER_SEARCH}  <nav class="secnav" id="secNav"`);
  out = out.replace(
    "</body>",
    `${SERVICE_CTA}<script src="/scripts/guide-installer-search.js" defer></script>\n` +
      `<script src="/scripts/guide-owner-service.js" defer></script>\n</body>`,
  );

  return out;
}
