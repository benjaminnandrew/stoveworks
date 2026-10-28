/**
 * The type directions under review (Ben, 22 Oct 2026). Temporary: once one is
 * picked, its faces become the site's own and this file, the switcher and the
 * html[data-type] blocks at the end of globals.css go.
 */

export const TYPE_KEY = "sw-type";

/** The site's type unless a review picks another (Ben, 22 Oct: "that feels more like it"). */
export const DEFAULT_TYPE = "trail-serif";

export const DIRECTIONS = [
  { key: "current", label: "Before", faces: "Calistoga · Source Serif · Source Sans" },
  { key: "foundry", label: "Foundry", faces: "Besley (a Clarendon) · Libre Franklin" },
  { key: "nameplate", label: "Nameplate", faces: "Roboto Serif, condensed caps · Libre Franklin" },
  { key: "trail", label: "Trail sign", faces: "Barlow, condensed caps" },
  { key: "trail-serif", label: "Trail + serif", faces: "Barlow condensed caps · Literata for reading" },
] as const;

const keys = DIRECTIONS.map((d) => d.key);

/**
 * Runs before first paint. The server sends DEFAULT_TYPE; `?type=<key>` starts a
 * review in this browser (and picks that direction), remembered page to page.
 * "current" is the type from before the review, which removes the attribute.
 */
export const TYPE_BOOT = `try{var k=${JSON.stringify(TYPE_KEY)},ok=${JSON.stringify(keys)},q=new URLSearchParams(location.search).get('type');if(q&&ok.indexOf(q)>-1)localStorage.setItem(k,q);var t=localStorage.getItem(k);if(t==='current')delete document.documentElement.dataset.type;else if(t&&ok.indexOf(t)>-1)document.documentElement.dataset.type=t}catch(e){}`;
