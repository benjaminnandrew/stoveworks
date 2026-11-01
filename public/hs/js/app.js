// Hearth Studio — app shell: rooms, design state, panels, stage interaction, kiosk mode,
// estimate, saved ideas and the own-photo setup. Rendering lives in engine.js.
import { StoneEngine } from "./engine.js";
import * as G from "./geometry.js";
import * as ST from "./stoves.js";
import * as P from "./photo.js";
import * as PT from "./paint.js";
import * as Seg from "./segment.js";
import * as MG from "./maskgeom.js";
import * as LY from "./layout.js";

// ------------------------------------------------------------------ constants
const STORE = { name: "Hayward Stoveworks", site: "haywardstoveworks.com" };
// The site keeps the estimate from customers until its numbers are confirmed (HS_CONFIG.estimate:
// false; Ben, 28 Oct 2026). It's still worked out, and the staff panel's estimate settings stay.
const SHOW_ESTIMATE = window.HS_CONFIG?.estimate !== false;
const JOINTS = {
  dry: { label: "Dry stack", half: 0.07, note: "Stones set tight; almost no mortar shows." },
  standard: { label: "Standard joint", half: 0.25, note: "About ½″ mortar joints between stones." },
  overgrout: { label: "Overgrout", half: 0.5, note: "Mortar brushed over the stone edges." },
};
const MORTARS = [
  { id: "natural", label: "Natural gray", hex: "#9b968d" }, { id: "light", label: "Light gray", hex: "#bdb9b0" },
  { id: "buff", label: "Buff", hex: "#c2ae8c" }, { id: "tan", label: "Tan", hex: "#a38866" },
  { id: "white", label: "White", hex: "#ddd8cc" }, { id: "charcoal", label: "Charcoal", hex: "#4a4846" },
];
const ROOMS = [
  {
    id: "cabin", name: "Lake cabin great room", short: "Lake cabin", blurb: "Full-height chimney, raised hearth, wood stove",
    sizeNote: "This sample room has a 6 ft wide chimney breast running 9½ ft to the ceiling, on an 8 ft raised hearth. The numbers use those sizes.",
    variants: [{ id: "trad", label: "Traditional wood stove" }, { id: "modern", label: "Modern wood stove" }, { id: "open", label: "No stove", noFire: true }],
    stoves: true,          // catalog stoves stand on its empty hearth (variant "open")
    groups: [
      { id: "chimney", label: "Chimney", hint: "Face and both sides, hearth to ceiling", zones: ["chim_front", "chim_right", "chim_left"] },
      { id: "hearth", label: "Raised hearth", hint: "Front and sides, under the slab top", zones: ["hearth_front", "hearth_right", "hearth_left"] },
      { id: "wall", label: "Wall beside the chimney", hint: "Accent wall on both sides", zones: ["wall_back"] },
      { id: "pad", label: "Hearth pad", hint: "The slab the stove sits on", zones: ["hearth_top"], kind: "pad" },
    ],
    defaults: {
      chimney: { mode: "stone", stone: "black-frost-ledgestone", joint: "dry", mortar: "charcoal" },
      hearth: { mode: "stone", stone: "black-frost-ledgestone", joint: "dry", mortar: "charcoal" },
      wall: { mode: "off", paint: "warmwhite" },
      pad: { mode: "pad", pad: "gray" },
    },
  },
  {
    id: "linear", name: "Lake home family room", short: "Family room", blurb: "Linear gas fireplace, floating mantel",
    sizeNote: "This sample room has a 7 ft wide fireplace bump-out, 9 ft tall, around a 52 in linear gas fireplace. The numbers use those sizes.",
    // its own fireplace (the sample, so first), and the same room with an empty wall, rendered here (1 Nov 2026)
    variants: [{ id: "linear", label: "Linear gas fireplace" }, { id: "open", label: "No fireplace", noFire: true }],
    fireplaces: true,      // a catalog built-in fireplace's front goes on its empty wall, at any size (scene.json fireSpot)
    groups: [
      { id: "chase", label: "Fireplace wall", hint: "Face and sides of the bump-out", zones: ["chase_front", "chase_left", "chase_right"] },
      { id: "wall", label: "Wall beside the fireplace", hint: "Either side of the bump-out", zones: ["wall_back"] },
    ],
    defaults: {
      chase: { mode: "stone", stone: "chilton-tailored-blend", joint: "standard", mortar: "natural" },
      wall: { mode: "off", paint: "warmwhite" },
    },
  },
  {
    // a masonry fireplace with an open wood fire, for catalog inserts: built on the site's computer
    // with the room build (hearth-studio-build/, 1 Nov 2026)
    id: "masonry", name: "Lake house den", short: "Den", blurb: "Masonry fireplace, open wood fire, ready for an insert",
    sizeNote: "This sample room has a 6 ft wide chimney breast, 9 ft tall, on an 8 in raised hearth, around a 34 by 24 in fireplace opening. The numbers use those sizes.",
    variants: [{ id: "masonry", label: "Open wood fireplace" }],
    inserts: true,         // a catalog insert's front goes over the fireplace's opening, standing on its floor (scene.json fireSpot)
    groups: [
      { id: "breast", label: "Fireplace", hint: "Face and sides of the chimney breast", zones: ["breast_front", "breast_right", "breast_left"] },
      { id: "hearth", label: "Raised hearth", hint: "Front and sides, under the slab top", zones: ["hearth_front", "hearth_right", "hearth_left"] },
      { id: "wall", label: "Wall beside the fireplace", hint: "Either side of the chimney breast", zones: ["wall_back"] },
      { id: "pad", label: "Hearth pad", hint: "The slab in front of the fireplace", zones: ["hearth_top"], kind: "pad" },
    ],
    defaults: {
      breast: { mode: "stone", stone: "cabin-creek-river-rock", joint: "standard", mortar: "natural" },
      hearth: { mode: "stone", stone: "cabin-creek-river-rock", joint: "standard", mortar: "natural" },
      wall: { mode: "off", paint: "warmwhite" },
      pad: { mode: "pad", pad: "gray" },
    },
  },
];
// Hearth pad finishes. The slab keeps its rendered light, shadows and texture; only how dark it is changes
// (ratio = new color / the render's gray, in linear light).
const PADS = [
  { id: "gray", label: "Stock gray", hex: "#7b7d7e", ratio: [1, 1, 1] },
  { id: "charcoal", label: "Charcoal", hex: "#4a4c4f", ratio: [0.45, 0.45, 0.46] },
  { id: "black", label: "Black", hex: "#1f2022", ratio: [0.19, 0.19, 0.2] },
];
const isPad = (g) => (typeof g === "string" ? S.room?.groups.find((x) => x.id === g) : g)?.kind === "pad";
const padOf = (d) => PADS.find((p) => p.id === d?.pad) || PADS[0];
const DEFAULT_STONE = "black-frost-ledgestone";   // where a new area starts
const ATTRACT_STONES = ["black-frost-ledgestone", "fond-du-lac-castle-rock", "highland-scotch-siena", "chilton-tailored-blend", "barnwood-blue-ashlar", "antique-bronze-fieldstone"];

// ------------------------------------------------------------------ helpers
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hex2lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = () => rej(new Error("Could not load " + src)); i.src = src; });
const store = {
  get(k, d) { try { const v = localStorage.getItem("hs." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("hs." + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
const ICON = {
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  front: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="12" height="12" rx="1.5" stroke-dasharray="3 2.4"/><rect x="9" y="9" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity=".28"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20 15 9"/><path d="M14 3.5v3M12.5 5h3M19.5 8v2.4M18.3 9.2h2.4M18 14v2.4M16.8 15.2h2.4"/></svg>',
  ba: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M7 12h2M15 12h2"/></svg>',
  cmp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9h16M4 15h16M9 4v16M15 4v16"/></svg>',
  fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><rect x="8" y="8.5" width="8" height="7" rx="1"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4V14M12 17.2v.3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h3c4 0 6 10 10 10h3M17 14l3 3-3 3M4 17h3c1.6 0 2.8-1.6 3.8-3.6M14 7.5C15 6.6 16 7 17 7h3M17 4l3 3-3 3"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3.5M10.5 8v2.5M14.5 8v3.5M18.5 8v2.5"/></svg>',
  sizeangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  zin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/></svg>',
  zout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6"/></svg>',
  swatch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z"/></svg>',
  caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M13.5 6.5l3 3"/></svg>',
  points: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 18.5L7.5 6 18 8.5l1 9.5z"/><circle cx="5" cy="18.5" r="2" fill="currentColor"/><circle cx="7.5" cy="6" r="2" fill="currentColor"/><circle cx="18" cy="8.5" r="2" fill="currentColor"/><circle cx="19" cy="18" r="2" fill="currentColor"/></svg>',
  scribble: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 17.5c-2.5-2-3-6.5-.5-9.5s7.5-4 11-2 4 6.5 1.5 9.5-6.5 4.5-9.5 3.5"/><path d="M9 19.5l-2.5-2 2.6-1.6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6l-6 6 6 6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8"/><path d="M8.5 11H6.5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/></svg>',
};

// ------------------------------------------------------------------ usage counts (kept on this device; for the store, not customers)
function track(kind, id) {
  const st = store.get("stats", { since: new Date().toISOString().slice(0, 10), sessions: 0, photos: 0, quotes: 0, saves: 0, picks: {} });
  if (kind === "pick") st.picks[id] = (st.picks[id] || 0) + 1;
  else st[kind] = (st[kind] || 0) + 1;
  store.set("stats", st);
}

// ------------------------------------------------------------------ state
/** Staff settings. The showroom screen waits 10 minutes before asking "Still designing?"
 *  (customers stop to talk things over); screens set up with the old 75-second default move up to it. */
function loadSettings() {
  const s = Object.assign({ waste: 0.10, cornerCredit: 0.5, idle: 600 }, store.get("settings", {}));
  if (!(s.v >= 2)) { s.idle = Math.max(600, s.idle || 0); s.v = 2; store.set("settings", s); }
  return s;
}
const S = {
  mode: "web", tab: "stone",
  catalog: [], cat: new Map(),
  stoves: [], stoveMap: new Map(),   // the store's stove catalog (HS_CONFIG.stoveCatalogUrl)
  filters: { style: "All", tone: "All", q: "" },   // the stone list: Buechel collection, color tone, search words
  roomId: "cabin", variant: { cabin: "trad", linear: "linear", masonry: "masonry" }, light: "day",
  room: null,
  design: {},            // roomId -> {groupId: {...}}
  target: "all",
  selGroup: null, selT: 0, hoverGroup: null,
  compare: { mode: "off", split: 0.5, lookB: null, nameB: "" },
  grid: false,
  ideas: store.get("ideas", []),
  photo: null,           // own-photo room state
  settings: loadSettings(),
  attract: false, attractIdx: 0, attractT: 0, attractWipe: null,
  // paint colors: the area whose color panel is open, recent named or mixed colors,
  // and the "type or say a paint color" lookup
  paintFor: null, myPaints: [], mixOpen: false, lastPaintHow: "",
  lk: { q: "", state: "idle" }, lookupFn: null, lookupOff: false, canListen: false,
  flicker: false,
  hinted: store.get("hinted", false),
  kioskLocked: false,     // opened with #showroom: the screen stays in showroom mode
  lastInput: performance.now(),
};

let engine = null;
const LOOKUP = PT.createLookup();  // "type or say a paint color" (see paint.js for where it reaches Claude)
const sceneCache = new Map();   // key -> {sj, imgs}
const stoneLoads = new Map();   // id -> Promise
const stoveLoads = new Map();   // stove id -> Promise of its cutout
const stoveCuts = new Map();    // stove id -> {cut, tex}
const stage = $("#stage"), canvas = $("#gl"), overlay = $("#overlay");

// ------------------------------------------------------------------ boot
async function boot() {
  try {
    engine = new StoneEngine(canvas);
  } catch (e) {
    stage.innerHTML = `<div style="padding:24px;color:#eee">This device can't run the 3D preview (${esc(e.message)}). Try a recent Chrome, Edge or Safari.</div>`;
    return;
  }
  syncBg();
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(syncBg, 30)); } catch (e) { /* old browsers */ }
  new MutationObserver(() => setTimeout(syncBg, 30)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // the stove catalog's styles are in their own file, so the page file stays as it is
  if (!document.querySelector('link[data-hs="stoves"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/stoves.css"; l.dataset.hs = "stoves"; document.head.appendChild(l);
  }
  const stovesP = ST.loadCatalog(window.HS_CONFIG?.stoveCatalogUrl || "assets/stoves/stoves.json").catch(() => []);
  const cat = await (await fetch("assets/stone/catalog.json")).json();
  S.catalog = cat;
  cat.forEach((c) => S.cat.set(c.id, c));
  for (const r of ROOMS) S.design[r.id] = JSON.parse(JSON.stringify(r.defaults));
  const saved = store.get("design", null);
  if (saved && saved.cabin) {
    for (const [rid, d] of Object.entries(saved)) for (const g of Object.values(d || {})) if (g.mode === "stone" && !S.cat.has(g.stone)) g.stone = DEFAULT_STONE;
    Object.assign(S.design, saved);
  }
  S.stoves = await stovesP;
  S.stoves.forEach((s) => S.stoveMap.set(s.id, s));
  // no longer in the catalog, or not the kind that room shows
  for (const [rid, d] of Object.entries(S.design)) if (d && d.stove && !fitsRoom(S.stoveMap.get(d.stove.stoveId), roomDef(rid))) delete d.stove;
  // From a stove's page on the site ("See it in a room": ?stove=<id>): that stove on the lake cabin's
  // hearth, or that fireplace in the family room's wall, with its tab open (the site's, 28 and 31 Oct 2026)
  const linked = S.stoveMap.get(new URLSearchParams(location.search).get("stove"));
  const linkRoom = linked && ROOMS.find((r) => fitsRoom(linked, r));
  if (linkRoom && S.design[linkRoom.id]) {
    const was = S.design[linkRoom.id].stove;
    S.design[linkRoom.id].stove = { stoveId: linked.id, finish: null, x: 0, sizeK: was && was.stoveId === linked.id ? was.sizeK : 1 };
    S.tab = "stove";
  }
  S.myPaints = (store.get("paints", []) || []).filter((c) => c && PT.normHex(c.hex)).slice(0, 8);
  S.canListen = PT.canListen();
  downloadsCap();   // look up once so the Download button answers straight away
  LOOKUP.ready().then((fn) => { S.lookupFn = fn; if (S.tab === "areas" && S.paintFor) renderRail({ keep: true }); });
  renderChrome();
  await setRoom(linkRoom ? linkRoom.id : "cabin");
  // The showroom screen opens the page with #showroom and stays in showroom mode.
  const showroomLink = () => { if (location.hash === "#showroom" && S.mode !== "kiosk") { S.kioskLocked = true; setMode("kiosk"); } };
  showroomLink();
  window.addEventListener("hashchange", showroomLink);
  restorePhoto();
  window.addEventListener("resize", refit);
  // any touch, key or scroll counts as someone using the screen (the welcome screen itself starts on a tap: see enterAttract)
  ["pointerdown", "keydown", "wheel"].forEach((ev) => window.addEventListener(ev, () => { S.lastInput = performance.now(); }, { capture: true, passive: true }));
  requestAnimationFrame(loop);
  setInterval(idleCheck, 1000);
  setInterval(() => { if (S.attract) attractTick(performance.now()); }, 400);
}

/** Letterbox color follows the theme's stage color. */
function syncBg() {
  const c = getComputedStyle(document.querySelector(".stage-col")).backgroundColor.match(/[\d.]+/g);
  if (c && engine) { engine.bg = [c[0] / 255, c[1] / 255, c[2] / 255, 1]; invalidate(); }
}
function refit() { syncLayout(); sizeCanvas(); engine.fit(S.attract ? "cover" : "contain"); invalidate(); drawOverlay(); renderCard(); }
/** Showroom: the labeled picture tools sit in a row along the top of the picture when they fit
 *  beside the room chip; otherwise they stack down the right side. */
function layoutTools() {
  const tools = $("#stageTools"), chips = $("#chips");
  if (!tools || !chips) return;
  const setup = stage.classList.contains("setup");
  stage.classList.add("toolrow");
  const c = chips.getBoundingClientRect(), t = tools.getBoundingClientRect();
  if (S.mode !== "kiosk" || setup || t.width === 0 || c.right + 16 > t.left) stage.classList.remove("toolrow");
}
/** Layout flags: photo aspect on phones, setup mode, narrow picture. */
function syncLayout() {
  const narrow = window.matchMedia("(max-width: 860px)").matches;
  const photo = S.room?.kind === "photo";
  stage.style.aspectRatio = narrow && photo ? String(clamp(S.room.width / S.room.height, 0.62, 1.9)) : "";
  const setup = !!(S.photo?.wizard && S.roomId === "photo");
  stage.classList.toggle("setup", setup);
  stage.classList.toggle("scanning", setup && S.photo?.wizard?.step === "auto" && S.photo.auto?.state === "loading");
  $("#app").classList.toggle("setup", setup);
  stage.classList.toggle("narrow", stage.clientWidth < 560);
  layoutTools();
  if (!setup) stage.style.cursor = "";
}
function sizeCanvas() {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
  return false;
}

// ------------------------------------------------------------------ stones
function ensureStone(id) {
  if (!id || engine.hasStone(id)) return Promise.resolve();
  if (stoneLoads.has(id)) return stoneLoads.get(id);
  const c = S.cat.get(id);
  const base = `assets/stone/${id}/`;
  const p = Promise.all([loadImg(base + "albedo.jpg"), loadImg(base + "relief.jpg")])
    .then(([albedo, relief]) => splitRelief(relief).then(([height, dist]) => { engine.addStone(id, { albedo, height, dist, tileIn: c.tileIn, reliefIn: c.reliefIn, rowShuffle: c.rowShuffle }); invalidate(); }))
    .catch((e) => toast("Couldn't load that stone. Check the connection and try again."));
  stoneLoads.set(id, p);
  return p;
}
/** relief.jpg holds two grayscale tiles stacked: face height on top, distance to the joint below (see gen_stone.py). */
function splitRelief(img) {
  const w = img.naturalWidth, h = img.naturalHeight / 2;
  if (typeof createImageBitmap === "function") {
    const o = { colorSpaceConversion: "none", premultiplyAlpha: "none" };   // the numbers exactly as stored
    return Promise.all([createImageBitmap(img, 0, 0, w, h, o), createImageBitmap(img, 0, h, w, h, o)]).catch(() => splitByCanvas(img, w, h));
  }
  return Promise.resolve(splitByCanvas(img, w, h));
}
function splitByCanvas(img, w, h) {
  return [0, h].map((y) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, y, w, h, 0, 0, w, h); return c; });
}
function stonesInDesign(design) {
  return [...new Set(Object.values(design || {}).filter((g) => g.mode === "stone").map((g) => g.stone))];
}

// ------------------------------------------------------------------ rooms
function roomDef(id) { return ROOMS.find((r) => r.id === id); }

async function setRoom(id) {
  clearTransient();
  if (id !== S.roomId) { S.paintFor = null; stopLookup(true); S.lk = { q: "", state: "idle" }; cardSpot = null; }
  S.roomId = id;
  S.compare = { mode: "off", split: 0.5, lookB: null, nameB: "" };
  setCmpScene(null);
  if (id === "photo") { await buildPhotoRoom(); renderAll(); return; }
  busy(true);
  const def = roomDef(id);
  const variant = effectiveVariant(id);
  const entry = await sceneEntry(id, variant, S.light);
  await Promise.all([...stonesInDesign(S.design[id]).map(ensureStone), ensureStove(S.design[id]?.stove?.stoveId)]);
  const { sj, Lt, imgs } = entry;
  const old = S.room;
  // "No stove" (the empty-hearth render) keeps a stand-in fire glow in its evening light; its fire
  // map is that glow's share of each pixel, so the engine takes it out (flicker multiplier 0).
  const noFire = !!def.variants.find((v) => v.id === variant)?.noFire && !S.design[id]?.stove;
  const { tex, zones, vzones, scene } = sceneFor(entry, noFire);
  if (old && old.tex) disposeRoomTex(old);
  S.room = { kind: "scene", id, def, sj, light: Lt.light, width: sj.width, height: sj.height, tex, zones, vzones, groups: def.groups, noFire, variantId: variant, pick: buildPick(imgs.slice(3), sj) };
  if ((def.stoves && variant !== "open") || faceRoom(def)) prepSampleStove(S.room);   // a sample stove (or the room's own fireplace) can be tapped too
  engine.flick = 1;
  engine.setScene(scene);
  sizeCanvas(); engine.fit();
  if (S.target !== "all" && !def.groups.some((g) => g.id === S.target)) S.target = "all";
  busy(false);
  renderAll();
  invalidate();
}
/** A sample room's pictures for one version (stove) and light, loaded once. */
async function sceneEntry(id, variant, light) {
  const key = `${id}/${variant}/${light}`;
  let entry = sceneCache.get(key);
  if (entry) return entry;
  // checked with the server every time: the room's data has to match this app (a browser's day-old
  // copy from before update-2 had no stove light or shadows, so no stove was drawn; 28 Oct 2026)
  const sj = sceneCache.get(id + "/json") || await (await fetch(`assets/scenes/${id}/scene.json`, { cache: "no-cache" })).json();
  sceneCache.set(id + "/json", sj);
  const V = sj.variants[variant];
  const Lt = V.lights.find((l) => l.light === light) || V.lights[0];
  const base = `assets/scenes/${id}/`;
  const imgs = await Promise.all([loadImg(base + Lt.image), loadImg(base + Lt.irr), loadImg(base + Lt.grad), ...V.masks.map((m) => loadImg(base + m))]);
  const fireImg = Lt.fire ? await loadImg(base + Lt.fire).catch(() => null) : null;
  const shadeImg = V.shade ? await loadImg(base + V.shade).catch(() => null) : null;   // where each pixel is (for a stove's shadows)
  entry = { sj, Lt, V, imgs, fireImg, shadeImg, masksKey: `${id}/${variant}` };
  sceneCache.set(key, entry);
  return entry;
}
/** Its textures and the engine's scene for it. */
function sceneFor(entry, noFire) {
  const { sj, Lt, V, imgs, fireImg, shadeImg } = entry;
  const tex = {
    base: engine.texFromImage(imgs[0]),
    irr: engine.texFromImage(imgs[1]),
    grad: engine.texFromImage(imgs[2]),
    masks: imgs.slice(3).map((m) => engine.texFromImage(m)),
    fire: fireImg ? engine.texFromImage(fireImg) : null,
    shade: shadeImg ? engine.texFromImage(shadeImg, { linear: false }) : null,
  };
  const zones = sj.zones.map((z) => ({ ...z, grad: [0, 0] }));
  const vzones = zones.filter((z) => z.mask);        // visible faces go to the renderer; hidden ones still count in the estimate
  const scene = { width: sj.width, height: sj.height, base: tex.base, masks: tex.masks, irr: { tex: tex.irr, mode: 0, range: Lt.irrRange }, grad: { tex: tex.grad },
    fire: S.flicker || noFire ? tex.fire : null, noFire, composite: 0, drywall: sj.drywall, zones: vzones };
  if (tex.shade && sj.camera && sj.stoveSpot) {
    const cam = ST.roomCamera(sj);
    scene.stoveRoom = { shade: tex.shade, shadeSize: [shadeImg.naturalWidth, shadeImg.naturalHeight], distMax: V.distMax || 20,
      ray: cam.RtKi, C: cam.C, fwd: cam.fwd, f: cam.f, sunTo: sj.stoveSpot.sun_to, useSun: Lt.light === "day" };
  }
  return { tex, zones, vzones, scene };
}
/** Compare with an idea that shows another version of the room (another stove): its own picture. */
let cmpTex = null;
function setCmpScene(sb) {
  if (cmpTex) disposeRoomTex({ tex: cmpTex });
  cmpTex = sb ? sb.tex : null;
}

function disposeRoomTex(room) {
  const t = room.tex; if (!t) return;
  [t.base, t.irr, t.grad, t.fire, t.shade, ...(t.masks || [])].forEach((x) => x && engine.deleteTex(x));
}

/** Small CPU copy of the masks so a tap can tell which surface it hit. */
function buildPick(maskImgs, sj) {
  const w = 450, h = Math.round(450 * sj.height / sj.width);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const datas = maskImgs.map((m) => { ctx.clearRect(0, 0, w, h); ctx.drawImage(m, 0, 0, w, h); return ctx.getImageData(0, 0, w, h).data; });
  return { w, h, datas };
}

function zoneAtUV(u, v) {
  const room = S.room; if (!room || u < 0 || v < 0 || u > 1 || v > 1) return null;
  if (room.kind === "photo") {
    const x = u * room.width, y = v * room.height, ph = S.photo;
    if (!ph) return null;
    for (let k = ph.areas.length - 1; k >= 0; k--) for (const s of closedSecs(ph.areas[k])) if (pointInPoly([x, y], s.pts)) return ph.areas[k].id;
    return null;
  }
  const pk = room.pick;
  const x = Math.floor(u * pk.w), y = Math.floor(v * pk.h);
  let best = null, bv = 60;
  for (const z of room.zones) {
    if (!z.mask) continue;
    const d = pk.datas[z.mask[0]]; if (!d) continue;
    const val = d[(y * pk.w + x) * 4 + z.mask[1]];
    if (val > bv) { bv = val; best = z.id; }
  }
  return best;
}
function groupOfZone(zid) {
  const g = (S.room?.groups || []).find((g) => g.zones.includes(zid));
  return g ? g.id : null;
}
function pointInPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ------------------------------------------------------------------ design -> engine look
function currentDesign() { return S.design[S.roomId] || {}; }
function zoneLook(d) {
  if (!d || d.mode === "off") return { mode: "off" };
  if (d.mode === "pad") return d.pad && d.pad !== "gray" ? { mode: "tint", paint: padOf(d).ratio } : { mode: "off" };
  if (d.mode === "paint") return { mode: "paint", paint: hex2lin(paintOf(d).hex) };
  const sd = d.seed || 0;
  return { mode: "stone", stone: d.stone, joint: JOINTS[d.joint || "standard"].half, mortar: hex2lin((MORTARS.find((m) => m.id === d.mortar) || MORTARS[0]).hex), seed: sd, offU: (sd * 13.37) % 61, offV: sd ? (sd * 7.13) % 37 : 0 };
}
function lookFrom(design, room = S.room) {
  const zones = {};
  if (!room) return { zones };
  for (const g of room.groups) for (const zid of g.zones) zones[zid] = zoneLook(design[g.id]);
  return { zones, stove: stoveLook(design, room) };
}
// ------------------------------------------------------------------ catalog stoves (INTEGRATION.md, section 7)
// A room with a stove spot (the lake cabin) shows a catalog stove on its empty hearth: the room's
// "open" picture, with the stove drawn in by the engine. The sample stoves are the room's other pictures.
// A room with a fire spot (the family room) shows a catalog built-in fireplace's front over its own:
// the same picture, with the front drawn in (the site's, 31 Oct 2026). Once the room has an "open"
// picture too (an empty wall, asked of the chat 1 Nov 2026), the front goes on that instead.
// A room whose catalog items are fronts drawn flat on its wall: built-in fireplaces (the family room)
// or inserts in a fireplace's opening (the den, 1 Nov 2026)
const faceRoom = (def) => !!(def?.fireplaces || def?.inserts);
const onOpen = (def, design) => !!design?.stove && (!!def?.stoves || (faceRoom(def) && def.variants.some((v) => v.id === "open")));
function effectiveVariant(id) {
  return onOpen(roomDef(id), S.design[id]) ? "open" : S.variant[id];
}
/** Can this catalog stove go in this room: a freestanding stove on the cabin's hearth, a built-in
 *  fireplace in the family room's wall. */
function fitsRoom(st, def) {
  return !!st && !!def && (def.fireplaces ? st.kind === "fireplace" : def.inserts ? st.kind === "insert" : !!def.stoves && st.kind === "freestanding");
}
const catalogFor = (def) => S.stoves.filter((s) => fitsRoom(s, def));
/** Loads a stove's cutout once (and gets it ready to draw). */
function ensureStove(id) {
  if (!id || !S.stoveMap.has(id) || !engine) return Promise.resolve(null);
  if (stoveLoads.has(id)) return stoveLoads.get(id);
  const st = S.stoveMap.get(id);
  // the cutout's pixels are read (outline, halo clean-up), so a picture on another domain needs CORS
  const load = new Promise((res, rej) => {
    const i = new Image(); i.decoding = "async";
    try { if (new URL(st.image, location.href).origin !== location.origin) i.crossOrigin = "anonymous"; } catch (e) { /* relative path */ }
    i.onload = () => res(i); i.onerror = () => rej(new Error("Could not load " + st.image)); i.src = st.image;
  });
  const p = load.then((img) => {
    const cut = ST.prepCutout(img);
    const v = { cut, tex: engine.texFromImage(cut.canvas, { internal: "SRGB8_ALPHA8", mip: true }) };
    stoveCuts.set(id, v); stoveLookCache.clear(); invalidate();
    return v;
  }).catch(() => { stoveLoads.delete(id); return null; });
  stoveLoads.set(id, p);
  return p;
}
const stoveLookCache = new Map();
const padTo = (a, n) => { const o = (a || []).slice(0, n); while (o.length < n) o.push(o.length ? o[o.length - 1] : 1); return o; };
/** What the engine needs to draw a design's stove in a sample room (null when there's none). */
function stoveLook(design, room) {
  const d = design && design.stove;
  if (!d || room?.kind !== "scene" || !room.sj?.camera) return null;
  if (faceRoom(room.def)) return fireplaceLook(d.stoveId, room);
  if (!room.def?.stoves || !room.sj.stoveSpot) return null;
  const st = S.stoveMap.get(d.stoveId), c = stoveCuts.get(d.stoveId);
  if (!st || !c) return null;
  const k = clamp(d.sizeK || 1, ST.SIZE_MIN, ST.SIZE_MAX);
  const key = [room.id, room.light, d.stoveId, k.toFixed(4), d.x || 0].join("|");
  if (stoveLookCache.has(key)) return stoveLookCache.get(key);
  const pl = ST.placeInRoom(st, c.cut, room.sj, ST.roomCamera(room.sj), k, d.x || 0);
  const Lr = ST.roomLight(room.sj, room.light);
  const span = st.imageSpan || [c.cut.left / c.cut.w, (c.cut.right + 1) / c.cut.w];
  const eve = room.light === "eve";
  const val = {
    tex: c.tex, s: pl.place.s, tx: pl.place.tx, ty: pl.place.ty, ymap: pl.place.ymap, w: c.cut.w, h: c.cut.h, bbox: pl.place.bbox,
    glass: st.glassBox, span: [span[0], span[1], c.cut.top / c.cut.h, (c.cut.bot + 1) / c.cut.h],
    light: { front: Lr.front, side: Lr.side, prof: padTo(Lr.prof, 8), vprof: padTo(Lr.vprof, 5) },
    studio: 0.45, emis: eve ? 2.6 : 2.2, eve,
    ldir: eve ? [0.98, 0.14, 0.14] : (room.sj.stoveSpot.sun_to || [0.875, 0.368, 0.315]),
    caps: pl.pipe ? pl.pipe.caps : [], thimble: pl.pipe ? pl.pipe.thimble : null, pipeTop: pl.pipe ? pl.pipe.top : null,
    box: pl.box, foot: pl.foot, footZ: room.sj.stoveSpot.z, ao: eve ? [0.62, 0.3, 0.2, 0.1] : [0.55, 0.28, 0.2, 0.1],
  };
  if (stoveLookCache.size > 8) stoveLookCache.clear();
  stoveLookCache.set(key, val);
  return val;
}
/** A built-in fireplace's front over the room's own (stoves.js, placeFace). Null when it can't be
 *  drawn there: not loaded yet, or smaller than the room's own, which would show round it. A room
 *  with an empty-wall picture ("open") takes any size: the front goes on that. */
function fireplaceLook(id, room) {
  const st = S.stoveMap.get(id), c = stoveCuts.get(id);
  if (!fitsRoom(st, room.def) || !c || !room.sj.fireSpot) return null;
  const key = [room.id, room.light, id].join("|");
  if (stoveLookCache.has(key)) return stoveLookCache.get(key);
  const pl = ST.placeFace(st, c.cut, room.sj, ST.roomCamera(room.sj));
  const eve = room.light === "eve";
  const fits = pl.covers || room.def.variants.some((v) => v.id === "open");
  const val = fits ? { tex: c.tex, face: pl.H, bbox: pl.bbox, glass: st.glassBox, studio: 0.45, emis: eve ? 2.6 : 2.2, eve } : null;
  if (stoveLookCache.size > 8) stoveLookCache.clear();
  stoveLookCache.set(key, val);
  return val;
}
/** Is the stove at this spot of the picture (its outline, not the empty space round it)? */
function stoveAtUV(u, v) {
  const room = S.room; if (!room) return false;
  const L = stoveLook(currentDesign(), room); if (!L) return false;
  const x = u * room.width, y = v * room.height, b = L.bbox;
  if (x < b[0] || y < b[1] || x > b[2] || y > b[3]) return false;
  const c = stoveCuts.get(currentDesign().stove.stoveId); if (!c) return false;
  let cx, cy;
  if (L.face) {   // a fireplace's front: through its map to the photo, as the engine draws it
    const H = L.face, q = H.map((r) => r[0] * x + r[1] * y + r[2]);
    cx = Math.floor(q[0] / q[2] * c.cut.w); cy = Math.floor(q[1] / q[2] * c.cut.h);
  } else {
    // up the photo in its two parts, as the engine draws it (stoves.js, placeInRoom: ymap)
    const m = L.ymap, row = y >= m[1] ? m[4] + (y - m[1]) * (m[5] - m[4]) / Math.max(1e-6, m[2] - m[1]) : m[3] + (y - m[0]) * (m[4] - m[3]) / Math.max(1e-6, m[1] - m[0]);
    cx = Math.floor((x - L.tx) / L.s); cy = Math.floor(row);
  }
  if (cx < 0 || cy < 0 || cx >= c.cut.w || cy >= c.cut.h) return false;
  return c.cut.alpha[cy * c.cut.w + cx] > 128;
}
/** A sample stove is part of the room's own picture, so it has no outline of its own. It's where the
 *  empty-hearth picture's surfaces show and this picture's don't (the masks of "things in front"),
 *  which takes in its pipe and leaves out the firewood that's in both. Worked out once per picture.
 *  A room's own built-in fireplace is its box on the wall (scene.json fireSpot.cover), on screen. */
async function prepSampleStove(room) {
  const fs = room.sj.fireSpot, pk = room.pick;
  if (fs && room.sj.camera) {
    const cam = ST.roomCamera(room.sj), [x0, z0, x1, z1] = fs.cover;
    const quad = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => { const p = cam.project([x, fs.y, z]); return [p[0] * pk.w / room.width, p[1] * pk.h / room.height]; });
    const at = new Uint8Array(pk.w * pk.h);
    for (let i = 0; i < at.length; i++) at[i] = pointInPoly([i % pk.w + 0.5, Math.floor(i / pk.w) + 0.5], quad) ? 1 : 0;
    room.sampleStove = at;
    return;
  }
  const V = room.sj.variants.open; if (!V) return;
  const key = `${room.id}/open/masks`;
  const imgs = sceneCache.get(key) || await Promise.all(V.masks.map((m) => loadImg(`assets/scenes/${room.id}/${m}`))).catch(() => null);
  if (!imgs) return;
  sceneCache.set(key, imgs);
  const open = buildPick(imgs, room.sj);
  const shows = (p, i) => room.zones.some((z) => z.mask && p.datas[z.mask[0]]?.[i * 4 + z.mask[1]] > 60);
  const at = new Uint8Array(pk.w * pk.h);
  for (let i = 0; i < at.length; i++) at[i] = shows(open, i) && !shows(pk, i) ? 1 : 0;
  room.sampleStove = at;
}
function sampleStoveAtUV(u, v) {
  const room = S.room, at = room?.sampleStove;
  if (!at || currentDesign().stove || u < 0 || v < 0 || u >= 1 || v >= 1) return false;
  if (faceRoom(room.def) && !catalogFor(room.def).length) return false;   // none of ours to put there yet
  return at[Math.floor(v * room.pick.h) * room.pick.w + Math.floor(u * room.pick.w)] === 1;
}
/** The empty hearth keeps a stand-in fire glow in its evening picture: with no stove it goes. */
function applyFire() {
  const r = S.room; if (r?.kind !== "scene" || !engine.scene) return;
  const noFire = !!r.def.variants.find((x) => x.id === r.variantId)?.noFire && !currentDesign().stove;
  r.noFire = noFire;
  engine.scene.noFire = noFire;
  engine.scene.fire = S.flicker || noFire ? r.tex.fire : null;
}
async function pickStove(v) {
  const r = S.room; if (r?.kind !== "scene" || !(r.def?.stoves || faceRoom(r.def))) return;
  const d = currentDesign();
  if (v === "none" || r.def.variants.some((x) => x.id === v)) {   // no stove, or the room's own
    delete d.stove;
    S.variant[r.id] = v === "none" ? "open" : v;
  } else {
    const st = S.stoveMap.get(v);
    if (!fitsRoom(st, r.def)) return;
    if (!(await ensureStove(v))) { toast(`Couldn't load that ${ST.kindWord(st)}'s picture. Try again.`); return; }
    if (faceRoom(r.def) && !fireplaceLook(v, r)) {
      toast(r.def.inserts ? "That one's front doesn't cover this fireplace's opening, so it can't be shown here." : "That one's smaller than this room's own fireplace, so it can't be shown here yet.");
      return;
    }
    d.stove = { stoveId: v, finish: null, x: 0, sizeK: d.stove && d.stove.stoveId === v ? d.stove.sizeK : 1 };
    track("stoves", v);
  }
  persist();
  if (effectiveVariant(r.id) !== r.variantId) await setRoom(r.id);   // the hearth empties or fills: another picture
  else { applyFire(); invalidate(); renderRail({ keep: true }); if (cardFor?.gid === STOVE_CARD) renderCard(); }
}
/** Stove size: v is log2(size) x 100, so each step is the same feel, half size to double. */
function stoveSize(v) {
  const d = currentDesign(); if (!d.stove) return;
  v = clamp(Math.round(v), SZ_LO, SZ_HI);
  d.stove.sizeK = +(2 ** (v / 100)).toFixed(4);
  persist(); invalidate();
  const st = S.stoveMap.get(d.stove.stoveId);
  // the Stove tab's control and the stove's card on the picture (st_ and stc_) move together
  for (const [k, box] of [["st", "#railBody"], ["stc", "#acard"]]) {
    const o = $(`#${k}_out`), dr = $(`#${k}_drawn`), sl = $(`#${k}_size`), rb = $(`${box} [data-a="stovereset"]`);
    if (o) o.textContent = `${Math.round(d.stove.sizeK * 100)}%`;
    if (dr && st) dr.textContent = stoveDrawnText(st, d.stove.sizeK);
    if (sl && Number(sl.value) !== v) sl.value = v;
    if (rb) rb.disabled = v === 0;
  }
}
document.addEventListener("input", (ev) => { if (ev.target && (ev.target.id === "st_size" || ev.target.id === "stc_size")) stoveSize(Number(ev.target.value)); });
// Stove size folds away (Ben, 28 Oct 2026): closed when the page loads, then open or closed in the
// Stove tab and the stove's card together until the next load. (toggle doesn't bubble: caught here)
document.addEventListener("toggle", (ev) => {
  if (!ev.target.matches?.("details[data-stsize]")) return;
  S.stSizeOpen = ev.target.open;
  document.querySelectorAll("details[data-stsize]").forEach((d) => { if (d.open !== S.stSizeOpen) d.open = S.stSizeOpen; });
  const card = ev.target.closest("#acard"); if (card && cardFor) placeCard(card);   // it grew or shrank: keep it in the picture
}, true);
/** The Room tab's line about the stove that's showing. */
function stoveNow(r) {
  const d = S.design[r.id] || {}, st = d.stove && S.stoveMap.get(d.stove.stoveId);
  if (st) return ST.stoveName(st);
  const v = S.variant[r.id], vd = r.def?.variants.find((x) => x.id === v);
  return vd ? (v === "open" ? vd.label : `Sample ${vd.label.toLowerCase()}`) : "";   // "No stove", "No fireplace"
}
/** Send to the store's "Heat source", from the stove in the design. */
function heatGuess() {
  const d = currentDesign(), st = d.stove && S.stoveMap.get(d.stove.stoveId);
  if (st) return st.kind === "insert" ? "Fireplace insert" : { wood: "Wood stove", gas: "Gas stove or fireplace" }[st.fuel] || "Not sure yet";
  if (S.room?.def?.stoves && S.variant[S.room.id] === "open") return "Stone only, no stove";
  return "Not sure yet";
}
const SZ_LO = Math.round(Math.log2(ST.SIZE_MIN) * 100), SZ_HI = Math.round(Math.log2(ST.SIZE_MAX) * 100);   // slider units: log2(size) x 100
const stoveDrawnText = (st, k) => ST.drawnSize(st, k) + (!st.sized ? ". Size not on file yet, drawn by eye" : ST.byEye(st, k) ? ", set by eye" : "");

const stCard = (id, pressed, pic, name, l2, l3) => `<button class="stcard" data-a="stovepick" data-v="${esc(id)}" aria-pressed="${pressed}">
      <span class="pic">${pic}</span><span class="t"><b>${name}</b>${l2 ? `<span>${l2}</span>` : ""}${l3 ? `<span class="sz">${l3}</span>` : ""}</span></button>`;
const catalogCard = (s, cur) => stCard(s.id, cur === s.id, `<img src="${esc(s.image)}" alt="" loading="lazy">`, esc(ST.stoveName(s)), esc(ST.fuelWord(s)), esc(ST.makerSize(s) || "Size not on file yet"));
function stovePanel() {
  const r = S.room;
  if (r?.kind === "photo") return `<div class="group"><h2 class="h">Stove</h2>
      <p class="sub">Stoves on your own photo are coming next. For now, try our stoves on the hearth in the lake cabin.</p>
      <div class="row"><button class="btn" data-a="room" data-v="cabin">Go to the lake cabin</button></div></div>`;
  if (faceRoom(r?.def) && catalogFor(r.def).length) return fireplacePanel(r);
  if (!r?.def?.stoves) return `<div class="group"><h2 class="h">Stove</h2>
      <p class="sub">This room has ${r?.def?.inserts ? "an open wood fireplace" : "a built-in gas fireplace"}. Try our stoves on the hearth in the lake cabin.</p>
      <div class="row"><button class="btn" data-a="room" data-v="cabin">Go to the lake cabin</button></div></div>`;
  const d = currentDesign(), cur = d.stove ? d.stove.stoveId : null, v = S.variant[r.id];
  const cards = catalogFor(r.def).map((s) => catalogCard(s, cur)).join("");
  const none = stCard("none", !cur && v === "open", `<i class="hearthglyph" aria-hidden="true"></i>`, "No stove", "Just the stone", "");
  const samples = [["trad", "Traditional"], ["modern", "Modern"]].map(([id, nm]) => stCard(id, !cur && v === id, `<i class="sample s-${id}" aria-hidden="true"></i>`, `${nm} wood stove`, "Sample drawing", "")).join("");
  const st = cur && S.stoveMap.get(cur);
  return `<div class="group"><h2 class="h">Stove</h2>
      <p class="sub">Put a stove from our catalog on the hearth. ${S.mode === "kiosk" ? "Tap one to try it." : "Pick one to try it."}</p></div>
    <div class="stoves">${cards}${none}</div>
    ${st ? stoveDetail(st, d.stove) : ""}
    <div class="group"><div class="eyebrow">Sample stoves</div><div class="stoves samples">${samples}</div>
      <p class="note">Drawings for scale, not specific models.</p></div>`;
}
/** The family room's Fireplace tab (our built-in fireplaces, in place of the room's own), and the
 *  den's Insert tab (our inserts, in its fireplace's opening). */
function fireplacePanel(r) {
  const d = currentDesign(), cur = d.stove ? d.stove.stoveId : null, own = r.def.variants[0], ins = !!r.def.inserts;
  const st = cur && S.stoveMap.get(cur);
  return `<div class="group"><h2 class="h">${ins ? "Insert" : "Fireplace"}</h2>
      <p class="sub">${ins ? "Put one of our inserts in this fireplace, its front over the opening." : "Put one of our fireplaces in this wall, in place of the room's own."} ${S.mode === "kiosk" ? "Tap one to try it." : "Pick one to try it."}</p></div>
    <div class="stoves">${catalogFor(r.def).map((s) => catalogCard(s, cur)).join("")}</div>
    ${st ? stoveDetail(st, d.stove) : ""}
    <div class="group"><div class="eyebrow">${ins ? "No insert" : "Sample fireplace"}</div><div class="stoves samples">${stCard(own.id, !cur, `<i class="sample s-${esc(own.id)}" aria-hidden="true"></i>`, esc(own.label), "The room's own", "")}</div>
      <p class="note">${ins ? "An open wood fire, drawn for scale." : "Drawn for scale, not a specific model."}</p></div>`;
}
function stoveDetail(st, ds) {
  const k = S.mode === "kiosk", sk = clamp(ds.sizeK || 1, ST.SIZE_MIN, ST.SIZE_MAX), v = Math.round(Math.log2(sk) * 100);
  const word = ST.kindWord(st);   // a built-in fireplace or an insert is drawn at its viewing area's size: no size control
  return `<div class="detail stdetail">
    <div class="top"><span class="stpic"><img src="${esc(st.image)}" alt="${esc(ST.stoveName(st))}"></span>
      <div style="min-width:0;display:flex;flex-direction:column;gap:6px">
        <div class="eyebrow">${esc(st.brand)}${st.brand ? " · " : ""}${esc(ST.fuelWord(st))}</div>
        <h3 class="h" style="font-size:24px">${esc(st.name)}</h3>
        ${st.onDisplay ? `<span class="note">On display in our showroom</span>` : ""}</div></div>
    <dl class="facts"><dt>Maker's size</dt><dd>${esc(ST.makerSize(st) || "Not on file yet")}</dd></dl>
    ${word !== "stove" ? "" : `<details class="stsize" data-stsize${S.stSizeOpen ? " open" : ""}>
      <summary class="fl"><span class="lb">Stove size</span><output id="st_out">${Math.round(sk * 100)}%</output></summary>
      <div class="stbody">
      <div class="fc"><button class="fstep" data-a="stovestep" data-v="-1" aria-label="Stove size: smaller">${ICON.minus}</button>
        <input type="range" id="st_size" aria-label="Stove size" min="${SZ_LO}" max="${SZ_HI}" step="1" value="${v}">
        <button class="fstep" data-a="stovestep" data-v="1" aria-label="Stove size: bigger">${ICON.plus}</button></div>
      <div class="fe" aria-hidden="true"><span>smaller</span><span>bigger</span></div>
      <p class="drawn" id="st_drawn">${esc(stoveDrawnText(st, sk))}</p>
      <div class="row"><button class="btn small" data-a="stovereset"${v === 0 ? " disabled" : ""}>${ICON.reset}${st.sized ? "Back to the maker's size" : "Back to the starting size"}</button></div>
      </div>
    </details>`}
    <div class="stmore">
      <p class="note">Shown for size and style. Ask us about clearances and installation.</p>
      ${st.pageUrl ? (k
        ? `<div class="row"><button class="btn small" data-a="stoveqr" data-v="${esc(st.id)}">${ICON.phone}More about this ${word} on your phone</button></div>`
        : `<a href="${esc(st.pageUrl)}" target="_blank" rel="noopener">More about this ${word}</a>`) : ""}
    </div>
  </div>`;
}
/** Showroom: our page for the stove goes to the customer's phone. */
function openStoveLink(id) {
  const st = S.stoveMap.get(id), url = ST.pageForPhone(st, STORE.site); if (!url) return;
  openLayer(`<div class="hd"><div><div class="eyebrow">${esc(STORE.name)}</div><h2 class="h">${esc(ST.stoveName(st))} on your phone</h2>
      <p class="sub">Point your phone's camera at the code to open our page for this ${ST.kindWord(st)}.</p></div>${closeBtn}</div>
    <div class="row" style="gap:24px;align-items:center">
      <div class="qr" aria-label="QR code">${qrSVG(url)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0"><div class="eyebrow">Or type</div><div class="note" style="font-size:1em;word-break:break-all">${esc(url.replace(/^https?:\/\//, ""))}</div>
        <p class="note">Clearances, installation, venting: ask anyone here.</p></div></div>`);
}
/** The stove's card on the picture: tap the stove to size it, change it or take it away, like an
 *  area's card (Ben, 28 Oct 2026). A sample stove (part of the room's own picture) gets a shorter
 *  one. Empty when no stove stands there. In the family room it's the fireplace's: ours, or the
 *  room's own (31 Oct 2026). */
function stoveCardHTML() {
  const r = S.room; if (r?.kind !== "scene" || !(r.def?.stoves || faceRoom(r.def))) return "";
  const fp = faceRoom(r.def), ins = !!r.def.inserts, word = ins ? "insert" : fp ? "fireplace" : "stove";
  if (fp && !catalogFor(r.def).length) return "";   // none of ours to try in its place yet
  const ds = currentDesign().stove, st = ds && S.stoveMap.get(ds.stoveId);
  const actions = `<button class="hb primary" data-a="cardstoves">${ICON.swatch}<span>Change ${word}</span></button>
      ${!fp ? `<button class="hb" data-a="stovepick" data-v="none">${ICON.trash}<span>No stove</span></button>`
        : st ? `<button class="hb" data-a="stovepick" data-v="${esc(r.def.variants[0].id)}">${ICON.reset}<span>${ins ? "No insert" : "The room's own"}</span></button>` : ""}`;
  if (!st) {
    const vd = !ds && r.variantId !== "open" && r.def.variants.find((x) => x.id === r.variantId);
    return vd ? `<div class="agrip" data-tip="Drag to move this box" aria-hidden="true"></div><div class="ahd">
      <i class="atile sample s-${esc(vd.id)}" aria-hidden="true"></i>
      <div class="at"><div class="k">${ins ? "No insert" : `Sample ${word}`}</div><div class="v">${esc(vd.label)}</div><div class="m plain">${ins ? "An open wood fire, drawn for scale." : "Drawn for scale, not a specific model."}</div></div>
      <button class="hb" data-a="closecard" aria-label="Close">${ICON.x}</button></div>
    <div class="aacts">${actions}</div>
    ${catalogFor(r.def).length ? `<p class="fnote">Change ${word} to try one of ours, drawn at the maker's size.</p>` : ""}` : "";
  }
  const k = S.mode === "kiosk", sk = clamp(ds.sizeK || 1, ST.SIZE_MIN, ST.SIZE_MAX), v = Math.round(Math.log2(sk) * 100);
  return `<div class="agrip" data-tip="Drag to move this box" aria-hidden="true"></div><div class="ahd">
      <img class="stthumb" src="${esc(st.image)}" alt="">
      <div class="at"><div class="k">${esc(st.brand)}${st.brand ? " · " : ""}${esc(ST.fuelWord(st))}</div><div class="v">${esc(st.name)}</div><div class="m">${esc(ST.makerSize(st) || "Size not on file yet")}</div></div>
      <button class="hb" data-a="closecard" aria-label="Close">${ICON.x}</button></div>
    ${fp ? "" : `<details class="stcsize" data-stsize${S.stSizeOpen ? " open" : ""}>
      <summary><span class="lb">Stove size</span><output id="stc_out">${Math.round(sk * 100)}%</output></summary>
      <div class="fitrow">
      <div class="fc"><button class="hb fstep" data-a="stovestep" data-v="-1" aria-label="Stove size: smaller">${ICON.minus}</button>
        <input type="range" id="stc_size" aria-label="Stove size" min="${SZ_LO}" max="${SZ_HI}" step="1" value="${v}">
        <button class="hb fstep" data-a="stovestep" data-v="1" aria-label="Stove size: bigger">${ICON.plus}</button></div>
      <div class="fe" aria-hidden="true"><span>smaller</span><span>bigger</span></div></div>
      <p class="fnote" id="stc_drawn">${esc(stoveDrawnText(st, sk))}</p>
      <div class="aacts"><button class="hb" data-a="stovereset"${v === 0 ? " disabled" : ""}>${ICON.reset}<span>${st.sized ? "Back to the maker's size" : "Back to the starting size"}</span></button></div>
    </details>`}
    <div class="aacts">${actions}</div>
    <p class="fnote">Shown for size and style. Ask us about clearances and installation.${st.pageUrl && !k ? ` <a class="stlink" href="${esc(st.pageUrl)}" target="_blank" rel="noopener">More about this ${word}</a>` : ""}</p>
    ${st.pageUrl && k ? `<div class="aacts"><button class="hb" data-a="stoveqr" data-v="${esc(st.id)}">${ICON.phone}<span>More about this ${word} on your phone</span></button></div>` : ""}`;
}

function persist() { syncLinks(); if (S.mode !== "kiosk") store.set("design", { cabin: S.design.cabin, linear: S.design.linear, masonry: S.design.masonry }); }

// "Same as" links: an area set to "Same as Chimney" follows the chimney until it's tapped off, or
// until the customer changes that area directly. d.link = {to, was (its own look before), sig}.
const FINISH_KEYS = ["mode", "stone", "joint", "mortar", "paint", "paintColor", "_jointSet", "_mortarSet"];
function finishOf(d) { const f = {}; for (const k of FINISH_KEYS) if (d && d[k] !== undefined) f[k] = d[k]; return JSON.parse(JSON.stringify(f)); }
const finishSig = (d) => JSON.stringify(["mode", "stone", "joint", "mortar", "paint", "paintColor"].map((k) => d?.[k] ?? null));
function setFinish(d, f) { for (const k of FINISH_KEYS) delete d[k]; Object.assign(d, JSON.parse(JSON.stringify(f))); }
function syncLinks(design = currentDesign()) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const d of Object.values(design || {})) {
      const L = d?.link; if (!L) continue;
      const src = design[L.to];
      if (!src || src === d || src.mode === "off") { delete d.link; continue; }
      const mine = finishSig(d), theirs = finishSig(src);
      if (mine === theirs) { L.sig = theirs; continue; }
      if (mine !== L.sig) { delete d.link; continue; }          // changed directly: it has its own look now
      setFinish(d, finishOf(src)); L.sig = theirs; moved = true;   // the source changed: follow it
    }
    if (!moved) break;
  }
}

function applyToTargets(fn) {
  const d = currentDesign();
  const groups = S.room.groups.filter((g) => !g.kind).map((g) => g.id);
  const targets = S.target === "all" || isPad(S.target) ? groups.filter((g) => d[g]?.mode === "stone") : [S.target];
  if (!targets.length && S.target === "all") targets.push(groups[0]);
  for (const g of targets) { d[g] = d[g] || { mode: "stone" }; fn(d[g], g); }
  persist();
}

// ------------------------------------------------------------------ render loop
let dirty = true, animUntil = 0;
function invalidate(ms = 0) { dirty = true; if (ms) animUntil = Math.max(animUntil, performance.now() + ms); }
function loop(t) {
  requestAnimationFrame(loop);
  if (!engine || !S.room) return;
  if (sizeCanvas()) { engine.fit(S.attract ? "cover" : "contain"); drawOverlay(); dirty = true; }
  const fireOn = !!(engine.scene && engine.scene.fire) && !engine.scene.noFire;
  if (fireOn) engine.flick = 1 + 0.055 * Math.sin(t * 0.0071) + 0.035 * Math.sin(t * 0.0173 + 1.3) + 0.025 * Math.sin(t * 0.0411 + 0.7);
  const flickerOnly = fireOn && !dirty && t >= animUntil && !S.attractWipe;
  const animating = t < animUntil || !!S.attractWipe || (fireOn && !document.hidden);
  if (!dirty && !animating) return;
  if (flickerOnly && t - (loop.last || 0) < 33) return;   // firelight alone: ~30 fps is plenty
  loop.last = t;
  dirty = false;
  const look = lookFrom(currentDesign());
  const sel = selectionWeights(t);
  const opts = { time: t / 1000, sel, ...photoRenderOpts() };
  if (S.attract && S.attractWipe) {
    const w = S.attractWipe;
    const k = clamp((t - w.t0) / 1400, 0, 1);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    engine.render(w.from, { ...opts, sel: [], compare: { mode: "look", split: e, lookB: w.to } });
    if (k >= 1) S.attractWipe = null;
    return;
  }
  engine.grid = S.grid;
  engine.render(look, { ...opts, compare: S.compare.mode === "off" ? null : { ...S.compare, lookB: S.compare.lookB } });
}
function selectionWeights(t) {
  const room = S.room; const w = [];
  if (!room) return w;
  const zones = room.vzones || room.zones;
  zones.forEach((z, k) => {
    const g = groupOfZone(z.id);
    let v = 0;
    if (g && g === S.selGroup) { const age = (t - S.selT) / 1000; v = age < 2.2 ? Math.max(0, 1 - Math.max(0, age - 1.2)) : 0; }
    if (g && g === S.hoverGroup) v = Math.max(v, 0.55);
    w[k] = v;
  });
  return w;
}

// ------------------------------------------------------------------ chrome (top bar, stage tools, chips)
function renderChrome() {
  const k = S.mode === "kiosk";
  $("#topActions").innerHTML = `
    <button class="btn" data-a="${k ? "startover" : "startoverweb"}" data-tip="Start over">${ICON.reset}<span class="lbl-long">Start over</span></button>
    <button class="btn" data-a="photo">${ICON.cam}<span>Use my photo</span></button>
    ${k ? `<button class="btn" data-a="phone">${ICON.phone}<span class="lbl-long">Send to my phone</span></button>
           <button class="btn" data-a="help">${ICON.help}<span class="lbl-long">Ask for help</span></button>`
        : `<button class="btn" data-a="ideas">${ICON.heart}<span class="lbl-long">My ideas</span><span class="pill-n">${S.ideas.length ? `(${S.ideas.length})` : ""}</span></button>`}
    <div class="mode-switch"${S.kioskLocked ? " hidden" : ""}><span class="lbl">Preview as</span>
      <div class="seg" role="group" aria-label="Preview as">
        <button data-a="mode" data-v="web" aria-pressed="${!k}">Website</button>
        <button data-a="mode" data-v="kiosk" aria-pressed="${k}">Showroom</button>
      </div></div>`;
  const setup = !!(S.photo?.wizard && S.roomId === "photo");
  // picture tools: icons with quick labels on the website; icon and word on the showroom screen
  const tool = (a, icon, word, tip, pressed) => `<button class="tool" data-a="${a}" data-tip="${tip}" aria-label="${tip}"${pressed === undefined ? "" : ` aria-pressed="${pressed}"`}>${icon}<span class="tl">${word}</span></button>`;
  $("#stageTools").innerHTML = (setup ? [
    tool("zoomin", ICON.zin, "Zoom in", "Zoom in"),
    tool("zoomout", ICON.zout, "Zoom out", "Zoom out"),
    tool("fit", ICON.fit, "Fit picture", "Fit the picture to the screen"),
  ] : [
    tool("before", ICON.ba, "Before &amp; after", "Before and after", S.compare.mode === "before"),
    tool("comparepick", ICON.cmp, "Compare", "Compare two ideas", S.compare.mode === "look"),
    tool("saveidea", ICON.heart, "Save idea", "Save this idea"),
    tool("fit", ICON.fit, "Fit picture", "Fit the picture to the screen"),
  ]).join("") + (k ? tool("fullscreen", ICON.full, "Full screen", "Full screen") : "");
  layoutTools();
  if (!SHOW_ESTIMATE && S.tab === "estimate") S.tab = "stone";
  $("#tabs").innerHTML = [["stone", "Stone"], ["finish", "Finish"], ["stove", faceRoom(S.room?.def) && catalogFor(S.room.def).length ? (S.room.def.inserts ? "Insert" : "Fireplace") : "Stove"], ["areas", "Areas"], ["room", "Room"], ...(SHOW_ESTIMATE ? [["estimate", "Estimate"]] : [])]
    .map(([id, l]) => `<button role="tab" data-a="tab" data-v="${id}" aria-selected="${S.tab === id}">${l}</button>`).join("");
  $("#railFoot").innerHTML = k
    ? `<button class="btn" data-a="phone">${ICON.phone}Send to my phone</button><button class="btn primary" data-a="send">${ICON.send}Get a quote</button>`
    : `<button class="btn" data-a="saveimg">${ICON.share}Save &amp; share</button><button class="btn primary" data-a="send">${ICON.send}Send to the store</button>`;
}

function renderChips() {
  const r = S.room; const chips = [];
  const label = r?.kind === "photo" ? "Your photo" : `Sample room · ${esc(roomDef(S.roomId)?.short || "")}`;
  chips.push(`<button class="chip roombtn" data-a="roompick" aria-haspopup="menu" aria-expanded="${roomPopOpen}">${label}${ICON.caret}</button>`);
  chips.push(`<span class="chip"><span class="dot"></span>Sample stone textures</span>`);
  if (S.compare.mode === "look") chips.push(`<span class="chip">Comparing with “${esc(S.compare.nameB)}”</span>`);
  $("#chips").innerHTML = chips.join("");
  layoutTools();
}

function renderCaption() {
  const r = S.room; if (!r) return;
  const d = currentDesign();
  const gid = S.selGroup || (S.target !== "all" ? S.target : r.groups.find((g) => d[g.id]?.mode === "stone")?.id);
  const g = r.groups.find((x) => x.id === gid);
  let html = "";
  if (g) {
    const a = d[g.id] || {};
    const what = g.kind === "pad" ? esc(padOf(a).label) : a.mode === "stone" ? `${esc(S.cat.get(a.stone)?.name || "")}` : a.mode === "paint" ? `Painted · ${esc(paintName(a))}` : "No stone";
    const meta = a.mode === "stone" ? `${JOINTS[a.joint || "standard"].label}${a.joint === "dry" ? "" : " · " + esc(MORTARS.find((m) => m.id === a.mortar)?.label || "") + " mortar"}` : "";
    html = `<div class="cap"><div class="k">${esc(g.label)}</div><div class="v">${what}</div>${meta ? `<div class="m">${meta}</div>` : ""}</div>`;
  }
  if (!S.hinted && r.kind === "scene") {
    const tap = r.groups.map((x) => x.label.toLowerCase().replace("wall beside the ", "wall by the ")).slice(0, 2);
    // a catalog stove on the hearth has its own card too; so does the family room's fireplace (with
    // the bump-out alone before it: "fireplace" three times over reads badly)
    if (stoveCardHTML()) { if (r.def?.fireplaces) tap.splice(1); tap.push(r.def?.inserts ? "insert" : r.def?.fireplaces ? "fireplace" : "stove"); }
    html += `<div class="cap" style="max-width:40%;text-align:right"><div class="m" style="color:#e9e6df">Tap the ${tap.length > 2 ? `${tap.slice(0, -1).join(", ")} or ${tap[tap.length - 1]}` : tap.join(" or ")} to change it</div></div>`;
  }
  $("#caption").innerHTML = html;
}

/** The stone on what "Change stone on" points at (the first stone area when it's "All"). */
function curStoneId() {
  const d = currentDesign();
  return S.target === "all" ? Object.values(d).find((g) => g.mode === "stone")?.stone : d[S.target]?.stone;
}
/** The strip under the picture: the same stones as the list on the Stone tab (it follows the filters). */
function renderQuick() {
  const cur = curStoneId(), el = $("#quick");
  const list = filteredStones();
  let last = null, html = "";
  for (const c of list) {
    if (S.filters.style === "All" && c.collection !== last) { html += `<span class="qsep" aria-hidden="true">${esc(c.collection)}</span>`; last = c.collection; }
    html += `<button class="qs" data-a="stone" data-v="${c.id}" aria-pressed="${c.id === cur}"><img src="assets/stone/${c.id}/thumb.jpg" alt="" loading="lazy"><span>${esc(c.name)}</span></button>`;
  }
  el.innerHTML = html || `<span class="qnone">No stones match those filters. <button class="linkbtn" data-a="fclear">Show all stones</button></span>`;
  // keep the stone that's on the picture in view
  const on = el.querySelector('.qs[aria-pressed="true"]');
  if (on) el.scrollLeft += on.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - on.offsetWidth) / 2;
}

// ------------------------------------------------------------------ room picker on the picture
let roomPopOpen = false;
function toggleRoomPop(force) {
  roomPopOpen = force ?? !roomPopOpen;
  let el = $("#roompop");
  if (!roomPopOpen) { if (el) el.hidden = true; renderChips(); return; }
  if (!el) { el = document.createElement("div"); el.id = "roompop"; el.className = "roompop"; el.setAttribute("role", "menu"); stage.appendChild(el); }
  const n = S.photo ? doneAreas().length : 0;
  el.innerHTML = ROOMS.map((rd) => `<button class="rp" role="menuitem" data-a="room" data-v="${rd.id}" aria-current="${S.roomId === rd.id}">
      <img src="assets/scenes/${rd.id}/${rd.variants[0].id}_day.jpg" alt=""><span><b>${esc(rd.short)}</b><span>Sample room · ${esc(rd.blurb)}</span></span></button>`).join("")
    + (S.photo ? `<button class="rp" role="menuitem" data-a="room" data-v="photo" aria-current="${S.roomId === "photo"}"><img src="${S.photo.thumb}" alt=""><span><b>Your photo</b><span>${n ? `${n} area${n === 1 ? "" : "s"} outlined` : "Not outlined yet"}</span></span></button>` : "")
    + `<button class="rp" role="menuitem" data-a="photo"><i>${ICON.cam}</i><span><b>${S.photo ? "Use a different photo" : "Use my photo"}</b><span>Any phone photo, including iPhone</span></span></button>`
    + (S.photo && S.mode !== "kiosk" ? `<button class="rp small" role="menuitem" data-a="forgetphoto"><span>Remove my photo from this browser</span></button>` : "");
  el.hidden = false;
  renderChips();
}
document.addEventListener("pointerdown", (e) => { if (roomPopOpen && !e.target.closest("#roompop, .roombtn")) toggleRoomPop(false); }, true);
/** Clear anything that belongs to the moment: magnifier, brush, tips, cards, menus, a drag in progress. */
function clearTransient() {
  try { if (typeof wd !== "undefined" && wd) wizardCancel(true); } catch (e) { /* not started yet */ }
  hideLoupe(); drawBrush(null); hideTip(); closeCard();
  if (roomPopOpen) toggleRoomPop(false);
}

function renderAll() {
  syncLayout(); renderChrome(); renderChips(); renderCaption(); renderQuick(); renderRail(); renderHud(); drawOverlay(); renderCard(); invalidate();
}

// ------------------------------------------------------------------ rail panels
function renderRail(opt) {
  const body = $("#railBody");
  const keep = opt?.keep ? body.scrollTop : null;
  if (S.room?.kind === "photo" && S.photo?.wizard) { body.innerHTML = wizardPanel(); bindWizardPanel(); return; }
  const t = S.tab;
  if (S.paintFor && (t !== "areas" || !S.room?.groups.some((g) => g.id === S.paintFor) || currentDesign()[S.paintFor]?.mode !== "paint")) S.paintFor = null;
  const paint = t === "areas" && S.paintFor;
  body.innerHTML = paint ? paintPanel(S.paintFor) : t === "stone" ? stonePanel() : t === "finish" ? finishPanel() : t === "areas" ? areasPanel() : t === "room" ? roomPanel() : t === "stove" ? stovePanel() : estimatePanel();
  if (t === "finish") drawJointDiagrams();
  if (paint) bindPaintPanel();
  if (keep != null) body.scrollTop = keep;
}

function targetPills() {
  const r = S.room;
  const opts = [["all", "All stone areas"], ...r.groups.filter((g) => !g.kind).map((g) => [g.id, g.label])];
  return `<div class="group"><div class="eyebrow">Change stone on</div><div class="pills">${opts.map(([id, l]) => `<button class="pill" data-a="target" data-v="${id}" aria-pressed="${S.target === id}">${esc(l)}</button>`).join("")}</div></div>`;
}

// ------------------------------------------------------------------ the stone catalog: every Buechel building-stone veneer
// Buechel's collections, in the order a customer meets them, with a plain-words line and a little drawing of the pattern.
const rects = (list, rx) => list.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`).join("");
const STYLES = [
  { id: "Ledgestone", line: "Thin strips, stacked tight", art: rects([[1, 1, 9, 3], [11, 1, 13, 3], [25, 1, 10, 3], [1, 5, 14, 2.5], [16, 5, 8, 2.5], [25, 5, 10, 2.5], [1, 8.5, 6, 3.5], [8, 8.5, 12, 3.5], [21, 8.5, 14, 3.5], [1, 13, 11, 3], [13, 13, 10, 3], [24, 13, 11, 3], [1, 17, 8, 2.5], [10, 17, 14, 2.5], [25, 17, 10, 2.5], [1, 20.5, 12, 2.5], [14, 20.5, 9, 2.5], [24, 20.5, 11, 2.5]], 0.4) },
  { id: "Fieldledge", line: "Stacked stones of mixed heights", art: rects([[1, 1, 12, 6], [14, 1, 9, 6], [24, 1, 11, 6], [1, 8, 7, 4], [9, 8, 15, 4], [25, 8, 10, 4], [1, 13, 14, 10], [16, 13, 10, 6], [16, 20, 10, 3], [27, 13, 8, 10]], 1) },
  { id: "Tailored Fieldledge", line: "Straight-cut strips in three heights", art: rects([[1, 1, 15, 3], [17, 1, 18, 3], [1, 5, 10, 6], [12, 5, 23, 6], [1, 12, 20, 3], [22, 12, 13, 3], [1, 16, 9, 7], [11, 16, 24, 7]], 0.3) },
  { id: "Ashlar", line: "Squares and rectangles, mixed sizes", art: rects([[1, 1, 10, 7], [12, 1, 8, 3], [12, 5, 8, 3], [21, 1, 14, 7], [1, 9, 7, 6], [9, 9, 14, 6], [24, 9, 11, 2.5], [24, 12.5, 11, 2.5], [1, 16, 13, 7], [15, 16, 8, 3], [15, 20, 8, 3], [24, 16, 11, 7]], 0.8) },
  { id: "Castle Rock", line: "Big, chunky blocks", art: rects([[1, 1, 15, 10], [17, 1, 18, 10], [1, 12, 10, 11], [12, 12, 13, 11], [26, 12, 9, 11]], 2) },
  { id: "Dimensional", line: "Clean-cut rectangles in set heights", art: rects([[1, 1, 12, 3], [1, 5, 12, 6], [14, 1, 10, 10], [25, 1, 10, 4.5], [25, 6.5, 10, 4.5], [1, 13, 8, 10], [10, 13, 14, 4], [10, 18, 14, 5], [25, 13, 10, 10]], 0.2) },
  { id: "Mosaic", line: "Irregular shapes fitted together", art: `<path d="M1 1h10l1 6-5 4H1zM13 1h9l-2 8-7-1zM23 1h12v8l-6 2-7-2zM1 12l7-1 5 5-3 7H1zM9 10l6 1 4 6-6 1zM16 18l4-7 9 1-1 7-6 4zM30 12h5v11h-6l1-5z"/>` },
];
const styleArt = (s) => `<svg class="art" viewBox="0 0 36 24" aria-hidden="true">${s.art}</svg>`;
// Buechel files every stone under one or more color tones
const TONES = ["Arctic", "Earth", "Fiery", "Honey", "Shadow", "Sky"];
const toneWords = (c) => (c.tones || []).join(" & ") + ((c.tones || []).length ? " tones" : "");
// a hint of what each tone name means (Buechel's names; the dots are only a guide)
const TONE_DOTS = {
  Arctic: ["#e2e0d9", "#c8c6bf", "#a8a6a0"], Earth: ["#a88b6c", "#8a6a4f", "#6b5240"], Fiery: ["#c07a46", "#a8583c", "#86473a"],
  Honey: ["#d8c18f", "#c6a165", "#ad8650"], Shadow: ["#6a6c70", "#48494c", "#2c2d2f"], Sky: ["#9ea6b2", "#76808f", "#7b7090"],
};
const toneSwatch = (t) => `<span class="tdots" aria-hidden="true">${(TONE_DOTS[t] || []).map((h) => `<i style="background:${h}"></i>`).join("")}</span>`;
const normQ = (s) => String(s || "").toLowerCase().replace(/grey/g, "gray").replace(/[^a-z0-9%]+/g, " ").trim();
/** Does a stone pass the filters? skip: leave one filter out (to count what picking it would show). */
function stoneMatches(c, f, skip) {
  if (skip !== "style" && f.style !== "All" && c.collection !== f.style) return false;
  if (skip !== "tone" && f.tone !== "All" && !c.tones?.includes(f.tone)) return false;
  const q = normQ(f.q);
  if (q) {
    c._hay ||= normQ([c.name, c.collection, c.cut, c.stoneType, ...(c.colorWords || []), ...(c.tones || []).map((t) => t + " tones")].join(" "));
    if (!q.split(" ").every((w) => c._hay.includes(w))) return false;
  }
  return true;
}
/** The stones the filters let through, grouped by style in the order of STYLES. */
function filteredStones() {
  const order = new Map(STYLES.map((s, i) => [s.id, i]));
  return S.catalog.filter((c) => stoneMatches(c, S.filters)).sort((a, b) => (order.get(a.collection) ?? 99) - (order.get(b.collection) ?? 99) || a.name.localeCompare(b.name));
}

function stonePanel() {
  const curId = curStoneId();
  const cur = S.cat.get(curId);
  if (S.room?.kind === "photo" && S.photo && !doneAreas().length) return photoEmpty();
  return `
    ${S.room?.kind === "photo" && S.photo ? photoRow() : ""}
    ${targetPills()}
    ${cur ? stoneDetail(cur) : `<p class="sub">Pick a stone below to put it on the ${S.target === "all" ? "fireplace" : esc(S.room.groups.find((g) => g.id === S.target)?.label.toLowerCase())}.</p>`}
    <div class="group catbrowse">
      <div class="cathead"><h2 class="h">All Buechel stone veneers</h2><span class="note">${S.catalog.length} stones</span></div>
      <label class="search">${ICON.search}<span class="sr">Search the stones</span><input type="search" id="catQ" placeholder="Search by name or color" value="${esc(S.filters.q)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>
      <div class="facets" id="catFacets">${catFacets()}</div>
    </div>
    <div class="catresults" id="catResults">${catResults(curId)}</div>
    <p class="note">Stone names, colors, sizes and coverage are Buechel Stone's. The textures are generated samples until the store loads photographed swatches.</p>`;
}
function catFacets() {
  const f = S.filters;
  const nStyle = (id) => S.catalog.filter((c) => (id === "All" || c.collection === id) && stoneMatches(c, f, "style")).length;
  const nTone = (t) => S.catalog.filter((c) => (t === "All" || c.tones?.includes(t)) && stoneMatches(c, f, "tone")).length;
  const n = S.catalog.filter((c) => stoneMatches(c, f)).length;
  const any = f.style !== "All" || f.tone !== "All" || !!normQ(f.q);
  const styleBtn = (id, body, cnt) => `<button class="sty" data-a="fstyle" data-v="${esc(id)}" aria-pressed="${f.style === id}"${cnt || f.style === id ? "" : " disabled"}>${body}<span class="ct">${cnt}</span></button>`;
  return `<div class="eyebrow">Style</div>
    <div class="stys" role="group" aria-label="Style">
      ${styleBtn("All", `<span class="art all" aria-hidden="true">All</span><b>All styles</b>`, nStyle("All"))}
      ${STYLES.map((s) => styleBtn(s.id, `${styleArt(s)}<b>${esc(s.id)}</b>`, nStyle(s.id))).join("")}
    </div>
    <div class="eyebrow">Color family</div>
    <div class="pills tones" role="group" aria-label="Color family">
      <button class="pill" data-a="ftone" data-v="All" aria-pressed="${f.tone === "All"}">All colors</button>
      ${TONES.map((t) => { const k = nTone(t); return `<button class="pill tone" data-a="ftone" data-v="${t}" aria-pressed="${f.tone === t}"${k || f.tone === t ? "" : " disabled"}>${toneSwatch(t)}${t}<span class="ct">${k}</span></button>`; }).join("")}
    </div>
    <div class="catcount" role="status"><span><b>${n}</b> of ${S.catalog.length} stones${any ? "" : ", by style"}</span>${any ? `<button class="btn small" data-a="fclear">${ICON.reset}Show all</button>` : ""}</div>`;
}
function catResults(curId) {
  const list = filteredStones();
  if (!list.length) return `<div class="catempty"><p class="sub">No stones match${normQ(S.filters.q) ? ` “${esc(S.filters.q.trim())}”` : ""}${S.filters.style !== "All" ? ` in ${esc(S.filters.style)}` : ""}${S.filters.tone !== "All" ? ` in ${esc(S.filters.tone)} tones` : ""}.</p>
    <button class="btn" data-a="fclear">${ICON.reset}Show all stones</button></div>`;
  return STYLES.map((s) => [s, list.filter((c) => c.collection === s.id)]).filter(([, l]) => l.length).map(([s, l]) => `
    <section class="catgroup" aria-label="${esc(s.id)}">
      <h3 class="gh">${styleArt(s)}<span><b>${esc(s.id)}</b><span class="note">${esc(s.line)} · ${l.length}</span></span></h3>
      <div class="grid">${l.map((c) => `<button class="card" data-a="stone" data-v="${c.id}" aria-pressed="${c.id === curId}">
        <img src="assets/stone/${c.id}/thumb.jpg" alt="" loading="lazy"><span class="badge">Sample</span>
        <span class="t"><span class="n">${esc(c.name)}</span><span class="c">${esc(toneWords(c))}</span></span></button>`).join("")}</div>
    </section>`).join("");
}
/** Filters changed: redraw the counts, the list and the strip, but not the search box (it keeps the keyboard). */
function refreshCatalog() {
  const f = $("#catFacets"), r = $("#catResults");
  if (f) f.innerHTML = catFacets();
  if (r) r.innerHTML = catResults(curStoneId());
  renderQuick();
}

function photoRow() {
  const n = doneAreas().length;
  const sel = S.target !== "all" ? S.photo.areas.find((a) => a.id === S.target) : null;
  if (helperOn()) {
    return `<div class="photorow wrap"><img src="${S.photo.thumb}" alt=""><span><b>Your photo</b><span class="note">${n} area${n === 1 ? "" : "s"} outlined. Tap one on the picture to change it.</span></span>
      <div class="acts">${fitBtn(sel?.id)}${photoHelperBtns()}</div></div>`;
  }
  return `<div class="photorow wrap"><img src="${S.photo.thumb}" alt=""><span><b>Your photo</b><span class="note">${n} area${n === 1 ? "" : "s"} outlined. Tap one on the picture to change it.</span></span>
    <div class="acts">${fitBtn(sel?.id)}<button class="btn small" data-a="editsurf" data-v="${(sel || doneAreas()[0]).id}">${ICON.pen}Edit outlines</button></div></div>`;
}
const photoHelperBtns = () => `<button class="btn small" data-a="autoreopen">${ICON.pen}Fix the outline</button><button class="btn small" data-a="autorescan">${ICON.scan}Scan again</button>`;
const fitBtn = (id) => `<button class="btn small" data-a="fitopen" data-v="${esc(id || "")}">${ICON.sizeangle}Size &amp; angle</button>`;
function photoEmpty() {
  return `<div class="group"><h2 class="h">Nothing outlined yet</h2><p class="sub">Outline the part of your wall that should get stone, then pick a stone for it.</p>
    <div class="row"><button class="btn primary" data-a="editsurf" data-v="${S.photo.areas[0]?.id || ""}">${ICON.pen}Outline an area</button>
    <button class="btn" data-a="room" data-v="cabin">Back to the sample rooms</button></div></div>`;
}
/** Buechel's coverage for a stone, in a sentence (from its spec sheet). */
function coverageText(c) {
  const cov = c.coverage;
  if (!cov) return "Ask us: Buechel's site has no spec sheet for this stone yet";
  const b = cov.flat_sqft_per_box || {}, t = cov.per_ton || {};
  if (cov.dryOnly && b.dry) return `${b.dry} sq ft per small box, figured for dry stack (Buechel's spec sheet)`;
  const parts = [];
  if (b.standard) parts.push(`${b.standard} sq ft per small box of thin veneer`);
  if (t.standard && c.veneer !== "thin") parts.push(`${t.standard} sq ft per ton of full veneer`);
  return parts.length ? `${parts.join(", ")}, with standard joints (Buechel's spec sheet)` : "The store confirms it from Buechel's chart";
}
const VENEER_WORDS = { both: "Thin veneer or full veneer", thin: "Thin veneer only", full: "Full veneer only" };
function stoneDetail(c) {
  const k = S.mode === "kiosk";
  const sib = (c.siblings || []).map((id) => S.cat.get(id)).filter(Boolean);
  return `<div class="detail">
    <div class="top"><img src="assets/stone/${c.id}/thumb.jpg" alt="">
      <div style="min-width:0;display:flex;flex-direction:column;gap:6px">
        <div class="eyebrow">Buechel Stone · ${esc(c.collection)}</div>
        <h3 class="h" style="font-size:24px">${esc(c.name)}</h3>
        <div class="tonerow"><span class="swatches" aria-hidden="true">${(c.swatchColors || []).map((h) => `<i style="background:${h}"></i>`).join("")}</span><span class="note">${esc(toneWords(c))}</span></div>
      </div></div>
    <dl class="facts">
      <dt>Colors</dt><dd>${esc((c.colorWords || []).join(", "))}</dd>
      <dt>Sizes</dt><dd>${esc(c.sizes || "On Buechel's spec sheet")}</dd>
      ${c.stoneType ? `<dt>Stone</dt><dd>${esc(c.stoneType)}</dd>` : ""}
      <dt>Comes as</dt><dd>${VENEER_WORDS[c.veneer] || "Ask us"}</dd>
      <dt>Coverage</dt><dd>${esc(coverageText(c))}</dd>
    </dl>
    ${sib.length ? `<div class="sibs"><div class="eyebrow">Same stone, other cuts</div><div class="sibrow">${sib.map((s) => `<button class="sib" data-a="stone" data-v="${s.id}" title="${esc(s.name)}"><img src="assets/stone/${s.id}/thumb.jpg" alt="" loading="lazy"><span>${esc(s.cut)}</span></button>`).join("")}</div></div>` : ""}
    <p class="note">${k
      ? `Sample texture. Buechel's website has all the details: <button class="linkbtn" data-a="stoneqr" data-v="${c.id}">open it on your phone</button>. Ask us any questions about your job.`
      : `Sample texture. Go to <a href="${esc(c.url)}" target="_blank" rel="noopener">Buechel's website</a> for all details. Stop in our shop for any questions on your job.`}</p>
    ${!k && c.specUrl ? `<div class="row links"><a href="${esc(c.specUrl)}" target="_blank" rel="noopener">Buechel's spec sheet (PDF)</a></div>` : ""}
  </div>`;
}
/** Showroom: a Buechel page can't open on the shop's screen, so it goes to the customer's phone. */
function openStoneLink(id) {
  const c = S.cat.get(id); if (!c) return;
  openLayer(`<div class="hd"><div><div class="eyebrow">Buechel Stone</div><h2 class="h">${esc(c.name)} on your phone</h2>
      <p class="sub">Point your phone's camera at the code to open Buechel's page for this stone: colors, sizes, spec sheet and photos.</p></div>${closeBtn}</div>
    <div class="row" style="gap:24px;align-items:center">
      <div class="qr" aria-label="QR code">${qrSVG(c.url)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0"><div class="eyebrow">Or type</div><div class="note" style="font-size:1em;word-break:break-all">${esc(c.url.replace(/^https:\/\//, ""))}</div>
        <p class="note">Questions about your job? Ask anyone here.</p></div></div>`);
}

function finishPanel() {
  const d = currentDesign();
  const gid = S.target === "all" ? Object.keys(d).find((g) => d[g]?.mode === "stone") : S.target;
  const a = d[gid] || { joint: "standard", mortar: "natural" };
  const photo = S.room?.kind === "photo";
  return `
    ${targetPills()}
    ${finishResetRow()}
    <div class="group"><div class="eyebrow">Joint style</div>
      <div class="options">${Object.entries(JOINTS).map(([id, j]) => `
        <button class="opt" data-a="joint" data-v="${id}" aria-pressed="${a.joint === id}">
          <canvas width="160" height="96" data-joint="${id}"></canvas><b>${j.label}</b><span>${j.note}</span></button>`).join("")}</div>
      <p class="note">Joint style changes how much stone you need: Buechel lists less coverage per box for dry stack and more for overgrout.</p>
      ${S.cat.get(a.stone)?.coverage?.dryOnly ? `<p class="note">Buechel's coverage for ${esc(S.cat.get(a.stone).name)} is figured for dry stack only.</p>` : ""}
    </div>
    <div class="group"><div class="eyebrow">Mortar color</div>
      ${a.joint === "dry" ? `<p class="note">Dry stack shows almost no mortar. Pick a color if you switch to a mortar joint.</p>` : ""}
      <div class="dots">${MORTARS.map((m) => `<button class="dotbtn" data-a="mortar" data-v="${m.id}" aria-pressed="${a.mortar === m.id}"><i style="background:${m.hex}"></i>${m.label}</button>`).join("")}</div>
    </div>
    <div class="group"><div class="eyebrow">Stone layout</div>
      <div class="row"><button class="btn" data-a="shuffle">${ICON.shuffle}Shuffle the stones</button></div>
      <p class="note">Natural stone never repeats. Shuffle to see a different lay of the same stone.</p>
    </div>
    ${photo && doneAreas().length ? `<div class="group"><div class="eyebrow">Stone size &amp; angle</div>
      <p class="sub">Stones look too big or too small, or the rows don't run with your wall? Adjust them right on your photo.</p>
      <div class="row">${fitBtn(S.target !== "all" ? S.target : "")}</div></div>` : ""}
    ${photo ? photoLightControls() : sceneLightControls()}`;
}

function sceneLightControls() {
  return `<div class="group"><div class="eyebrow">Time of day</div>
    <div class="seg" role="group" aria-label="Time of day">
      <button data-a="light" data-v="day" aria-pressed="${S.light === "day"}">Daylight</button>
      <button data-a="light" data-v="eve" aria-pressed="${S.light === "eve"}">${S.room?.noFire ? "Evening" : "Evening, fire lit"}</button></div>
    <p class="note">Stone changes a lot with light. Evening shows it under lamps${S.room?.noFire ? "" : " and firelight"}.</p>
    ${S.light === "eve" && !S.room?.noFire ? `<label class="row" style="gap:8px"><input type="checkbox" id="flickerChk" ${S.flicker ? "checked" : ""}> Let the firelight flicker</label>` : ""}</div>`;
}

function photoLightControls() {
  const L = S.photo.light;
  const guess = autoWall(S.photo.lightData?.stats);
  return `<div class="group"><div class="eyebrow">What's on the wall now?</div>
    <div class="pills">${WALLS.map(([id, label]) => `<button class="pill" data-a="wallkind" data-v="${id}" aria-pressed="${(L.wall || "auto") === id}">${id === "auto" ? `${label} (${WALLS.find((w) => w[0] === guess)[1].toLowerCase()})` : label}</button>`).join("")}</div>
    <p class="note">The stone's brightness is worked out from your wall. A wood or brick wall reflects less light than paint, so telling us keeps the stone from looking too dark.</p></div>
    <div class="group"><div class="eyebrow">Match your room's light</div>
    ${slider("expo", "Brightness", L.expo, 0.4, 2, 0.02, (v) => `${Math.round(v * 100)}%`)}
    ${slider("warmth", "Warmth", L.warmth, -1, 1, 0.02, (v) => (v > 0.05 ? "warmer" : v < -0.05 ? "cooler" : "neutral"))}
    ${slider("relief", "Stone depth", L.relief, 0, 2, 0.05, (v) => `${Math.round(v * 100)}%`)}
    ${slider("ldir", "Light comes from", L.dir, -180, 180, 1, (v) => dirName(v))}
    ${slider("lstr", "Side light strength", L.str, 0, 1.2, 0.02, (v) => `${Math.round(v * 100)}%`)}
    <button class="btn small" data-a="lightauto">Reset to what the photo shows</button></div>`;
}
const dirName = (deg) => { const n = ["right", "upper right", "above", "upper left", "left", "lower left", "below", "lower right"]; return n[((Math.round(deg / 45) % 8) + 8) % 8]; };
const slider = (id, label, v, min, max, step, fmtv) => `<div class="slider"><label for="s_${id}">${label}</label><output id="o_${id}">${fmtv(v)}</output>
  <input type="range" id="s_${id}" data-s="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;

function areasPanel() {
  const d = currentDesign(); const r = S.room;
  const photo = r.kind === "photo";
  if (photo && S.photo && !doneAreas().length) return photoEmpty();
  return `<div class="group"><h2 class="h">Areas in this room</h2><p class="sub">Tap a surface on the picture, or set each one here.</p>
      ${photo && helperOn() ? `<div class="row">${photoHelperBtns()}</div>` : ""}</div>
    ${r.groups.map((g) => {
      const a = d[g.id] || { mode: "off" };
      if (g.kind === "pad") return `<div class="area ${S.selGroup === g.id ? "sel" : ""}">
        <div class="hd"><div><b>${esc(g.label)}</b><div class="note">${esc(g.hint || "")}</div></div></div>
        ${padChoices(g.id, a, "padpick")}</div>`;
      const st = S.cat.get(a.stone);
      return `<div class="area ${S.selGroup === g.id ? "sel" : ""}">
        <div class="hd"><div><b>${esc(g.label)}</b><div class="note">${esc(g.hint || "")}</div></div></div>
        <div class="seg" role="group" aria-label="${esc(g.label)}">
          <button data-a="gmode" data-g="${g.id}" data-v="stone" aria-pressed="${a.mode === "stone"}">Stone</button>
          <button data-a="gmode" data-g="${g.id}" data-v="paint" aria-pressed="${a.mode === "paint"}">Paint</button>
          <button data-a="gmode" data-g="${g.id}" data-v="off" aria-pressed="${a.mode === "off"}">As is</button></div>
        ${a.mode === "stone" && st ? `<button class="mini btn ghost" data-a="editgroup" data-v="${g.id}" style="justify-content:flex-start;padding:6px"><img src="assets/stone/${st.id}/thumb.jpg" alt=""><span><b style="color:var(--fg)">${esc(st.name)}</b><br>${JOINTS[a.joint].label}${a.joint === "dry" ? "" : " · " + esc(MORTARS.find((m) => m.id === a.mortar)?.label) + " mortar"}${a.link ? ` · same as ${esc((r.groups.find((x) => x.id === a.link.to)?.label || "").toLowerCase())}` : ""}</span></button>` : ""}
        ${a.mode === "paint" ? `<button class="mini btn ghost" data-a="paintfor" data-v="${g.id}" style="justify-content:flex-start;padding:6px"><i class="ptile" style="background:${paintOf(a).hex}"></i><span><b style="color:var(--fg)">${esc(paintName(a))}</b><br>Change color</span></button>` : ""}
        ${photo ? `<div class="row">${a.mode === "stone" ? fitBtn(g.id) : ""}<button class="btn small" data-a="editsurf" data-v="${g.id}">${ICON.pen}Edit outline</button><button class="btn small" data-a="addsec" data-v="${S.photo.areas.findIndex((x) => x.id === g.id)}">${ICON.plus}Add section</button><button class="btn small ghost" data-a="delsurf" data-v="${g.id}">${ICON.trash}Delete</button></div>` : ""}
      </div>`;
    }).join("")}
    ${photo ? `<button class="btn" data-a="addsurf">${ICON.plus}Add an area at a different angle</button>
      <p class="note">Add the chimney sides or a hearth as separate areas. Each one gets its own angle. To add another piece of the same wall, use Add section.</p>` : ""}`;
}

/** The hearth pad's finishes as three big swatches. */
function padChoices(gid, d, action) {
  const cur = padOf(d).id;
  return `<div class="padopts" role="group" aria-label="Hearth pad finish">${PADS.map((p) => `<button class="padopt" data-a="${action}" data-g="${gid}" data-v="${p.id}" aria-pressed="${cur === p.id}"><i style="background:${p.hex}"></i><span>${p.label}</span></button>`).join("")}</div>`;
}
function setPad(gid, v) {
  const d = currentDesign();
  d[gid] = { mode: "pad", pad: PADS.some((p) => p.id === v) ? v : "gray" };
  persist(); select(gid); renderCaption(); renderCard();
  if (S.tab === "areas") renderRail({ keep: true });
  invalidate(600);
}

// ------------------------------------------------------------------ paint colors (walls that aren't getting stone)
// A design keeps a generic shade as {paint: id}, or anything else (a paint looked up by name,
// a mixed color) as {paint: "custom", paintColor: {hex, name, brand, code, how, src, source, confidence}}.
function shade(id) { const p = PT.PAINT_BY_ID.get(id) || PT.PAINT_BY_ID.get("warmwhite"); return { how: "shade", id: p.id, hex: p.hex, name: p.label }; }
function paintOf(d) { return d?.paintColor && PT.normHex(d.paintColor.hex) ? d.paintColor : shade(d?.paint); }
const fullName = (c) => (c.brand ? `${c.brand} ${c.name}` : c.name);
function paintName(d) { return fullName(paintOf(d)); }
const samePaint = (a, b) => !!a && !!b && `${a.brand || ""}|${a.name}|${a.hex}`.toLowerCase() === `${b.brand || ""}|${b.name}|${b.hex}`.toLowerCase();
function swatchBtn(key, c, cur, action = "paintpick", label = false) {
  const n = fullName(c);
  return `<button class="psw${label ? " lab" : ""}" data-a="${action}" data-v="${esc(key)}" aria-pressed="${samePaint(c, cur)}" data-tip="${esc(n)}" aria-label="${esc(n)}"><i style="background:${c.hex}"></i>${label ? `<span>${esc(n)}</span>` : ""}</button>`;
}
/** The short row of colors on the area card: recent ones first. */
function quickPaints() {
  return [...S.myPaints.slice(0, 3).map((c, i) => ["m:" + i, c]), ...PT.QUICK_PAINTS.map((id) => ["s:" + id, shade(id)])].slice(0, 8);
}
const lkMatches = () => (S.lk.result ? [S.lk.result, ...S.lk.result.alternatives] : []);
function paintFromKey(k) {
  const t = String(k || "").slice(0, 1), v = String(k || "").slice(2);
  if (t === "s") return PT.PAINT_BY_ID.has(v) ? shade(v) : null;
  if (t === "m") return S.myPaints[+v] || null;
  if (t === "a") { const m = lkMatches()[+v]; return m ? { ...m, how: "lookup", src: S.lk.result.src, source: S.lk.result.source, confidence: +v === 0 ? S.lk.result.confidence : "" } : null; }
  return null;
}
/** Recent named and mixed colors. Kept in this browser on the website; the showroom forgets them on start over. */
function rememberPaint(c) {
  let list = S.myPaints.filter((x) => !samePaint(x, c));
  if (c.how === "mix" && S.lastPaintHow === "mix" && list[0]?.how === "mix") list = list.slice(1);   // one entry per round of mixing
  S.myPaints = [{ ...c }, ...list].slice(0, 8);
  if (S.mode !== "kiosk") store.set("paints", S.myPaints);
}
function applyPaint(gid, c, commit = true, design = currentDesign()) {
  const d = (design[gid] = design[gid] || {});
  d.mode = "paint";
  if (c.how === "shade" && PT.PAINT_BY_ID.has(c.id)) { d.paint = c.id; delete d.paintColor; }
  else {
    const hex = PT.normHex(c.hex) || "#e6e1d6";
    d.paint = "custom";
    d.paintColor = { hex, name: c.name || PT.describe(hex), brand: c.brand || "", code: c.code || "", how: c.how || "mix", src: c.src || "", source: c.source || "", confidence: c.confidence || "" };
  }
  invalidate();
  if (!commit) return;
  if (d.paintColor) rememberPaint(d.paintColor);
  S.lastPaintHow = c.how;
  persist(); renderCaption(); renderCard();
}
function paintCurHTML(p) {
  const tag = p.how === "lookup" ? `${p.src === "web" ? `Matched from ${esc(p.source || "the paint maker's website")}` : "Looked up by Claude"}${p.confidence === "low" ? " · a best guess, check the chip" : ""}`
    : p.how === "mix" ? "Your own mix" : "Generic shade, not a brand color";
  return `<i class="pbig" style="background:${p.hex}"></i><div class="pinfo"><div class="pn">${esc(fullName(p))}</div>
    <div class="pm">${[p.code, p.hex.toUpperCase()].filter(Boolean).map(esc).join(" · ")}</div><div class="pt">${tag}</div></div>`;
}
function paintPanel(gid) {
  const g = S.room.groups.find((x) => x.id === gid);
  const cur = paintOf(currentDesign()[gid]);
  return `<div class="group">
      <button class="backlink" data-a="paintback">${ICON.back}All areas</button>
      <div><div class="eyebrow">Paint color</div><h2 class="h">${esc(g?.label || "")}</h2></div>
      ${g?.hint ? `<p class="sub">${esc(g.hint)}</p>` : ""}</div>
    <div class="pcur" id="pcur">${paintCurHTML(cur)}</div>
    ${lookupBox()}
    ${S.myPaints.length ? `<div class="group"><div class="eyebrow">Your colors</div><div class="pswatches">${S.myPaints.map((c, i) => swatchBtn("m:" + i, c, cur, "paintpick", true)).join("")}</div></div>` : ""}
    <div class="group"><div class="eyebrow">Shades to try</div>
      ${PT.PAINT_FAMILIES.map((f) => `<div class="pfam"><span>${esc(f.label)}</span><div class="pswatches">${f.items.map((p) => swatchBtn("s:" + p.id, shade(p.id), cur)).join("")}</div></div>`).join("")}</div>
    <details class="mixwrap"${S.mixOpen ? " open" : ""}><summary>${ICON.drop}<span>Mix your own color</span>${ICON.caret}</summary>${PT.mixerHTML("pmixer")}</details>
    <p class="note">Colors on a screen are approximate, and paint looks different in every room's light. Check a real paint chip on your wall before you buy.</p>`;
}
function bindPaintPanel() {
  const gid = S.paintFor;
  bindLookup();
  const det = $("#railBody .mixwrap");
  if (det) det.addEventListener("toggle", () => { S.mixOpen = det.open; });
  PT.bindMixer($("#pmixer"), paintOf(currentDesign()[gid]).hex, {
    onInput: (hex) => { applyPaint(gid, { how: "mix", hex }, false); const el = $("#pcur"); if (el) el.innerHTML = paintCurHTML(paintOf(currentDesign()[gid])); },
    onCommit: (hex) => { applyPaint(gid, { how: "mix", hex }); renderRail({ keep: true }); },
  });
}

// "Type or say a paint color": Claude works out which color is meant (paint.js says where it asks).
function lookupBox() {
  if (!S.lookupFn || S.lookupOff) return "";
  const L = S.lk, busy = L.state === "busy", listening = L.state === "listening";
  return `<div class="group lookup">
    <label class="eyebrow" for="lkq">Know the paint you want?</label>
    <form class="lkrow" id="lkform" autocomplete="off">
      <input id="lkq" type="search" enterkeyhint="search" spellcheck="false" placeholder="Brand and name, like Behr Drift Blue" value="${esc(L.q)}"${busy ? " disabled" : ""}>
      ${S.canListen ? `<button type="button" class="btn mic${listening ? " on" : ""}" data-a="lkmic" aria-pressed="${listening}" aria-label="${listening ? "Stop listening" : "Say the paint color"}" data-tip="${listening ? "Stop listening" : "Say the paint color"}">${ICON.mic}</button>` : ""}
      <button type="submit" class="btn primary"${busy ? " disabled" : ""}>Find</button>
    </form>
    <div class="lkout" id="lkout" aria-live="polite">${lookupOut()}</div></div>`;
}
function lookupOut() {
  const L = S.lk;
  if (L.state === "busy") return `<div class="lkbusy"><span class="sp"></span><span>Looking up “${esc(L.q)}”…</span><button class="btn small ghost" data-a="lkstop">Stop</button></div>`;
  if (L.state === "listening") return `<div class="lkbusy"><span class="rec"></span><span>${L.heard ? `“${esc(L.heard)}”` : "Listening… say the brand and color name."}</span><button class="btn small ghost" data-a="lkstop">Stop</button></div>`;
  if (L.state === "error") return `<p class="warnnote">${esc(L.msg)}</p>`;
  if (L.state === "done" && L.result) {
    const r = L.result, cur = S.paintFor ? paintOf(currentDesign()[S.paintFor]) : null, ms = lkMatches();
    return `<div class="lkres">
      ${r.confidence === "low" ? `<p class="warnnote">A best guess. Check the name and number on the paint chip.</p>` : ""}
      <div class="lkalts">${ms.map((m, i) => { const on = samePaint({ ...m }, cur); return `<button class="lkalt" data-a="paintpick" data-v="a:${i}" aria-pressed="${on}"><i style="background:${m.hex}"></i><span><b>${esc(fullName(m))}</b><small>${esc([m.code, m.hex.toUpperCase()].filter(Boolean).join(" · "))}</small></span>${on ? ICON.check : ""}</button>`; }).join("")}</div>
      ${ms.length > 1 ? `<p class="note">More than one paint could match. Tap the one on your chip.</p>` : ""}
      ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}</div>`;
  }
  return `<p class="note">Type the brand and color name from the chip${S.canListen ? ", or tap the microphone and say it" : ""}. You can describe a color too, like “soft sage green”.</p>`;
}
function bindLookup() {
  const f = $("#lkform"), inp = $("#lkq"); if (!f) return;
  f.addEventListener("submit", (e) => { e.preventDefault(); runLookup(inp?.value); });
  inp?.addEventListener("input", () => { S.lk.q = inp.value; });
}
/** Redraw only the lookup box, so the rest of the panel (and the mixer) stays put. */
function refreshLookup() {
  const box = $("#railBody .lookup"); if (!box) return;
  const focused = document.activeElement?.id === "lkq";
  const t = document.createElement("div"); t.innerHTML = lookupBox();
  const nb = t.firstElementChild;
  if (!nb) { box.remove(); return; }
  box.replaceWith(nb); bindLookup();
  if (focused) $("#lkq")?.focus({ preventScroll: true });
}
async function runLookup(q) {
  q = String(q || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const gid = S.paintFor;
  if (!q || !S.lookupFn || !gid) return;
  stopLookup(true);
  const ctl = new AbortController(), design = currentDesign();
  const lk = { q, state: "busy", ctl };
  S.lk = lk; refreshLookup();
  try {
    const r = await S.lookupFn(q, ctl.signal);
    if (S.lk !== lk) return;
    if (r.kind === "none" || !r.hex) { S.lk = { q, state: "error", msg: "That didn't sound like a paint color. Try the brand and the color name, like “Behr Drift Blue”, or describe the color." }; refreshLookup(); return; }
    S.lk = { q, state: "done", result: r };
    applyPaint(gid, { ...r, how: "lookup" }, true, design);
    renderRail({ keep: true });
  } catch (e) {
    if (S.lk !== lk) return;
    const { msg, off } = PT.lookupError(e);
    if (off) { S.lookupOff = true; toast(msg); }
    S.lk = msg && !off ? { q, state: "error", msg } : { q, state: "idle" };
    renderRail({ keep: true });
  }
}
function stopLookup(silent) {
  const L = S.lk || {};
  try { L.ctl?.abort(); } catch (e) { /* already done */ }
  try { L.stop?.(); } catch (e) { /* already stopped */ }
  if (!silent) { S.lk = { q: L.q || "", state: "idle" }; refreshLookup(); }
}
function toggleMic() {
  if (S.lk.state === "listening") { stopLookup(false); return; }
  if (!S.canListen) return;
  stopLookup(true);
  const lk = { q: "", state: "listening", heard: "" };
  S.lk = lk;
  const sorry = "Didn't catch that. Tap the microphone and try again, or type it.";
  lk.stop = PT.listenOnce({
    onText: (t) => {
      if (S.lk !== lk) return;
      lk.heard = t; lk.q = t;
      const inp = $("#lkq"); if (inp) inp.value = t;
      const out = $("#lkout"); if (out) out.innerHTML = lookupOut();
    },
    onDone: (t) => { if (S.lk !== lk) return; if (t) runLookup(t); else { S.lk = { q: "", state: "error", msg: sorry }; refreshLookup(); } },
    onError: (code) => {
      if (S.lk !== lk) return;
      if (code === "aborted") { S.lk = { q: lk.q, state: "idle" }; refreshLookup(); return; }
      let msg = sorry;
      if (code === "not-allowed" || code === "service-not-allowed") { S.canListen = false; msg = "The microphone isn't available here. Type the color instead."; }
      else if (code === "audio-capture") { S.canListen = false; msg = "No microphone found on this screen. Type the color instead."; }
      else if (code === "network") msg = "Voice needs an internet connection. Type the color instead.";
      S.lk = { q: lk.q, state: "error", msg }; refreshLookup();
    },
  });
  refreshLookup();
}

function roomPanel() {
  const r = S.room;
  const sceneRoom = r.kind === "scene" ? roomDef(r.id) : null;
  return `<div class="group"><h2 class="h">Rooms</h2><p class="sub">Start with a sample room, or put the stone on a photo of your own wall.</p></div>
    <div class="rooms">
      ${ROOMS.map((rd) => `<button class="room" data-a="room" data-v="${rd.id}" aria-pressed="${S.roomId === rd.id}">
        <img src="assets/scenes/${rd.id}/${rd.variants[0].id}_day.jpg" alt=""><span><b>${esc(rd.name)}</b><span>${esc(rd.blurb)}</span></span></button>`).join("")}
      <button class="room" data-a="${S.photo ? "room" : "photo"}" data-v="photo" aria-pressed="${S.roomId === "photo"}">
        ${S.photo ? `<img src="${S.photo.thumb}" alt="">` : `<span style="display:grid;place-items:center;height:80px;border-radius:8px;border:1px dashed var(--line)">${ICON.cam}</span>`}
        <span><b>${S.photo ? "Your photo" : "Use my photo"}</b><span>${S.photo ? "Your wall, set up for stone" : "A phone picture of your wall or fireplace works well"}</span></span></button>
    </div>
    ${sceneRoom && (sceneRoom.stoves || faceRoom(sceneRoom) && catalogFor(sceneRoom).length) ? `<div class="group"><div class="eyebrow">${sceneRoom.stoves ? "Stove" : sceneRoom.inserts ? "Insert" : "Fireplace"}</div>
      <div class="row"><span class="sub">${esc(stoveNow(r))}</span><button class="btn small" data-a="tab" data-v="stove">Change the ${sceneRoom.stoves ? "stove" : sceneRoom.inserts ? "insert" : "fireplace"}</button></div></div>` : ""}
    ${sceneRoom && !sceneRoom.stoves && !(faceRoom(sceneRoom) && catalogFor(sceneRoom).length) ? `<div class="group"><div class="eyebrow">${faceRoom(sceneRoom) ? "Fireplace" : "Stove"}</div>
      <div class="pills">${sceneRoom.variants.filter((v) => !r.sj || r.sj.variants[v.id]).map((v) => `<button class="pill" data-a="variant" data-v="${v.id}" aria-pressed="${S.variant[r.id] === v.id}">${esc(v.label)}</button>`).join("")}</div>
      <p class="note">Sample ${faceRoom(sceneRoom) ? "fireplace" : "stoves"} for scale and style. Ask us about the models we carry.</p></div>` : ""}
    ${sceneRoom ? sceneLightControls() : ""}`;
}

// ------------------------------------------------------------------ back to the start
/** The finish a stone starts with when it's picked: its usual joint, charcoal mortar for dry stack, natural gray otherwise. */
function startingFinish(stoneId) { const j = S.cat.get(stoneId)?.defaultJoint || "standard"; return { joint: j, mortar: j === "dry" ? "charcoal" : "natural" }; }
function finishChanged(a) { if (!a || a.mode !== "stone") return false; const f = startingFinish(a.stone); return (a.joint || "standard") !== f.joint || (a.mortar || "natural") !== f.mortar || !!a.seed; }
function finishTargets() {
  const d = currentDesign();
  const ids = S.target === "all" ? S.room.groups.map((g) => g.id).filter((id) => d[id]?.mode === "stone") : [S.target];
  return ids.map((id) => d[id]).filter((a) => a && a.mode === "stone");
}
function finishResetRow() {
  const tg = finishTargets();
  if (!tg.some(finishChanged)) return "";
  const stones = [...new Set(tg.map((a) => a.stone))];
  let what = "Back to the starting joint and mortar for each stone.";
  if (stones.length === 1) {
    const f = startingFinish(stones[0]);
    what = `Back to ${JOINTS[f.joint].label.toLowerCase()}${f.joint === "dry" ? "" : ` with ${MORTARS.find((m) => m.id === f.mortar).label.toLowerCase()} mortar`}, as ${esc(S.cat.get(stones[0])?.name || "this stone")} starts.`;
  }
  return `<div class="resetrow"><button class="btn" data-a="resetfinish">${ICON.reset}Reset joint &amp; mortar</button><span class="note">${what}</span></div>`;
}
let undoReset = null;
const takeSnap = () => ({ design: JSON.stringify(S.design), variant: { ...S.variant }, light: S.light, target: S.target, grid: S.grid });
async function resetFinish() {
  undoReset = takeSnap();
  applyToTargets((g) => { const f = startingFinish(g.stone); g.joint = f.joint; g.mortar = f.mortar; g.seed = 0; delete g._jointSet; delete g._mortarSet; });
  renderRail({ keep: true }); renderCaption(); renderCard(); invalidate(600);
  toast("Joint and mortar are back to the start.", { a: "undoreset", label: "Undo" });
}
/** Website "Start over": every room's stone, joints, paint, stove and lighting go back the way they
 *  started. The customer's photo outlines and saved ideas stay; Undo puts everything back. */
async function startOverWeb() {
  undoReset = takeSnap();
  for (const r of ROOMS) S.design[r.id] = JSON.parse(JSON.stringify(r.defaults));
  if (S.photo && S.design.photo) { const b = ROOMS[0].defaults.chimney; for (const a of S.photo.areas) S.design.photo[a.id] = { mode: "stone", stone: b.stone, joint: b.joint, mortar: b.mortar }; }
  S.variant = { cabin: "trad", linear: "linear", masonry: "masonry" }; S.light = "day"; S.target = "all"; S.grid = false; S.paintFor = null;
  closeCard(); persist();
  await setRoom(S.roomId);
  toast(S.photo || S.ideas.length ? "Started over. Your photo and saved ideas are still here." : "Started over.", { a: "undoreset", label: "Undo" });
}
async function undoLastReset() {
  const u = undoReset; undoReset = null;
  if (!u) return;
  S.design = JSON.parse(u.design); S.variant = u.variant; S.light = u.light; S.target = u.target; S.grid = u.grid;
  await Promise.all(stonesInDesign(currentDesign()).map(ensureStone));
  persist();
  await setRoom(S.roomId);
  toast("Put back.");
}

// ------------------------------------------------------------------ estimate
function estimate() {
  const r = S.room, d = currentDesign();
  const rows = [];
  for (const g of r.groups) {
    const a = d[g.id];
    if (!a || a.mode !== "stone") continue;
    let area = 0, corners = 0, openings = 0;
    if (r.kind === "scene") {
      for (const zid of g.zones) { const z = r.zones.find((x) => x.id === zid); if (z) { area += z.area_sqft; corners += z.corners_lnft; } }
    } else {
      const ph = S.photo, ar = ph?.areas.find((x) => x.id === g.id);
      if (!ar || !ar.map) continue;
      const secs = closedSecs(ar);
      const key = [ph.paintVer, ar.theta, ar.phi, JSON.stringify(ar.measure), JSON.stringify(secs.map((x) => x.pts))].join("|");
      if (ar.openKey !== key) { ar.openSqft = P.paintedAreaOnWall(ph.open, secs.map((x) => x.pts), ar.map.Hpix) / 144; ar.openKey = key; }
      area = ar.areaSqft; openings = ar.openSqft || 0; corners = ar.cornerLnft;
    }
    rows.push({ g, a, area: area - openings, gross: area, openings, corners });
  }
  const byStone = new Map();
  for (const row of rows) {
    const k = row.a.stone + "|" + row.a.joint;
    const e = byStone.get(k) || { stone: S.cat.get(row.a.stone), joint: row.a.joint, area: 0, corners: 0 };
    e.area += row.area; e.corners += row.corners; byStone.set(k, e);
  }
  const lines = [...byStone.values()].map((e) => {
    const flats = Math.max(0, e.area - e.corners * S.settings.cornerCredit);
    const flatsOrder = flats * (1 + S.settings.waste), cornersOrder = e.corners * (1 + S.settings.waste);
    // Buechel's spec sheet: thin veneer by the small box (flats, and corners by the foot), full veneer by the ton
    const cov = e.stone?.coverage, per = cov?.flat_sqft_per_box?.[e.joint], perT = e.stone?.veneer !== "thin" ? cov?.per_ton?.[e.joint] : null;
    const boxes = per ? { flats: Math.ceil(flatsOrder / per), corners: cov.corner_lnft_per_box ? Math.ceil(cornersOrder / cov.corner_lnft_per_box) : null, per, perC: cov.corner_lnft_per_box } : null;
    const tons = perT ? { per: perT, n: Math.ceil((e.area * (1 + S.settings.waste) / perT) * 10) / 10 } : null;
    const dryOnly = !!cov?.dryOnly && e.joint !== "dry";
    return { ...e, flats, flatsOrder, cornersOrder, boxes, tons, dryOnly };
  });
  const total = rows.reduce((s, r) => s + r.area, 0), totalC = rows.reduce((s, r) => s + r.corners, 0);
  return { rows, lines, total, totalC };
}

function estimatePanel() {
  const E = estimate(); const r = S.room;
  if (!E.rows.length) return `<div class="group"><h2 class="h">Estimate</h2><p class="sub">Put stone on at least one area to see how much you'd need.</p></div>`;
  const guessed = r.kind === "photo" && S.photo?.areas.some((x) => x.map && sizeIsGuess(x) && E.rows.some((row) => row.g.id === x.id));
  const src = r.kind === "scene" ? r.def.sizeNote : guessed ? "From your photo. Some sizes are guesses or set by eye: tap an area on the picture, choose Size &amp; angle, then Measure something for exact numbers." : "From the size you measured on your photo.";
  return `<div class="group"><h2 class="h">What you'd need</h2><p class="sub">${src}</p></div>
    <div class="est">
      <div class="stat"><div><span class="num">${fmt(E.total, 0)}</span><span class="u">sq ft</span></div><div class="l">Stone area</div></div>
      <div class="stat"><div><span class="num">${fmt(E.totalC, 0)}</span><span class="u">lin ft</span></div><div class="l">Outside corners</div></div>
    </div>
    <table class="t"><thead><tr><th>Area</th><th class="n">Sq ft</th><th class="n">Corners</th></tr></thead><tbody>
      ${E.rows.map((x) => `<tr><td>${esc(x.g.label)}${x.openings > 0.05 ? `<div class="note">${fmt(x.openings)} sq ft of openings taken off</div>` : ""}</td><td class="n">${fmt(x.area)}</td><td class="n">${fmt(x.corners)} ft</td></tr>`).join("")}
    </tbody></table>
    ${E.lines.map((l) => `<div class="order">
      <div class="eyebrow">${esc(l.stone?.name || "")} · ${JOINTS[l.joint].label}</div>
      <div class="ln"><span>Flat stone, with ${Math.round(S.settings.waste * 100)}% for cuts</span><b>${fmt(l.flatsOrder)} sq ft</b></div>
      <div class="ln"><span>Corner pieces, with ${Math.round(S.settings.waste * 100)}% for cuts</span><b>${fmt(l.cornersOrder)} lin ft</b></div>
      ${l.boxes ? `<div class="sub2">${l.tons ? "Thin veneer" : "Thin veneer (this stone comes thin only)"}</div>
        <div class="ln"><span>Small boxes of flats (${l.boxes.per} sq ft each, ${JOINTS[l.joint].label.toLowerCase()})</span><b>${l.boxes.flats} boxes</b></div>
        ${l.boxes.corners != null ? `<div class="ln"><span>Corner boxes (${l.boxes.perC} lin ft each)</span><b>${l.boxes.corners} boxes</b></div>` : ""}` : ""}
      ${l.tons ? `<div class="sub2">${l.boxes ? "Or full veneer" : "Full veneer"}</div>
        <div class="ln"><span>By the ton (${l.tons.per} sq ft per ton, ${JOINTS[l.joint].label.toLowerCase()})</span><b>about ${fmt(l.tons.n, 1)} tons</b></div>` : ""}
      ${l.dryOnly ? `<div class="note">Buechel figures ${esc(l.stone?.name || "this stone")} for dry stack only, so there's no box count for this joint style. Choose Dry stack on the Finish tab to see one.</div>`
        : l.boxes || l.tons ? `<div class="note">Coverage from Buechel's spec sheet for this stone.</div>`
        : `<div class="note">Box counts come from Buechel's coverage chart for this stone; the store will confirm them.</div>`}
    </div>`).join("")}
    <div class="group"><div class="eyebrow">Usually also needed</div>
      <p class="sub">Lath, scratch coat and mortar for an adhered install. We'll size those with your quote.</p></div>
    <p class="warnnote">An estimate from the sizes shown, using ${Math.round(S.settings.cornerCredit * 100) / 100} sq ft of flats per foot of corners and a ${Math.round(S.settings.waste * 100)}% cutting allowance. It's a starting point for a quote: we confirm quantities against the current coverage chart before anything is ordered. No prices are shown here.</p>
    <button class="btn primary" data-a="send">${ICON.send}Send this to ${STORE.name}</button>`;
}

// ------------------------------------------------------------------ joint diagrams (tiny 2D renders)
function drawJointDiagrams() {
  const d = currentDesign();
  const gid = S.target === "all" ? Object.keys(d).find((g) => d[g]?.mode === "stone") : S.target;
  const mort = (MORTARS.find((m) => m.id === d[gid]?.mortar) || MORTARS[0]).hex;
  document.querySelectorAll("canvas[data-joint]").forEach((c) => {
    const id = c.dataset.joint, ctx = c.getContext("2d");
    const half = JOINTS[id].half;
    ctx.fillStyle = id === "dry" ? "#16181a" : mort; ctx.fillRect(0, 0, c.width, c.height);
    const rows = [[0, 18, [0, 52, 104]], [18, 30, [-20, 30, 92, 140]], [48, 22, [0, 60, 118]], [70, 26, [-34, 22, 80, 128]]];
    const pad = half * 7;
    const tones = ["#8f8a82", "#a39d93", "#7e7a73", "#b0aa9f", "#97928a"];
    let t = 0;
    for (const [y, h, xs] of rows) {
      for (let i = 0; i < xs.length; i++) {
        const x0 = xs[i], x1 = (xs[i + 1] ?? xs[0] + 160);
        ctx.fillStyle = tones[t++ % tones.length];
        const r = id === "overgrout" ? 6 : 2;
        roundRect(ctx, x0 + pad, y + pad, x1 - x0 - 2 * pad, h - 2 * pad, r);
        ctx.fill();
      }
    }
  });
}
function roundRect(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ------------------------------------------------------------------ actions
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-a]");
  if (!el) return;
  if (el.classList.contains("tbtn")) { clearTimeout(toastT); const t = el.closest(".toast"); if (t) t.hidden = true; }   // the message did its job
  const a = el.dataset.a, v = el.dataset.v;
  act(a, v, el);
});

async function act(a, v, el) {
  const d = currentDesign();
  switch (a) {
    case "tab": S.tab = v; S.paintFor = null; renderChrome(); renderRail(); break;
    case "mode": setMode(v); break;
    case "target": S.target = v; if (v !== "all") select(v); renderRail(); renderQuick(); renderCaption(); break;
    case "fstyle": S.filters.style = v; refreshCatalog(); break;
    case "ftone": S.filters.tone = v; refreshCatalog(); break;
    case "fclear": { S.filters = { style: "All", tone: "All", q: "" }; const q = $("#catQ"); if (q) q.value = ""; refreshCatalog(); break; }
    case "stoneqr": openStoneLink(v); break;
    case "fitopen": openFit(v); break;
    case "stone":
      await pickStone(v, el); break;
    case "joint": applyToTargets((g) => { g.joint = v; g._jointSet = true; if (v !== "dry" && g.mortar === "charcoal" && !g._mortarSet) g.mortar = "natural"; }); renderRail(); renderCaption(); invalidate(); break;
    case "mortar": applyToTargets((g) => { g.mortar = v; g._mortarSet = true; }); renderRail(); renderCaption(); invalidate(); break;
    case "shuffle": applyToTargets((g) => { g.seed = ((g.seed || 0) + 1 + Math.floor(Math.random() * 97)) % 1000; }); invalidate(); break;
    case "fit": engine.fit(); invalidate(); drawOverlay(); break;
    case "before": S.compare = S.compare.mode === "before" ? { mode: "off", split: 0.5 } : { mode: "before", split: 0.5 }; renderChrome(); renderChips(); drawOverlay(); invalidate(); break;
    case "comparepick": if (S.compare.mode === "look") { S.compare = { mode: "off", split: 0.5 }; setCmpScene(null); renderChrome(); renderChips(); drawOverlay(); invalidate(); } else openIdeas(true); break;
    case "light": S.light = v; if (S.room.kind === "scene") await setRoom(S.roomId); else renderRail(); break;
    case "variant": S.variant[S.roomId] = v; await setRoom(S.roomId); break;
    case "stovepick": await pickStove(v); break;
    case "stovestep": stoveSize(Math.round(Math.log2(currentDesign().stove?.sizeK || 1) * 100) + Number(v) * 5); break;
    case "stovereset": stoveSize(0); break;
    case "stoveqr": openStoveLink(v); break;
    case "room": if (roomPopOpen) toggleRoomPop(false); if (v !== S.roomId) await setRoom(v); break;
    case "gmode": {
      const g = el.dataset.g; d[g] = d[g] || {};
      d[g].mode = v;
      if (v === "stone" && !d[g].stone) Object.assign(d[g], { stone: firstStone(d), joint: "standard", mortar: "natural" });
      if (v === "paint" && !d[g].paint) d[g].paint = "warmwhite";
      if (v === "stone") await ensureStone(d[g].stone);
      if (v === "paint") { S.tab = "areas"; S.paintFor = g; }   // straight on to the colors
      persist(); select(g); renderChrome(); renderRail(); renderCaption(); renderCard(); invalidate(); break;
    }
    case "paintfor": S.tab = "areas"; S.paintFor = v; renderChrome(); renderRail(); revealRail("#railBody"); break;
    case "paintback": S.paintFor = null; renderRail(); break;
    case "paintpick": { const c = paintFromKey(v); if (c && S.paintFor) { applyPaint(S.paintFor, c); renderRail({ keep: true }); } break; }
    case "resetfinish": await resetFinish(); break;
    case "startoverweb": await startOverWeb(); break;
    case "undoreset": await undoLastReset(); break;
    case "padpick": setPad(el.dataset.g, v); break;
    case "lkmic": toggleMic(); break;
    case "lkstop": stopLookup(false); break;
    case "editgroup": S.target = v; S.tab = "stone"; select(v); renderChrome(); renderRail(); renderQuick(); break;
    case "saveimg": openSaveImage(); break;
    case "send": openSend(); break;
    case "phone": openPhone(); break;
    case "help": openHelp(); break;
    case "ideas": openIdeas(false); break;
    case "startover": resetKiosk(true); break;
    case "fullscreen": try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (e) { toast("Full screen isn't available here."); } break;
    case "photo": if (roomPopOpen) toggleRoomPop(false); openPhotoPicker(); break;
    case "addsurf": addArea(); break;
    case "editsurf": if (S.photo) { if (S.roomId !== "photo") await setRoom("photo"); editArea(v || S.photo.areas[0]?.id); } break;
    case "delsurf": if (S.photo) deleteArea(S.photo.areas.findIndex((x) => x.id === v)); break;
    case "lightauto": autoLight(); break;
    case "wallkind": if (S.photo) { S.photo.light.wall = v; S.photo.lightKey = ""; rebuildMasks(true); renderRail(); invalidate(); } break;
    case "close": closeLayer(); break;
    case "unlock": S.kioskLocked = false; closeLayer(); setMode("web"); break;
    case "roompick": toggleRoomPop(); break;
    case "forgetphoto": await forgetPhoto(); break;
    case "clearstats": store.set("stats", { since: new Date().toISOString().slice(0, 10), sessions: 0, photos: 0, quotes: 0, saves: 0, picks: {} }); openStaff(); break;
    default: if (saveActions[a]) saveActions[a](v, el); else wizardAction(a, v, el);
  }
}
function firstStone(d) { return Object.values(d).find((g) => g.mode === "stone")?.stone || DEFAULT_STONE; }

async function pickStone(id, el) {
  if (S.room?.kind === "photo" && S.photo && !doneAreas().length) { toast("Outline an area on your photo first."); if (!S.photo.wizard) editArea(S.photo.areas[0].id); return; }
  const d = currentDesign();
  if (S.target === "all" && !Object.values(d).some((g) => g.mode === "stone")) {
    const g0 = S.room.groups[0].id; d[g0] = { ...(d[g0] || {}), mode: "stone" };
  }
  const st = S.cat.get(id);
  applyToTargets((g) => {
    g.mode = "stone";
    g.stone = id;
    if (!g._jointSet) g.joint = st.defaultJoint || g.joint || "standard";
    if (!g._mortarSet) g.mortar = g.joint === "dry" ? "charcoal" : (g.mortar === "charcoal" || !g.mortar ? "natural" : g.mortar);
  });
  track("pick", id);
  if (!S.hinted) { S.hinted = true; store.set("hinted", true); }
  busy(!engine.hasStone(id));
  await ensureStone(id);
  busy(false);
  renderQuick(); renderCaption();
  if (S.tab === "stone" || S.tab === "estimate" || S.tab === "areas") {
    // a stone picked from the long list: keep that card where it was on the screen
    const body = $("#railBody"), card = el?.classList?.contains("card") && body?.contains(el) ? el : null;
    const y0 = card ? card.getBoundingClientRect().top : 0;
    renderRail({ keep: true });
    const now = card && body.querySelector(`.card[data-v="${CSS.escape(id)}"]`);
    if (now) body.scrollTop += now.getBoundingClientRect().top - y0;
  }
  invalidate();
}

function select(gid) { S.selGroup = gid; S.selT = performance.now(); invalidate(2300); renderCaption(); }

function setFlicker(on) {
  S.flicker = on;
  if (S.room?.kind === "scene" && engine.scene) engine.scene.fire = on || S.room.noFire ? S.room.tex.fire : null;
  invalidate();
}
document.addEventListener("change", (ev) => { if (ev.target.id === "flickerChk") setFlicker(ev.target.checked); });
function setMode(m) {
  clearTransient();
  S.mode = m;
  setFlicker(m === "kiosk");
  $("#app").dataset.mode = m;
  setTimeout(syncBg, 30);
  if (m === "kiosk") enterAttract();
  else exitAttract(false);
  renderAll();
  setTimeout(refit, 60);
}

document.addEventListener("change", (ev) => { if (ev.target?.dataset?.fit) fitCommit(); });
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.id === "catQ") { S.filters.q = el.value; refreshCatalog(); return; }
  if (el.dataset.fit) { fitInput(el.dataset.fit, +el.value); return; }
  if (el.dataset.s && S.photo) {
    const L = S.photo.light, v = parseFloat(el.value);
    const map = { expo: "expo", warmth: "warmth", relief: "relief", ldir: "dir", lstr: "str" };
    const k = map[el.dataset.s]; if (!k) return;
    L[k] = v;
    const o = $("#o_" + el.dataset.s);
    if (o) o.textContent = el.dataset.s === "expo" || el.dataset.s === "relief" || el.dataset.s === "lstr" ? `${Math.round(v * 100)}%` : el.dataset.s === "ldir" ? dirName(v) : (v > 0.05 ? "warmer" : v < -0.05 ? "cooler" : "neutral");
    if (k === "dir" || k === "str") { L.auto = false; updatePhotoGrad(); }
    invalidate();
  }
});

// ------------------------------------------------------------------ stage interaction
const ptrs = new Map();
let gesture = null;
function cssToCanvas(x, y) { const d = canvas.width / stage.clientWidth; return [x * d, y * d]; }
function stageXY(ev) { const r = stage.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
function cssToImg(x, y) { const [cx, cy] = cssToCanvas(x, y); const [u, v] = engine.toUV(cx, cy); return [u * S.room.width, v * S.room.height]; }
function imgToCss(x, y) { const [cx, cy] = engine.toCanvas(x / S.room.width, y / S.room.height); const d = stage.clientWidth / canvas.width; return [cx * d, cy * d]; }

stage.addEventListener("contextmenu", (e) => e.preventDefault());
stage.addEventListener("pointerdown", (ev) => {
  if (!S.room || ev.target.closest(".tool, .split, .cap, .hud, .acard, .roombtn, .roompop")) return;
  stage.setPointerCapture(ev.pointerId);
  const p = stageXY(ev);
  ptrs.set(ev.pointerId, p);
  const inSetup = !!(S.photo?.wizard && S.roomId === "photo");
  if (ptrs.size === 2) {
    if (gesture?.kind === "wizard") wizardCancel(true);
    const [a, b] = [...ptrs.values()];
    gesture = { kind: "pinch", d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, view0: { ...engine.view }, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    drawOverlay();
    return;
  }
  if (ptrs.size > 2) return;
  if (ev.button === 1 || ev.button === 2 || spaceDown) { gesture = { kind: "pan", start: p, view0: { ...engine.view } }; ev.preventDefault(); return; }
  if (inSetup && wizardPointerDown(ev, p)) { gesture = { kind: "wizard" }; return; }
  gesture = { kind: "tap", start: p, last: p, t: performance.now(), view0: { ...engine.view } };
});
stage.addEventListener("pointermove", (ev) => {
  const p = stageXY(ev);
  if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, p);
  if (!gesture) {
    if (S.photo?.wizard && S.roomId === "photo") wizardHover(ev, p); else hoverAt(ev, p);
    return;
  }
  if (gesture.kind === "wizard") { wizardPointerMove(ev, p); return; }
  if (gesture.kind === "pinch") {
    if (ptrs.size !== 2) return;
    const [a, b] = [...ptrs.values()];
    const dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    zoomAt(gesture.mid, gesture.view0, dd / gesture.d0);
    const [dx, dy] = cssToCanvas(mid[0] - gesture.mid[0], mid[1] - gesture.mid[1]);
    engine.view.ox += dx; engine.view.oy += dy;
    clampView(); invalidate(); drawOverlay();
    return;
  }
  if (gesture.kind === "tap") {
    const moved = Math.hypot(p[0] - gesture.start[0], p[1] - gesture.start[1]);
    if (moved > 6 && isZoomed()) gesture.kind = "pan";
  }
  if (gesture.kind === "pan") {
    const [dx, dy] = cssToCanvas(p[0] - gesture.start[0], p[1] - gesture.start[1]);
    engine.view.ox = gesture.view0.ox + dx; engine.view.oy = gesture.view0.oy + dy;
    clampView(); invalidate(); drawOverlay();
  }
});
const endPtr = (ev) => {
  const p = stageXY(ev);
  ptrs.delete(ev.pointerId);
  if (!gesture) return;
  if (gesture.kind === "wizard") { wizardPointerUp(ev, p); gesture = null; return; }
  if (gesture.kind === "pinch") { if (ptrs.size === 0) gesture = null; return; }
  if (gesture.kind === "tap" && performance.now() - gesture.t < 600) {
    const now = performance.now();
    if (stage._lastTap && now - stage._lastTap < 320) { engine.fit(); invalidate(); drawOverlay(); stage._lastTap = 0; gesture = null; return; }
    stage._lastTap = now;
    tapAt(p);
  }
  if (ptrs.size === 0) gesture = null;
};
stage.addEventListener("pointerup", endPtr);
stage.addEventListener("pointercancel", (ev) => {
  ptrs.delete(ev.pointerId);
  if (gesture?.kind === "wizard") { wizardCancel(); gesture = null; }
  else if (ptrs.size === 0) gesture = null;
});
stage.addEventListener("pointerleave", () => {
  if (S.hoverGroup) { S.hoverGroup = null; invalidate(); }
  hideTip(); drawBrush(null);
  if (S.photo?.hover && !wd) { S.photo.hover = null; drawOverlay(); }
});
stage.addEventListener("wheel", (ev) => {
  if (!S.room) return;
  ev.preventDefault();
  if (ev.target.closest(".acard, .roompop")) return;   // scrolling over the area card leaves it (and the picture) alone
  const p = stageXY(ev);
  zoomAt(p, { ...engine.view }, Math.exp(-ev.deltaY * 0.0015));
}, { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || !S.photo?.wizard || S.roomId !== "photo") return;
  if (["input", "textarea", "select", "button"].includes((e.target.tagName || "").toLowerCase())) return;
  spaceDown = true; stage.style.cursor = "grab"; e.preventDefault();
});
window.addEventListener("keyup", (e) => { if (e.code === "Space") spaceDown = false; });

function zoomAt(cssP, v0, k) {
  const [cx, cy] = cssToCanvas(cssP[0], cssP[1]);
  const fit = engine.view.fitScale || v0.scale;
  const ns = clamp(v0.scale * k, fit, fit * 8);
  const r = ns / v0.scale;
  engine.view.scale = ns;
  engine.view.ox = cx - (cx - v0.ox) * r;
  engine.view.oy = cy - (cy - v0.oy) * r;
  clampView(); invalidate(); drawOverlay();
}
function clampView() {
  const v = engine.view, s = S.room;
  const w = s.width * v.scale, h = s.height * v.scale;
  const cw = canvas.width, ch = canvas.height;
  v.ox = w <= cw ? (cw - w) / 2 : clamp(v.ox, cw - w, 0);
  v.oy = h <= ch ? (ch - h) / 2 : clamp(v.oy, ch - h, 0);
}

function tapAt(p) {
  if (S.photo?.wizard) return;
  if (!S.hinted) { S.hinted = true; store.set("hinted", true); }
  const [cx, cy] = cssToCanvas(p[0], p[1]);
  const [u, v] = engine.toUV(cx, cy);
  if (stoveAtUV(u, v) || sampleStoveAtUV(u, v)) {   // the stove (or fireplace): its card by it (size, change, no stove), and its tab
    select(null); S.paintFor = null; S.tab = "stove";
    renderChrome(); renderRail(); renderQuick();
    openCard(STOVE_CARD, p);
    return;
  }
  const zid = zoneAtUV(u, v);
  const g = zid ? groupOfZone(zid) : null;
  if (!g) return;          // a tap off the areas leaves the card open: its X closes it
  if (!isPad(g)) S.target = g;
  select(g);
  // the panel follows what was tapped: a painted wall opens its colors, the hearth pad its finishes, anything else the stones
  if (isPad(g)) { S.paintFor = null; S.tab = "areas"; }
  else if (currentDesign()[g]?.mode === "paint") { S.tab = "areas"; S.paintFor = g; }
  else if (S.paintFor) { S.paintFor = null; S.tab = "stone"; }
  if (S.tab === "estimate" || S.tab === "room" || S.tab === "stove") S.tab = "stone";
  renderChrome(); renderRail(); renderQuick();
  openCard(g, p);
}
function hoverAt(ev, p) {
  if (ev.pointerType !== "mouse" || !S.room || S.photo?.wizard) return;
  if (ev.target.closest?.(".stage-tools, .split, .cap, .hud, .acard, .chips, .roompop")) {   // over a button, not the picture
    if (S.hoverGroup) { S.hoverGroup = null; invalidate(); }
    hideTip(); return;
  }
  const [cx, cy] = cssToCanvas(p[0], p[1]);
  const [u, v] = engine.toUV(cx, cy);
  if (stoveAtUV(u, v) || sampleStoveAtUV(u, v)) {
    if (S.hoverGroup) { S.hoverGroup = null; invalidate(); }
    const st = S.stoveMap.get(currentDesign().stove?.stoveId);
    const name = st ? ST.stoveName(st) : S.room.def.variants.find((x) => x.id === S.room.variantId)?.label;
    if (name) showTip(p, name + " · tap to change"); return;
  }
  const zid = zoneAtUV(u, v);
  const g = zid ? groupOfZone(zid) : null;
  if (g !== S.hoverGroup) { S.hoverGroup = g; invalidate(); }
  if (g) showTip(p, S.room.groups.find((x) => x.id === g).label + " · tap to change"); else hideTip();
}
let tipEl = null;
/** The hover label sits below-right of the pointer, and flips left or up so it never runs under
 *  the buttons on the right edge or off the picture. */
function showTip(p, text) {
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "hovertip"; stage.appendChild(tipEl); }
  tipEl.hidden = false;
  if (tipEl.textContent !== text) tipEl.textContent = text;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, gap = 14, W = stage.clientWidth, H = stage.clientHeight;
  const tools = $("#stageTools"), tr = tools?.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  let x = p[0] + gap, y = p[1] + gap;
  // keep clear of the button column on the right where the label would sit beside it
  const besideTools = tr && tr.width && y < tr.bottom - sr.top && y + h > tr.top - sr.top;
  const right = besideTools ? tr.left - sr.left - 8 : W - 8;
  if (x + w > right) x = p[0] - gap - w;
  if (y + h > H - 8) y = p[1] - gap - h;
  tipEl.style.left = clamp(x, 8, Math.max(8, W - w - 8)) + "px";
  tipEl.style.top = clamp(y, 8, Math.max(8, H - h - 8)) + "px";
}
function hideTip() { if (tipEl) tipEl.hidden = true; }

// split handle for before/after and compare
function drawSplit() {
  let el = $("#split");
  if (S.compare.mode === "off" || S.attract) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("div"); el.id = "split"; el.className = "split";
    el.innerHTML = `<span class="tag l"></span><div class="knob">${ICON.ba}</div><span class="tag r">Your design</span>`;
    stage.appendChild(el);
    el.addEventListener("pointerdown", (ev) => {
      el.setPointerCapture(ev.pointerId);
      const move = (e) => { const r = stage.getBoundingClientRect(); S.compare.split = clamp((e.clientX - r.left) / r.width, 0.02, 0.98); el.style.left = S.compare.split * 100 + "%"; invalidate(); };
      const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
      ev.stopPropagation();
    });
  }
  el.style.left = S.compare.split * 100 + "%";
  el.querySelector(".tag.l").textContent = S.compare.mode === "before" ? "Before" : S.compare.nameB || "Idea";
}

// ------------------------------------------------------------------ overlay (wizard drawing)
function drawOverlay() {
  drawSplit();
  if (!S.room) return;
  if (S.photo) paintPreview();
  if (!(S.photo?.wizard && S.roomId === "photo")) { overlay.innerHTML = ""; overlay.style.pointerEvents = "none"; return; }
  overlay.innerHTML = wizardSVG();
}

// ------------------------------------------------------------------ layers (modals) + toast
function openLayer(html, cls = "") {
  $("#layer").innerHTML = `<div class="scrim" data-scrim><div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  const scrim = $("#layer .scrim");
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeLayer(); });
  const f = scrim.querySelector("button, input");
  if (f) f.focus({ preventScroll: true });
}
function closeLayer() { $("#layer").innerHTML = ""; }
document.addEventListener("keydown", (e) => {
  if (S.attract) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); exitAttract(); } return; }
  const tag = (e.target.tagName || "").toLowerCase();
  const typing = ["input", "textarea", "select"].includes(tag);
  if (e.key === "Escape") {
    if ($("#layer .scrim")) { closeLayer(); return; }
    if (S.lk.state === "busy" || S.lk.state === "listening") { stopLookup(false); return; }
    if (cardFor) { closeCard(); return; }
    if (S.photo?.wizard?.step === "auto" && S.photo.auto?.state === "fix" && !S.photo.auto.busy) { S.photo.auto.state = "confirm"; renderAll(); return; }
    if (S.photo?.wizard) { wizardCancel(); if (S.photo.sel.pt >= 0) { S.photo.sel.pt = -1; renderHud(); drawOverlay(); } }
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[role="button"][data-a]')) { e.preventDefault(); e.target.click(); return; }
  if (S.photo?.wizard && S.roomId === "photo" && !typing && !$("#layer .scrim")) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "z" || e.key === "Z") && S.photo.wizard.step === "auto") { e.preventDefault(); if (!e.shiftKey) autoUndo(); return; }
    if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); stepHist(e.shiftKey ? 1 : -1); return; }
    if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); stepHist(1); return; }
    if (S.photo.wizard.step === "outline") {
      const sec = curSec();
      if (e.key === "Enter" && sec && !sec.closed) { e.preventDefault(); finishSection(); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (S.photo.sel.pt >= 0) deletePoint();
        else if (sec && !sec.closed && sec.pts.length) { S.photo.sel.pt = sec.pts.length - 1; deletePoint(); }
        return;
      }
      if (e.key.startsWith("Arrow") && S.photo.sel.pt >= 0) { e.preventDefault(); nudge(e.key, e.shiftKey ? 10 : 1); return; }
    }
    return;
  }
  if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !["input", "textarea", "select"].includes(tag) && !$("#layer .scrim") && !S.photo?.wizard) {
    // step through the stones the list shows (all of them when the filters let nothing through)
    const cur = curStoneId();
    const list = filteredStones().length ? filteredStones() : S.catalog;
    const i = list.findIndex((c) => c.id === cur);
    const n = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
    if (n) { pickStone(n.id); e.preventDefault(); }
  }
});
let toastT = 0;
function toast(msg, action) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="tbtn" data-a="${esc(action.a)}">${esc(action.label)}</button>` : ""}`;
  t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), action ? 6000 : 3400);
}
function busy(on) { $("#busy").hidden = !on; }

// ------------------------------------------------------------------ quick labels for icon buttons
// The browser's own tooltips take about a second to appear. These show a tenth of a second after
// the mouse arrives (at once when moving between buttons), and briefly after a tap on a touch screen,
// so every icon says what it does. Buttons whose words are already showing get no label.
const qtip = document.createElement("div");
qtip.className = "quicktip"; qtip.hidden = true; qtip.setAttribute("aria-hidden", "true");
document.body.appendChild(qtip);
let qtipTimer = 0, qtipFor = null, qtipWarm = 0, qtipTap = null, qtipQuietUntil = 0;
const wordsShowing = (el) => { if (el.hasAttribute("data-tip-always")) return false; const sp = el.querySelector("span"); return !!(sp && sp.textContent.trim() && sp.offsetParent !== null && getComputedStyle(sp).display !== "none"); };
function placeQtip(r, text) {
  qtip.textContent = text; qtip.hidden = false;
  const w = qtip.offsetWidth, h = qtip.offsetHeight, gap = 10, W = window.innerWidth, H = window.innerHeight;
  let x, y;
  if (r.right > W * 0.6 && r.left - gap - w > 8) { x = r.left - gap - w; y = r.top + r.height / 2 - h / 2; }   // buttons on the right: label to their left
  else { x = r.left + r.width / 2 - w / 2; y = r.bottom + gap; if (y + h > H - 8) y = r.top - gap - h; }
  qtip.style.left = clamp(x, 8, W - w - 8) + "px";
  qtip.style.top = clamp(y, 8, H - h - 8) + "px";
}
function hideQtip() { clearTimeout(qtipTimer); if (!qtip.hidden && qtipFor) qtipWarm = performance.now() + 500; qtip.hidden = true; qtipFor = null; }
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest?.("[data-tip]");
  if (!el || el === qtipFor || performance.now() < qtipQuietUntil) return;   // not straight after a click
  if (wordsShowing(el)) { hideQtip(); return; }
  clearTimeout(qtipTimer); qtipFor = el;
  const show = () => { if (qtipFor === el && el.isConnected) placeQtip(el.getBoundingClientRect(), el.dataset.tip); };
  if (!qtip.hidden || performance.now() < qtipWarm) show(); else qtipTimer = setTimeout(show, 100);
});
document.addEventListener("pointerout", (e) => {
  const el = e.target.closest?.("[data-tip]");
  if (!el || el !== qtipFor || (e.relatedTarget && el.contains(e.relatedTarget))) return;
  hideQtip();
});
document.addEventListener("pointerdown", (e) => {
  hideQtip();
  if (e.pointerType === "mouse") { qtipWarm = 0; qtipQuietUntil = performance.now() + 900; }
  const el = e.pointerType !== "mouse" ? e.target.closest?.("[data-tip]") : null;
  qtipTap = el && !wordsShowing(el) ? { r: el.getBoundingClientRect(), text: el.dataset.tip } : null;
}, true);
document.addEventListener("click", () => {
  if (!qtipTap) return;
  const t = qtipTap; qtipTap = null;
  setTimeout(() => { placeQtip(t.r, t.text); clearTimeout(qtipTimer); qtipTimer = setTimeout(() => { qtip.hidden = true; }, 1600); }, 0);
}, true);
window.addEventListener("scroll", hideQtip, true);
const closeBtn = `<button class="btn ghost small" data-a="close" aria-label="Close">${ICON.x}</button>`;

// ------------------------------------------------------------------ save image
function designSummary() {
  const d = currentDesign(); const lines = [];
  for (const g of S.room.groups) {
    const a = d[g.id]; if (!a || a.mode === "off") continue;
    if (g.kind === "pad") { if (a.pad && a.pad !== "gray") lines.push(`${g.label}: ${padOf(a).label.toLowerCase()}`); continue; }
    if (a.mode === "paint") { const p = paintOf(a); lines.push(`${g.label}: painted ${p.brand ? `${p.brand} ${p.name}${p.code ? ` (${p.code})` : ""}` : p.name.toLowerCase()}${p.how === "shade" ? "" : `, ${p.hex.toUpperCase()}`}`); continue; }
    const st = S.cat.get(a.stone);
    lines.push(`${g.label}: ${st?.name} (Buechel Stone), ${JOINTS[a.joint].label.toLowerCase()}${a.joint === "dry" ? "" : ", " + MORTARS.find((m) => m.id === a.mortar)?.label.toLowerCase() + " mortar"}`);
  }
  const sv = d.stove && S.stoveMap.get(d.stove.stoveId);
  if (sv && S.room?.def?.stoves) lines.push(`Stove: ${ST.stoveName(sv)}${ST.byEye(sv, d.stove.sizeK) ? " (size set by eye)" : ""}`);
  if (sv && faceRoom(S.room?.def)) lines.push(`${S.room.def.inserts ? "Insert" : "Fireplace"}: ${ST.stoveName(sv)}`);
  return lines;
}
function composeImage(maxW = 2400) {
  const look = lookFrom(currentDesign());
  const c = engine.renderToCanvas(look, photoRenderOpts());
  const lines = designSummary();
  const k = Math.min(1, maxW / c.width);
  const W = Math.round(c.width * k), H = Math.round(c.height * k);
  const band = Math.round(W * 0.075) + lines.length * Math.round(W * 0.018);
  const out = document.createElement("canvas"); out.width = W; out.height = H + band;
  const x = out.getContext("2d");
  x.drawImage(c, 0, 0, W, H);
  x.fillStyle = "#121514"; x.fillRect(0, H, W, band);
  const pad = Math.round(W * 0.025), fs = Math.round(W * 0.016);
  x.fillStyle = "#eceae4"; x.font = `800 ${Math.round(fs * 1.5)}px "Big Shoulders Display", sans-serif`;
  x.fillText(STORE.name.toUpperCase() + "  ·  HEARTH STUDIO", pad, H + pad + fs);
  x.font = `500 ${fs}px "Instrument Sans", sans-serif`; x.fillStyle = "#c9ccc6";
  lines.forEach((l, i) => x.fillText(l, pad, H + pad + fs * 2.6 + i * fs * 1.35));
  x.fillStyle = "#8a908b"; x.font = `500 ${Math.round(fs * 0.8)}px "Instrument Sans", sans-serif`;
  x.textAlign = "right";
  x.fillText("Sample stone textures for ideas. See the real stone in our showroom.", W - pad, H + band - pad * 0.7);
  return out;
}
// Save to My ideas, Save to phone (or computer) and Share: three big buttons with icons and no
// instructions to read. On an iPhone the way into Photos is the share sheet's "Save Image", so the
// phone button opens it and says so; Android and computers get a normal download.
let saveUrl = "", saveBlob = null, dlCap;
const isPhone = () => window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const deviceWord = () => (isPhone() ? "phone" : IS_IOS || IS_ANDROID ? "tablet" : "computer");
const designFileName = () => `Hayward Stoveworks fireplace design ${new Date().toISOString().slice(0, 10)}.jpg`;
const designFile = () => new File([saveBlob], designFileName(), { type: "image/jpeg" });
function policyAllows(feature) {
  try {
    const pol = document.permissionsPolicy || document.featurePolicy;
    if (!pol || typeof pol.allowsFeature !== "function") return true;
    if (typeof pol.features === "function" && !pol.features().includes(feature)) return true;   // a feature this browser doesn't police
    return pol.allowsFeature(feature);
  } catch (e) { return true; }
}
function canShareFile(file) {
  try { return policyAllows("web-share") && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }); } catch (e) { return false; }
}
/** In the Claude preview, files are saved through the viewer (it asks first); on the store's site it's a normal download. */
async function downloadsCap() {
  if (dlCap !== undefined) return dlCap;
  try { dlCap = window.claude?.use ? await window.claude.use("downloads") : null; } catch (e) { dlCap = null; }
  return dlCap;
}
function shareText() {
  return `My fireplace design:\n${designSummary().join("\n")}\n\nMade with Hearth Studio at ${STORE.site}`;
}
/** Where a saved picture ends up, in words for the button and the confirmation. */
function savedWhere(viaPhotos) {
  if (viaPhotos) return "Adds it to your Photos. Tap “Save Image” on the next screen.";
  if (deviceWord() === "computer") return "Puts the picture in your Downloads folder";
  if (IS_ANDROID) return "Adds it to your Photos or Gallery app";
  if (IS_IOS) return "Puts it in the Files app, under Downloads";
  return `Keeps a copy on this ${deviceWord()}`;
}
function markSaved(el, title, sub) { if (el) { el.classList.add("done"); el.innerHTML = `<i class="si">${ICON.check}</i><b>${title}</b><span>${sub}</span>`; } }
async function openSaveImage() {
  let blob = null;
  try { const c = composeImage(); blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9)); } catch (e) { /* handled below */ }
  if (!blob) { toast("Couldn't make the picture. Try again."); return; }
  if (saveUrl) URL.revokeObjectURL(saveUrl);
  saveBlob = blob; saveUrl = URL.createObjectURL(blob);
  const dev = deviceWord(), photos = IS_IOS && canShareFile(designFile());
  openLayer(`<div class="hd"><div><h2 class="h">Your design</h2><p class="sub">Keep a copy, or send it to someone.</p></div>${closeBtn}</div>
    <img class="result" src="${saveUrl}" alt="Your fireplace design, with the stone and paint choices listed underneath">
    <div class="savebar" role="group" aria-label="Save or share your design">
      <button class="savebtn" data-a="sv_idea"><i class="si">${ICON.heart}</i><b>Save to My ideas</b><span>Come back to it, or compare it with other ideas</span></button>
      <button class="savebtn" data-a="sv_dl"><i class="si">${ICON.save}</i><b>Save to ${dev}</b><span>${savedWhere(photos)}</span></button>
      <button class="savebtn" data-a="sv_share"><i class="si">${ICON.share}</i><b>Share</b><span>${dev === "computer" ? "Email it or send it to someone" : "Text it or email it to someone"}</span></button>
    </div>
    <div class="sharemore" id="shareMore" hidden></div>`, "wide save");
}
const saveActions = {
  sv_idea: (v, el) => {
    saveIdea();
    if (el) { el.dataset.a = "ideas"; markSaved(el, "Saved to My ideas", "Tap to see your ideas"); }
  },
  sv_dl: async (v, el) => {
    if (!saveBlob) return;
    const name = designFileName(), dev = deviceWord();
    // iPhone and iPad: the share sheet's "Save Image" puts it in Photos
    if (IS_IOS) {
      const file = designFile();
      if (canShareFile(file)) {
        try { await navigator.share({ files: [file] }); markSaved(el, `Saved to ${dev}`, "Look for it in your Photos app"); return; }
        catch (e) { if (e?.name === "AbortError") return; /* blocked here: download instead */ }
      }
    }
    const cap = await downloadsCap();
    if (cap) {
      try { await cap.save({ filename: name, data: saveBlob }); toast("Picture saved"); markSaved(el, `Saved to ${dev}`, savedWhere(false)); return; }
      catch (e) {
        if (e?.code === "declined") return;
        if (e?.code === "rate_limited") { toast("One moment, then try again."); return; }
        if (!["unavailable", "not_granted", "capability_disabled", "capability_removed"].includes(e?.code)) { toast("Couldn't save the picture. Try again."); return; }
        dlCap = null;   // not available in this view: a plain download below
      }
    }
    const a = document.createElement("a");
    a.href = saveUrl; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    toast(dev === "computer" ? "Picture saved to your Downloads folder" : IS_ANDROID ? "Picture saved. Find it in your Photos or Gallery app." : "Picture saved");
    markSaved(el, `Saved to ${dev}`, savedWhere(false));
  },
  sv_share: async () => {
    if (!saveBlob) return;
    const file = new File([saveBlob], designFileName(), { type: "image/jpeg" });
    const text = shareText();
    let sheet = false;
    try { sheet = policyAllows("web-share") && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }); } catch (e) { sheet = false; }
    if (sheet) {
      try { await navigator.share({ files: [file], title: "My fireplace design", text }); return; }
      catch (e) { if (e?.name === "AbortError") return; /* blocked: offer the other ways below */ }
    }
    // No share sheet on this device: email it, text it, or copy the picture to paste somewhere
    const box = $("#shareMore"); if (!box) return;
    const copy = !!(navigator.clipboard?.write && window.ClipboardItem) && policyAllows("clipboard-write");
    const tgt = window.top !== window.self ? ` target="_blank" rel="noopener"` : "";
    const subject = encodeURIComponent(`My fireplace design from ${STORE.name}`), body = encodeURIComponent(text);
    box.innerHTML = `<p class="sub">${copy ? "Copy the picture, then paste it into an email or a message. Or start an email with the details." : "Save the picture first, then start an email with the details and attach it."}</p>
      <div class="row">${copy ? `<button class="btn" data-a="sv_copy">${ICON.copy}Copy the picture</button>` : ""}
        <a class="btn" href="mailto:?subject=${subject}&body=${body}"${tgt}>${ICON.mail}Email it</a>
        ${isPhone() ? `<a class="btn" href="sms:?&body=${body}"${tgt}>${ICON.chat}Text it</a>` : ""}</div>`;
    box.hidden = false;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
  sv_copy: async () => {
    try {
      const c = composeImage(1600);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": new Promise((res) => c.toBlob(res, "image/png")) })]);
      toast("Picture copied. Paste it into an email or a message.");
    } catch (e) { toast(`This browser wouldn't copy the picture. Use “Save to ${deviceWord()}” instead.`); }
  },
};

// ------------------------------------------------------------------ send to store / phone / help
function openSend() {
  const E = estimate();
  const thumb = (() => { try { return composeImage(720).toDataURL("image/jpeg", 0.82); } catch (e) { return ""; } })();
  openLayer(`<div class="hd"><div><div class="eyebrow">${STORE.name}</div><h2 class="h">Send this design to the store</h2>
      <p class="sub">We'll look at your design and get back to you about stone, stoves and installation. No pressure, no prices in this tool.</p></div>${closeBtn}</div>
    <form id="sendForm" class="two" novalidate>
      <div class="field"><label for="f_name">Your name</label><input id="f_name" autocomplete="name" required></div>
      <div class="field"><label for="f_contact">Phone or email</label><input id="f_contact" autocomplete="email" required></div>
      <div class="field"><label for="f_town">Town or ZIP code</label><input id="f_town" autocomplete="postal-code"></div>
      <div class="field"><label for="f_when">When are you hoping to do this?</label><select id="f_when"><option>Just gathering ideas</option><option>In the next few months</option><option>This season</option><option>As soon as possible</option></select></div>
      <div class="field"><label for="f_heat">Heat source</label><select id="f_heat">${["Not sure yet", "Wood stove", "Gas stove or fireplace", "Fireplace insert", "Stone only, no stove"].map((o) => `<option${o === heatGuess() ? " selected" : ""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label for="f_note">Anything else?</label><textarea id="f_note" placeholder="Chimney height, existing hearth, questions…"></textarea></div>
      <div style="grid-column:1/-1;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        ${thumb ? `<img src="${thumb}" alt="" style="width:180px;border-radius:8px">` : ""}
        <div class="note" style="flex:1;min-width:200px">Attached: your design picture${SHOW_ESTIMATE ? `, ${E.rows.length ? `the estimate (${fmt(E.total, 0)} sq ft of stone, ${fmt(E.totalC, 0)} lin ft of corners)` : "no stone areas yet"}${S.room.kind === "photo" ? ", and your photo" : ""}` : S.room.kind === "photo" ? " and your photo" : ""}.</div>
        <button class="btn primary" type="submit">${ICON.send}Send to ${STORE.name}</button></div>
    </form>`, "wide");
  $("#sendForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#f_name").value.trim(), contact = $("#f_contact").value.trim();
    if (!name || !contact) { toast("Add your name and a phone number or email so we can reach you."); return; }
    const summary = designSummary();
    track("quotes");
    openLayer(`<div class="hd"><div><div class="eyebrow">Preview of what the store receives</div><h2 class="h">Thanks, ${esc(name)}</h2>
      <p class="sub">In the live tool this arrives in the store's inbox with the picture and estimate attached. This preview doesn't send anything.</p></div>${closeBtn}</div>
      <div class="detail"><dl class="facts">
        <dt>From</dt><dd>${esc(name)} · ${esc(contact)}${$("#f_town")?.value ? " · " + esc($("#f_town").value) : ""}</dd>
        <dt>Timing</dt><dd>${esc($("#f_when")?.value || "")}</dd>
        <dt>Heat</dt><dd>${esc($("#f_heat")?.value || "")}</dd>
        <dt>Design</dt><dd>${summary.map(esc).join("<br>") || "No stone yet"}</dd>
        ${SHOW_ESTIMATE ? `<dt>Estimate</dt><dd>${fmt(E.total)} sq ft · ${fmt(E.totalC)} lin ft corners</dd>` : ""}
        <dt>Room</dt><dd>${S.room.kind === "photo" ? "Customer photo (private)" : esc(S.room.def?.name || "")}</dd>
      </dl></div>`);
  });
}

function shareCode() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s.slice(0, 3) + "-" + s.slice(3);
}
function qrSVG(text) {
  try {
    // global from qrcode-generator (cdnjs)
    const q = window.qrcode(0, "M"); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  } catch (e) { return `<div class="note">QR code unavailable</div>`; }
}
function openPhone() {
  const code = shareCode();
  const url = `https://${STORE.site}/d/${code.replace("-", "").toLowerCase()}`;
  openLayer(`<div class="hd"><div><h2 class="h">Take this design home</h2><p class="sub">Point your phone's camera at the code. Your design opens on your phone, ready to keep working on or send to us.</p></div>${closeBtn}</div>
    <div class="row" style="gap:24px;align-items:center">
      <div class="qr" aria-label="QR code">${qrSVG(url)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        <div class="eyebrow">Or type this code at ${STORE.site}</div><div class="code">${code}</div>
        <p class="note">Preview: these links start working once saving is connected to the store's site.</p>
        <p class="note">Nothing from this screen is kept on the kiosk after you leave.</p>
      </div></div>`);
}
function openHelp() {
  openLayer(`<div class="hd"><div><h2 class="h">Someone's on the way</h2><p class="sub">A member of our team will be right with you. Keep designing while you wait.</p></div>${closeBtn}</div>
    <p class="note">Preview: in the showroom this alerts staff on the store's tablet or phone.</p>`);
}

// ------------------------------------------------------------------ saved ideas + compare
function saveIdea() {
  if (S.room.kind !== "scene" && S.room.kind !== "photo") return;
  let thumb = "";
  try { thumb = composeImage(360).toDataURL("image/jpeg", 0.75); } catch (e) { /* no thumb */ }
  const lines = designSummary();
  const idea = { id: Date.now().toString(36), room: S.roomId, variant: S.variant[S.roomId], light: S.light, design: JSON.parse(JSON.stringify(currentDesign())), name: lines[0]?.split(": ")[1]?.split(" (")[0] || "Idea", thumb };
  S.ideas.unshift(idea);
  S.ideas = S.ideas.slice(0, 12);
  if (S.mode !== "kiosk" && S.roomId !== "photo") store.set("ideas", S.ideas);
  toast("Saved to your ideas");
  track("saves");
  renderChrome();
}
function openIdeas(forCompare) {
  const list = S.ideas.filter((i) => !forCompare || i.room === S.roomId);
  openLayer(`<div class="hd"><div><h2 class="h">${forCompare ? "Compare with an idea" : "Your ideas"}</h2>
      <p class="sub">${forCompare ? "Pick a saved idea. It shows on the left; your current design on the right." : "Save looks as you go, then compare them side by side."}</p></div>${closeBtn}</div>
    <div class="row"><button class="btn primary" data-a="saveidea">${ICON.heart}Save the current design</button></div>
    ${list.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${list.map((i) => `
      <div class="card"><img src="${i.thumb}" alt=""><span class="t"><span class="n">${esc(i.name)}</span><span class="c">${esc(roomDef(i.room)?.name || "Your photo")}</span>
      <span class="row" style="margin-top:6px">${forCompare ? `<button class="btn small primary" data-a="cmpidea" data-v="${i.id}">Compare</button>` : `<button class="btn small" data-a="openidea" data-v="${i.id}">Open</button>${i.room === S.roomId ? `<button class="btn small" data-a="cmpidea" data-v="${i.id}">Compare</button>` : ""}`}
      <button class="btn small ghost" data-a="delidea" data-v="${i.id}" aria-label="Delete">${ICON.x}</button></span></span></div>`).join("")}</div>`
      : `<p class="note">${forCompare ? "No saved ideas for this room yet. Save one, change the stone, then compare." : "No ideas saved yet."}</p>`}
    ${S.mode !== "kiosk" ? `<p class="note">Ideas are kept in this browser. Signing in on the store's site keeps them on all your devices.</p>` : `<p class="note">Ideas are cleared when you start over. Use “Send to my phone” to keep them.</p>`}`, "wide");
}
const ideaActions = {
  saveidea: () => { const wasOpen = !!$("#layer .scrim"); saveIdea(); if (wasOpen) openIdeas(false); },
  openidea: async (id) => {
    const i = S.ideas.find((x) => x.id === id); if (!i) return;
    S.design[i.room] = JSON.parse(JSON.stringify(i.design));
    if (i.room !== "photo") { S.variant[i.room] = i.variant; S.light = i.light; }
    closeLayer(); await setRoom(i.room);
  },
  cmpidea: async (id) => {
    const i = S.ideas.find((x) => x.id === id); if (!i) return;
    await Promise.all([...stonesInDesign(i.design).map(ensureStone), ensureStove(i.design?.stove?.stoveId)]);
    let sceneB = null;
    const r = S.room, iv = r?.kind === "scene" && onOpen(r.def, i.design) ? "open" : i.variant;
    if (r?.kind === "scene" && iv && iv !== r.variantId && r.sj.variants[iv]) {
      const noFireB = !!r.def.variants.find((x) => x.id === iv)?.noFire && !i.design?.stove;
      const sb = sceneFor(await sceneEntry(r.id, iv, S.light), noFireB);
      setCmpScene(sb); sceneB = sb.scene;
    }
    S.compare = { mode: "look", split: 0.5, lookB: lookFrom(i.design), nameB: i.name, sceneB };
    closeLayer(); renderChrome(); renderChips(); drawOverlay(); invalidate();
  },
  delidea: (id) => { S.ideas = S.ideas.filter((x) => x.id !== id); store.set("ideas", S.ideas); openIdeas(false); renderChrome(); },
};

// ------------------------------------------------------------------ kiosk: attract + idle
function enterAttract() {
  S.attract = true; S.attractT = performance.now(); S.attractIdx = 0;
  $("#app").classList.add("attracting");
  let el = $("#attract");
  if (!el) {
    el = document.createElement("div"); el.id = "attract"; el.className = "attract";
    el.innerHTML = `<img class="att-logo" src="assets/brand/badge-light-640.png" alt="Hayward Stoveworks, established 1975, Hayward, Wisconsin">
      <h1>See it in stone.</h1><p>Try Buechel stone on a chimney, hearth or accent wall, in a sample room or on a photo of your own.</p>
      <button class="cta" type="button"><span class="flame"></span>Touch to Start</button><div class="now" id="attractNow"></div>
      <button class="attract-exit" type="button" data-a="mode" data-v="web">Back to the website preview</button>`;
    document.body.appendChild(el);
    // Start on a tap (finger or mouse) anywhere. Scrolling, swiping or a hand brushing past doesn't start it.
    let down = null;
    el.addEventListener("pointerdown", (e) => { down = e.target.closest(".attract-exit") ? null : { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
    el.addEventListener("pointermove", (e) => { if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) down = null; });
    el.addEventListener("pointerup", (e) => { const d = down; down = null; if (d && e.pointerId === d.id && performance.now() - d.t < 1500) exitAttract(); });
    el.addEventListener("pointercancel", () => { down = null; });
    el.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  }
  el.querySelector(".attract-exit").hidden = S.kioskLocked;   // only in the preview; the shop screen stays in showroom mode
  el.hidden = false;
  clearTransient();
  S.attractReturn = S.roomId === "photo" && S.photo ? "photo" : null;
  if (S.roomId === "photo") setRoom("cabin");
  updateAttractCaption();
  setTimeout(refit, 60);
}
function exitAttract(counted = true) {
  if (!S.attract) return;
  if (counted) track("sessions");
  S.attract = false; S.attractWipe = null;
  const el = $("#attract"); if (el) el.hidden = true;
  $("#app").classList.remove("attracting");
  if (S.attractReturn === "photo" && S.photo) { S.attractReturn = null; setRoom("photo"); }
  setTimeout(refit, 30);
}
function updateAttractCaption() {
  const d = currentDesign(); const g = S.room?.groups[0];
  const st = g ? S.cat.get(d[g.id]?.stone) : null;
  const el = $("#attractNow"); if (el && st) el.textContent = `Now showing: ${st.name} · ${S.room.def?.name || ""}`;
}
async function attractTick(t) {
  if (S.attractWipe || t - S.attractT < 5200 || S._attractBusy) return;
  S._attractBusy = true;
  S.attractT = t;
  S.attractIdx++;
  const id = ATTRACT_STONES[S.attractIdx % ATTRACT_STONES.length];
  const from = lookFrom(currentDesign());
  await ensureStone(id);
  if (!S.attract) { S._attractBusy = false; return; }   // someone tapped in while the stone loaded: leave their screen alone
  const d = currentDesign();
  for (const g of S.room.groups) if (d[g.id]?.mode === "stone") { d[g.id].stone = id; d[g.id].joint = S.cat.get(id).defaultJoint || "standard"; d[g.id].mortar = d[g.id].joint === "dry" ? "charcoal" : "natural"; }
  if (S.attractIdx % 4 === 0 && S.room.kind === "scene") {
    S.light = S.light === "day" ? "eve" : "day";
    await setRoom(S.roomId);
  } else {
    S.attractWipe = { from, to: lookFrom(d), t0: performance.now() };
    invalidate(1600);
  }
  updateAttractCaption();
  S._attractBusy = false;
}
let idleSheet = null;
function idleCheck() {
  if (S.mode !== "kiosk" || S.attract) return;
  const idle = (performance.now() - S.lastInput) / 1000;
  if (idle > S.settings.idle && !idleSheet) {
    let n = 30;
    openLayer(`<div class="hd"><div><h2 class="h">Still designing?</h2><p class="sub">We'll clear this screen for the next person in <b id="idleN">${n}</b> seconds.</p></div></div>
      <div class="row"><button class="btn primary" data-a="close">I'm still here</button><button class="btn" data-a="startover">Start over now</button></div>`);
    idleSheet = setInterval(() => {
      n--; const el = $("#idleN"); if (el) el.textContent = n;
      if (!el) { clearInterval(idleSheet); idleSheet = null; S.lastInput = performance.now(); return; }
      if (n <= 0) { clearInterval(idleSheet); idleSheet = null; resetKiosk(false); }
    }, 1000);
  }
}
async function resetKiosk(manual) {
  if (idleSheet) { clearInterval(idleSheet); idleSheet = null; }
  closeLayer();
  clearTransient(); disposePhotoTex();
  S.attractReturn = null;
  stopLookup(true); S.lk = { q: "", state: "idle" }; S.paintFor = null; S.myPaints = []; S.mixOpen = false;
  S.photo = null; S.ideas = []; S.compare = { mode: "off", split: 0.5 }; S.grid = false; S.target = "all"; S.tab = "stone";
  S.filters = { style: "All", tone: "All", q: "" };
  for (const r of ROOMS) S.design[r.id] = JSON.parse(JSON.stringify(r.defaults));
  S.light = "day"; S.variant = { cabin: "trad", linear: "linear", masonry: "masonry" };
  try { localStorage.removeItem("hs.design"); localStorage.removeItem("hs.hinted"); } catch (e) { /* storage blocked */ }
  S.hinted = false;
  await setRoom("cabin");
  if (manual) toast("Cleared for the next person");
  if (S.mode === "kiosk") enterAttract();
}

// ------------------------------------------------------------------ staff panel (showroom): long-press the logo
function openStaff() {
  const st = store.get("stats", { since: "", sessions: 0, photos: 0, quotes: 0, saves: 0, picks: {} });
  const picks = Object.entries(st.picks || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...picks.map((p) => p[1]));
  openLayer(`<div class="hd"><div><div class="eyebrow">Staff · this screen only</div><h2 class="h">Showroom screen</h2>
      <p class="sub">Counts are kept on this device${st.since ? ` since ${esc(st.since)}` : ""}. In the live system they roll up in /admin with the inquiries.</p></div>${closeBtn}</div>
    <div class="est" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${[["sessions", "Customers started"], ["photos", "Own photos"], ["saves", "Ideas saved"], ["quotes", "Quote requests"]].map(([k, l]) => `<div class="stat"><div class="num">${st[k] || 0}</div><div class="l">${l}</div></div>`).join("")}
    </div>
    <div class="group"><div class="eyebrow">Most-tried stones</div>
      ${picks.length ? `<table class="t"><tbody>${picks.map(([id, n]) => `<tr><td style="width:46%">${esc(S.cat.get(id)?.name || id)}</td><td><div style="height:10px;border-radius:5px;background:var(--accent);width:${Math.round((n / max) * 100)}%"></div></td><td class="n">${n}</td></tr>`).join("")}</tbody></table>` : `<p class="note">No picks yet.</p>`}</div>
    <div class="two">
      <div class="group"><div class="eyebrow">Estimate settings</div>
        ${slider("st_waste", "Cutting allowance", S.settings.waste, 0, 0.25, 0.01, (v) => `${Math.round(v * 100)}%`)}
        ${slider("st_cc", "Flats covered per ft of corners", S.settings.cornerCredit, 0, 1, 0.05, (v) => `${v} sq ft`)}</div>
      <div class="group"><div class="eyebrow">Photo helper</div>
        <label class="check"><input type="checkbox" id="st_ai" ${S.settings.aiPhotos !== false ? "checked" : ""}><span>Let Claude look at customers' photos to find the wall and the stove. Off: customers tap the wall once instead.</span></label></div>
      <div class="group"><div class="eyebrow">Idle reset</div>
        ${slider("st_idle", "Ask “Still designing?” after no touches for", Math.round(S.settings.idle / 60), 2, 30, 1, (v) => `${v} min`)}
        <p class="note">Then it waits another 30 seconds before clearing the screen.</p>
        <div class="row"><button class="btn small" data-a="startover">Reset the screen now</button><button class="btn small ghost" data-a="clearstats">Clear counts</button></div>
        ${S.kioskLocked ? `<button class="btn small ghost" data-a="unlock">Switch this screen to the website preview</button>` : ""}</div>
    </div>`, "wide");
  const bind = (id, k, f, scale = 1) => { const e = $("#s_" + id); if (e) e.addEventListener("input", () => { S.settings[k] = +e.value * scale; $("#o_" + id).textContent = f(+e.value); store.set("settings", S.settings); if (S.tab === "estimate") renderRail(); }); };
  bind("st_waste", "waste", (v) => `${Math.round(v * 100)}%`);
  bind("st_cc", "cornerCredit", (v) => `${v} sq ft`);
  bind("st_idle", "idle", (v) => `${v} min`, 60);
  const ai = $("#st_ai"); if (ai) ai.addEventListener("change", () => { S.settings.aiPhotos = ai.checked; store.set("settings", S.settings); });
}
(() => {
  const logo = document.querySelector(".brand");
  let t = 0;
  logo.addEventListener("pointerdown", () => { t = setTimeout(openStaff, 1400); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((e) => logo.addEventListener(e, () => clearTimeout(t)));
  logo.addEventListener("dblclick", (e) => { if (e.shiftKey) openStaff(); });
})();

// ------------------------------------------------------------------ own photo: loading (JPEG, PNG, WebP and iPhone HEIC)
function photoRenderOpts() {
  if (S.roomId !== "photo" || !S.photo) return {};
  const L = S.photo.light;
  const w = L.warmth;
  const tint = [1 + 0.12 * w, 1 + 0.02 * w, 1 - 0.14 * w];
  return { expo: L.expo * (0.72 / wallAlbedo()), tint, relief: L.relief };
}

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
// iPhones convert HEIC to JPEG on upload when the picker only asks for images; elsewhere, accept .heic files explicitly.
const PHOTO_ACCEPT = IS_IOS ? "image/*" : "image/*,.heic,.heif";

function openPhotoPicker() {
  const k = S.mode === "kiosk";
  if (helperOn()) Seg.preload();
  openLayer(`<div class="hd"><div><h2 class="h">Use a photo of your room</h2>
      <p class="sub">Stand back far enough to get the whole wall, hold the phone level, and turn on the lights you normally use.</p></div>${closeBtn}</div>
    ${k ? `<div class="row" style="gap:24px;align-items:center"><div class="qr">${qrSVG(`https://${STORE.site}/up/${shareCode().replace("-", "").toLowerCase()}`)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:40ch"><b>Scan with your phone and take a picture of your wall.</b>
      <span class="note">It appears on this screen in a few seconds. Your photo stays private and is cleared when you start over.${claudeOn() && helperOn() ? " To find the wall, Claude (an AI) may look at it." : ""}</span>
      <span class="note">Preview: phone upload starts working once the store's site is connected. Try the sample photo instead.</span></div></div>`
    : `<label class="drop" id="drop"><b>Drop a photo here, or choose one</b><span class="note">Any photo from your phone or camera works, including iPhone photos. It's only sent to the store if you choose to${claudeOn() && helperOn() ? ". To find the wall, Claude (an AI) may look at it" : ""}.</span>
       <input type="file" id="fileIn" accept="${PHOTO_ACCEPT}" style="max-width:100%"></label>`}
    <div class="row"><button class="btn" data-a="samplephoto">Try a sample photo</button><span class="note">A different view of the lake cabin, ready to outline.</span></div>`);
  const fi = $("#fileIn");
  if (fi) fi.addEventListener("change", () => fi.files[0] && takePhotoFile(fi.files[0]));
  const drop = $("#drop");
  if (drop) {
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) takePhotoFile(f); });
  }
}
stage.addEventListener("dragover", (e) => { if (S.mode !== "kiosk") e.preventDefault(); });
stage.addEventListener("drop", (e) => { if (S.mode === "kiosk") return; e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) takePhotoFile(f); });

/** HEIF family (iPhone photos): 'ftyp' box with a HEIC/HEIF brand. */
function looksHeic(buf, file) {
  try {
    const b = new Uint8Array(buf, 0, Math.min(64, buf.byteLength));
    const tag = String.fromCharCode(...b.slice(4, 8));
    const brands = String.fromCharCode(...b.slice(8, Math.min(b.length, 40)));
    if (tag === "ftyp" && /heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(brands) && !/avif|avis/.test(brands)) return true;
  } catch (e) { /* not readable */ }
  return /\.(heic|heif)$/i.test(file?.name || "") || /image\/hei[cf]/i.test(file?.type || "");
}
let heicLib = null;
function loadHeicLib() {
  // CSP-safe build (no eval); the decoder ships inside the module and runs in a blob worker.
  heicLib = heicLib || import("https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js");
  return heicLib;
}
function photoProgress(msg) {
  openLayer(`<div class="hd"><div><h2 class="h">${esc(msg)}</h2><p class="sub">This takes a few seconds for iPhone photos.</p></div></div><div class="busyrow"><div class="sp"></div></div>`);
}
async function takePhotoFile(file) {
  let buf;
  try { buf = await file.arrayBuffer(); } catch (e) { toast("That file couldn't be read. Try choosing it again."); return; }
  // 1) the browser's own decoder (Safari also opens HEIC itself)
  try {
    const c = await P.loadPhotoFile(file, 2400);
    startPhoto(c, G.exifFocal35(buf));
    return;
  } catch (e) { /* fall through */ }
  // 2) iPhone HEIC on browsers that can't show it: convert here, on this device
  if (looksHeic(buf, file)) {
    photoProgress("Opening your iPhone photo…");
    try {
      const lib = await loadHeicLib();
      const jpeg = await lib.heicTo({ blob: new Blob([buf]), type: "image/jpeg", quality: 0.92 });
      const c = await P.loadPhotoFile(jpeg, 2400);
      startPhoto(c, 26);                      // iPhone main camera is about 26 mm equivalent
      return;
    } catch (e) {
      openLayer(`<div class="hd"><div><h2 class="h">That photo didn't open</h2>
        <p class="sub">It's an iPhone photo in HEIC format, and this browser couldn't convert it.</p></div>${closeBtn}</div>
        <p class="sub">Two easy ways around it:</p>
        <ul class="sub"><li>Open this page on the iPhone itself and pick the photo there. The phone sends it in a format every browser opens.</li>
        <li>Or try the same photo in Safari, Chrome or Edge on another device.</li></ul>`);
      return;
    }
  }
  toast("That file isn't a photo we can open. Try a JPEG, PNG or iPhone photo.");
}
async function samplePhoto() {
  closeLayer(); busy(true);
  try { const img = await loadImg("assets/sample-photo.jpg"); startPhoto(P.imageToCanvas(img, 2400), 26, { distIn: 156, sample: true }); }
  catch (e) { toast("The sample photo isn't available."); }
  busy(false);
}

// ------------------------------------------------------------------ own photo: kept in this browser (website only)
// The showroom screen never stores a customer's photo. On the website the last photo, its outlines and
// the stone choices are kept in this browser so a returning visitor finds their wall again.
const idb = {
  db: null,
  open() {
    return this.db || (this.db = new Promise((res, rej) => {
      try { const r = indexedDB.open("hearth-studio", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
      catch (e) { rej(e); }
    }));
  },
  async req(mode, fn) {
    try {
      const db = await this.open();
      return await new Promise((res, rej) => { const t = db.transaction("kv", mode); const q = fn(t.objectStore("kv")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
    } catch (e) { return null; }
  },
  get(k) { return this.req("readonly", (st) => st.get(k)); },
  set(k, v) { return this.req("readwrite", (st) => st.put(v, k)); },
  del(k) { return this.req("readwrite", (st) => st.delete(k)); },
};
const canSave = () => S.mode !== "kiosk" && !S.kioskLocked;
let saveSig = "", saving = false;
async function autosavePhoto() {
  const ph = S.photo;
  if (!ph || !canSave() || saving || wd) return;
  const sig = areasSnap() + JSON.stringify(S.design.photo || {}) + JSON.stringify(ph.light) + "|" + ph.paintOps.length + "|" + ph.paintVer;
  if (sig === saveSig) return;
  saving = true;
  try {
    if (!ph.blob) ph.blob = await new Promise((res) => ph.canvas.toBlob(res, "image/jpeg", 0.9));
    const paint = [];
    for (const op of ph.paintOps) {
      if (op.t === "magic" || op.t === "magicopen") { if (!op.png) op.png = await new Promise((res) => op.c.toBlob(res, "image/png")); paint.push({ t: op.t, png: op.png, auto: !!op.auto }); }
      else paint.push({ t: op.t, r: op.r, pts: op.pts });
    }
    await idb.set("photo1", { v: 1, photo: ph.blob, f35: ph.f35, focalKnown: ph.focalKnown, distIn: ph.distIn, areas: JSON.parse(areasSnap()), cur: ph.cur, design: S.design.photo, light: ph.light, paint, savedAt: Date.now() });
    saveSig = sig;
  } catch (e) { /* storage unavailable: the photo just isn't kept */ }
  saving = false;
}
setInterval(autosavePhoto, 2500);
const blobImage = (blob) => new Promise((res, rej) => { const u = URL.createObjectURL(blob); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = (e) => { URL.revokeObjectURL(u); rej(e); }; i.src = u; });
async function restorePhoto() {
  if (!canSave() || location.hash === "#showroom") return;
  const d = await idb.get("photo1");
  if (!d || !d.photo || S.photo) return;
  try {
    const img = await blobImage(d.photo);
    const ph = makePhoto(P.imageToCanvas(img, 2400), d.focalKnown ? d.f35 : null, { distIn: d.distIn });
    ph.f35 = d.f35 || 26; ph.f = G.focalPx(ph.width, ph.height, ph.f35); ph.focalKnown = !!d.focalKnown;
    ph.blob = d.photo;
    ph.areas = (d.areas || []).map((a) => ({ ...a, sections: a.sections.map((x) => ({ pts: x.pts, cf: x.cf || x.pts.map(() => false), closed: !!x.closed })) }));
    ph.cur = clamp(d.cur || 0, 0, Math.max(0, ph.areas.length - 1));
    ph.light = { ...ph.light, ...(d.light || {}) };
    ph.wizard = null;
    ph.paintOps = [];
    for (const op of d.paint || []) {
      if (op.t === "magic" || op.t === "magicopen") { try { const im = await blobImage(op.png); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); ph.paintOps.push({ t: op.t, c, png: op.png, auto: !!op.auto }); } catch (e) { /* skip */ } }
      else ph.paintOps.push(op);
    }
    for (const a of ph.areas) { const n = parseInt(String(a.id).replace(/\D/g, ""), 10); if (n > areaN) areaN = n; }
    if (!ph.areas.length || S.photo) return;
    S.photo = ph;
    S.design.photo = d.design || {};
    for (const a of ph.areas) if (!S.design.photo[a.id]) S.design.photo[a.id] = defaultAreaDesign();
    sanitizeSel(); replayPaint();
    saveSig = areasSnap() + JSON.stringify(S.design.photo) + JSON.stringify(ph.light) + "|" + ph.paintOps.length + "|" + ph.paintVer;
    if (S.tab === "room") renderRail();
    toast("Your photo from last time is here.", { a: "openphoto", label: "Open it" });
  } catch (e) { /* the saved photo couldn't be read: ignore it */ }
}
async function forgetPhoto() {
  await idb.del("photo1");
  saveSig = "";
  if (S.roomId === "photo") await setRoom("cabin");
  disposePhotoTex();
  S.photo = null; S.design.photo = {};
  if (roomPopOpen) toggleRoomPop(false);
  renderAll();
  toast("Your photo was removed from this browser.");
}

// ------------------------------------------------------------------ own photo: model
// An AREA is one flat surface (one angle, one size, one stone). It holds one or more SECTIONS:
// outlined shapes on that surface, e.g. the wall on each side of a stove pipe. Stone lines up across sections.
const ZERO_H = [[0, 0, 0], [0, 0, 0], [0, 0, 1]];
const AREA_KINDS = ["Main wall", "Chimney face", "Chimney side", "Hearth front", "Hearth side", "Accent wall", "Other"];
const newSection = () => ({ pts: [], cf: [], closed: false });     // cf[i]: edge i -> i+1 is an outside corner
const curArea = () => S.photo?.areas[S.photo.cur];
const curSec = () => { const a = curArea(); return a ? a.sections[S.photo.sel.sec] || null : null; };
const closedSecs = (a) => (a ? a.sections.filter((s) => s.closed && s.pts.length >= 3) : []);
const doneAreas = () => (S.photo ? S.photo.areas.filter((a) => closedSecs(a).length) : []);
function areaLabel(a) {
  const ph = S.photo; if (!ph || !a) return "";
  const same = ph.areas.filter((x) => x.label === a.label);
  return same.length > 1 ? `${a.label} ${same.indexOf(a) + 1}` : a.label;
}
let areaN = 0;

// Until the customer measures something, the size comes from how far back the camera probably
// was. People frame a fireplace or stove wall so the picture's height covers about 10 ft of wall
// (floor to ceiling plus a little), so the distance follows from the lens and whether the photo
// is upright or sideways.
// (Before, the longest upright edge of the outline was taken as 8 ft, which made the stone tiny on
// a small outline such as a hearth front.) The sample photo knows its own distance.
const FRAME_GUESS_IN = 120;
const CAMERA_GUESS_IN = 120;
function makePhoto(canvasImg, f35, opt = {}) {
  const W = canvasImg.width, H = canvasImg.height;
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const thumbC = document.createElement("canvas"); thumbC.width = 240; thumbC.height = Math.round(240 * H / W);
  thumbC.getContext("2d").drawImage(canvasImg, 0, 0, thumbC.width, thumbC.height);
  disposePhotoTex();
  return {
    canvas: canvasImg, width: W, height: H, f35: f35 || 26, f: G.focalPx(W, H, f35 || 26), focalKnown: !!f35,
    distIn: opt.distIn || Math.round(clamp(FRAME_GUESS_IN * G.focalPx(W, H, f35 || 26) / H, 48, 240)),
    areas: [], cur: -1, sel: { sec: 0, pt: -1 },
    occ: mk(), open: mk(), paintOps: [], paintVer: 0, cuts: null, cutsVer: -1, lightKey: "",
    thumb: thumbC.toDataURL("image/jpeg", 0.8),
    wizard: { step: "outline", back: null }, tool: "front", brush: 34, lastKind: "mouse", hover: null, outlineMode: "tap",
    light: { expo: 1, warmth: 0, relief: 1, dir: 90, str: 0.35, auto: true, wall: "auto" }, lightData: null, tex: null,
    hist: { undo: [], redo: [] },
  };
}
function startPhoto(canvasImg, f35, opt) {
  closeLayer();
  stopAuto();
  track("photos");
  S.photo = makePhoto(canvasImg, f35, opt);
  S.design.photo = {};
  S.roomId = "photo";
  S.compare = { mode: "off", split: 0.5, lookB: null, nameB: "" };
  S.target = "all";
  closeCard();
  addArea({ silent: true });
  buildPhotoRoom();
  renderAll();
  setTimeout(refit, 40);
  if (helperOn()) startAuto();
}
function disposePhotoTex() {
  const t = S.photo?.tex; if (!t) return;
  [t.base, t.irr, ...(t.masks || [])].forEach((x) => x && engine.deleteTex(x));
  S.photo.tex = null;
}

function buildPhotoRoom() {
  const ph = S.photo; if (!ph) return;
  if (!ph.tex) { ph.tex = { base: engine.texFromImage(ph.canvas), masks: [], irr: null }; ph.lightKey = ""; }
  if (S.room?.kind === "scene") disposeRoomTex(S.room);
  S.roomId = "photo";
  S.room = { kind: "photo", id: "photo", def: null, width: ph.width, height: ph.height, zones: [], vzones: [], groups: [] };
  syncPhotoZones();
  rebuildMasks(true);
  engine.setScene({ width: ph.width, height: ph.height, base: ph.tex.base, masks: ph.tex.masks, irr: { tex: ph.tex.irr, mode: 1, range: [0, 0] }, grad: null, composite: 1, drywall: [0.72, 0.72, 0.72], zones: S.room.zones });
  syncLayout();
  sizeCanvas(); engine.fit();
  invalidate();
}

/** Recompute every area's wall mapping and hand the zones to the renderer. Cheap; masks are separate. */
function syncPhotoZones() {
  const ph = S.photo; if (!ph || S.room?.kind !== "photo") return;
  ph.areas.forEach(computeArea);
  const g = photoGrad();
  const zones = ph.areas.map((a, k) => ({ id: a.id, H: a.map ? a.map.H : ZERO_H, mask: [(k / 3) | 0, k % 3], grad: zoneGrad(a, g) }));
  S.room.zones = zones; S.room.vzones = zones;
  S.room.groups = ph.areas.map((a) => ({ id: a.id, label: areaLabel(a), hint: "", zones: [a.id] }));
  if (engine.scene && engine.scene.composite === 1) engine.scene.zones = zones;
}

/** Is this area's size a guess (or set by eye) rather than measured? */
const sizeIsGuess = (a) => !a?.measure || !!a.measure.guessed || !!a.measure.eyeballed || (a.sizeK || 1) !== 1;
/** Before the Size step: what the customer set by eye becomes the measuring line's length, so the line
 *  shows the size the stone is drawn at. */
function foldSize(a) {
  const k = a?.sizeK || 1;
  if (k !== 1 && a.measure) a.measure = { ...a.measure, inches: Math.round((a.measure.inches / k) * 10) / 10, guessed: false, auto: false, eyeballed: true };
  if (a) a.sizeK = 1;
}
function computeArea(a) {
  const ph = S.photo;
  const secs = closedSecs(a);
  if (!secs.length) { a.map = null; a.areaSqft = 0; a.cornerLnft = 0; return; }
  if (!a.measure || a.measure.auto || a.measure.guessed) {
    const auto = !a.measure || a.measure.auto, guessed = !a.measure || a.measure.guessed;
    const g = auto ? guessMeasure(secs) : { a: a.measure.a, b: a.measure.b };
    const inches = guessed ? guessInches(a, secs, g) : a.measure.inches;
    a.measure = { a: g.a, b: g.b, inches, guessed, auto };
  }
  // Size & angle: sizeK makes the stones bigger (the wall works out smaller, so the estimate follows);
  // rot (degrees) levels the stone courses on a photo taken a little crooked
  const k = a.sizeK || 1;
  a.map = G.areaMapping(ph.width, ph.height, ph.f, { sections: secs.map((s) => s.pts), theta: a.theta, phi: a.phi, measure: k === 1 ? a.measure : { ...a.measure, inches: a.measure.inches / k }, rot: (a.rot || 0) * G.D2R });
  if (!a.map) { a.areaSqft = 0; a.cornerLnft = 0; return; }
  a.areaSqft = a.map.wallSecs.reduce((t, w) => t + G.shoelace(w), 0) / 144;
  a.cornerLnft = secs.reduce((t, s, si) => {
    const w = a.map.wallSecs[si];
    return t + s.cf.reduce((u, on, i) => (on ? u + Math.hypot(w[i][0] - w[(i + 1) % w.length][0], w[i][1] - w[(i + 1) % w.length][1]) / 12 : u), 0);
  }, 0);
}
/** First guess at the measuring line's length, before the customer measures anything: the wall at
 *  the outline's middle is ph.distIn from the camera, unless the outline's lowest point says it
 *  must be closer. Nothing sits below the floor, so with the phone about 5 ft up, a point that
 *  low in the picture can only be so far away. That catches a hearth front, which sticks out
 *  toward the camera. */
const CAMERA_HEIGHT_IN = 60;
function guessInches(a, secs, g) {
  const ph = S.photo, f = ph.f, cx = ph.width / 2, cy = ph.height / 2;
  const pts = secs.flatMap((s) => s.pts), c = G.centroid(pts);
  const { Hinv } = G.planeHomography(ph.width, ph.height, f, a.theta, a.phi, c[0], c[1]);
  if (!Hinv) return 96;
  let perUnit = ph.distIn || CAMERA_GUESS_IN;          // inches per plane unit = the wall's depth at the outline's middle
  const { U, V } = G.planeAxes(a.theta, a.phi);
  const n = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const low = pts.reduce((m, p) => (p[1] > m[1] ? p : m), pts[0]);
  const P = [(c[0] - cx) / f, (c[1] - cy) / f, 1], rb = [(low[0] - cx) / f, (low[1] - cy) / f, 1];
  const den = dot(rb, n);
  if (Math.abs(den) > 1e-9) {
    const zLow = dot(P, n) / den;                       // the low point's depth, in plane units
    const below = Math.cos(a.phi) * rb[1] - Math.sin(a.phi);   // how far under the horizon its ray points
    if (zLow > 0 && below > 0.02) perUnit = Math.min(perUnit, CAMERA_HEIGHT_IN / below / zLow);
  }
  const pa = G.applyH(Hinv, g.a[0], g.a[1]), pb = G.applyH(Hinv, g.b[0], g.b[1]);
  const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  return isFinite(d) && d > 1e-6 ? Math.round(clamp(d * perUnit, 2, 720)) : 96;
}
/** First guess for the measuring line: the longest near-vertical edge, bottom to top. */
function guessMeasure(secs) {
  let best = null, bl = 0;
  for (const s of secs) for (let i = 0; i < s.pts.length; i++) {
    const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const score = l * Math.max(0, Math.abs(dy) / (l || 1) - 0.5);
    if (score > bl) { bl = score; best = dy > 0 ? [b, a] : [a, b]; }
  }
  if (!best) {
    const all = secs.flatMap((s) => s.pts); const ys = all.map((p) => p[1]);
    const x = all.reduce((t, p) => t + p[0], 0) / all.length;
    best = [[x, Math.max(...ys)], [x, Math.min(...ys)]];
  }
  return { a: [best[0][0], best[0][1]], b: [best[1][0], best[1][1]] };
}

let maskTimer = 0;
/** Coverage masks (and, when asked, the light lifted from the photo). Throttled while dragging. */
function rebuildMasks(now = false, withLight = true) {
  const run = () => {
    maskTimer = 0;
    const ph = S.photo; if (!ph || !ph.tex) return;
    if (ph.cutsVer !== ph.paintVer) { ph.cuts = [P.blackCut(ph.occ), P.blackCut(ph.open)]; ph.cutsVer = ph.paintVer; }
    const zonePolys = ph.areas.map((a) => closedSecs(a).map((s) => s.pts));
    const packed = P.packMasks(ph.width, ph.height, zonePolys, ph.cuts);
    ph.tex.masks.forEach((t) => engine.deleteTex(t));
    ph.tex.masks = packed.map((c) => engine.texFromImage(c));
    const key = JSON.stringify(zonePolys) + "|" + ph.paintVer;
    if ((withLight || !ph.tex.irr) && key !== ph.lightKey) {
      const wt = P.wallWeight(ph.width, ph.height, zonePolys.flat(), ph.occ, ph.open);
      // a colored material (wood, brick) tints the wall, not the light: keep less of its color
      ph.lightData = P.extractLight(ph.canvas, wt, { wallAlbedo: 0.72, keepColorFor: (st) => { const k = ph.light.wall && ph.light.wall !== "auto" ? ph.light.wall : autoWall(st); return k === "wood" || k === "mid" ? 0.12 : 0.5; } });
      if (ph.tex.irr) engine.deleteTex(ph.tex.irr);
      ph.tex.irr = engine.texFromFloat(ph.lightData.w, ph.lightData.h, ph.lightData.data);
      ph.lightKey = key;
      if (ph.light.auto) autoLightDir();
      updatePhotoGrad();
    }
    if (engine.scene && engine.scene.composite === 1 && S.roomId === "photo") { engine.scene.masks = ph.tex.masks; engine.scene.irr = { tex: ph.tex.irr, mode: 1, range: [0, 0] }; }
    invalidate();
  };
  if (now) { clearTimeout(maskTimer); run(); }
  else if (!maskTimer) maskTimer = setTimeout(run, 70);
}
// What the wall is made of now decides how bright its light really is: a pine wall reflects about
// half what white paint does, so reading it as paint would make the stone look too dark.
const WALLS = [["auto", "Work it out for me"], ["light", "Light paint or drywall", 0.72], ["wood", "Wood boards or logs", 0.4], ["mid", "Brick or mid-tone paint", 0.27], ["dark", "Dark paint or stone", 0.15]];
const lin2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function autoWall(stats) {
  if (!stats || !stats.wallRGB) return "light";
  const [r, g, b] = stats.wallRGB.map(lin2s);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  let hue = 0;
  if (mx > mn) { hue = mx === r ? ((g - b) / (mx - mn)) * 60 : mx === g ? (2 + (b - r) / (mx - mn)) * 60 : (4 + (r - g) / (mx - mn)) * 60; if (hue < 0) hue += 360; }
  if (sat > 0.3 && hue >= 12 && hue <= 52) return "wood";
  if (sat > 0.3 && (hue < 12 || hue > 335)) return "mid";
  const rel = stats.wallLum / Math.max(stats.sceneP75, 1e-4);
  return rel > 0.7 ? "light" : rel > 0.33 ? "mid" : "dark";
}
function wallKind() { const L = S.photo?.light; return !L ? "light" : L.wall && L.wall !== "auto" ? L.wall : autoWall(S.photo.lightData?.stats); }
const wallAlbedo = () => WALLS.find((w) => w[0] === wallKind())?.[2] || 0.72;
function autoLightDir() {
  const [gx, gy] = S.photo.lightData?.grad || [0, 0.15];
  const L = S.photo.light;
  L.dir = Math.round(Math.atan2(gy, gx) / G.D2R);
  L.str = clamp(Math.hypot(gx, gy) * 1.2, 0.15, 0.9);
}
function autoLight() { const L = S.photo.light; L.auto = true; L.expo = 1; L.warmth = 0; L.relief = 1; autoLightDir(); updatePhotoGrad(); renderRail(); invalidate(); }
function photoGrad() { const L = S.photo?.light; return L ? [Math.cos(L.dir * G.D2R) * L.str, Math.sin(L.dir * G.D2R) * L.str] : [0, 0.3]; }
function updatePhotoGrad() { if (S.room?.kind === "photo") { const g = photoGrad(); S.room.zones.forEach((z) => (z.grad = zoneGrad(S.photo.areas.find((a) => a.id === z.id), g))); } }
/** A leveled area's stone is turned on the wall: turn the light's direction into the stone's frame too. */
function zoneGrad(a, g) {
  const r = (a?.rot || 0) * G.D2R; if (!r) return g;
  const c = Math.cos(r), s = Math.sin(r);
  return [c * g[0] - s * g[1], s * g[0] + c * g[1]];
}

// ------------------------------------------------------------------ own photo: undo / redo
const areasSnap = () => JSON.stringify(S.photo.areas.map((a) => ({ id: a.id, label: a.label, sections: a.sections, theta: a.theta, phi: a.phi, measure: a.measure, guides: a.guides, rectFit: a.rectFit, angleSet: a.angleSet, rot: a.rot || 0, sizeK: a.sizeK || 1 })));
/** Just the outlines: what the photo helper's shapes depend on (a change of size or angle doesn't touch them). */
const outlineSnap = () => JSON.stringify(S.photo.areas.map((a) => ({ id: a.id, label: a.label, sections: a.sections })));
const geomSnap = () => JSON.stringify({ areas: JSON.parse(areasSnap()), cur: S.photo.cur, sel: S.photo.sel });
function pushHistRaw(g, ops) {
  const h = S.photo.hist;
  h.undo.push({ g, ops });
  if (h.undo.length > 150) h.undo.shift();
  h.redo.length = 0;
}
function pushHist() { if (S.photo) pushHistRaw(geomSnap(), S.photo.paintOps.slice()); }
/** Run fn; if it changed any outline, record the state from before it as one undo step. */
function withHist(fn) {
  const ph = S.photo; const before = geomSnap(), beforeA = areasSnap(), ops = ph.paintOps.slice();
  fn();
  if (areasSnap() !== beforeA) pushHistRaw(before, ops);
}
function stepHist(dir) {
  const ph = S.photo; if (!ph) return;
  const from = dir < 0 ? ph.hist.undo : ph.hist.redo, to = dir < 0 ? ph.hist.redo : ph.hist.undo;
  if (!from.length) return;
  wizardCancel(true);
  to.push({ g: geomSnap(), ops: ph.paintOps.slice() });
  restoreSnap(from.pop());
}
function restoreSnap(e) {
  const ph = S.photo;
  const d = JSON.parse(e.g);
  ph.areas = d.areas; ph.cur = clamp(d.cur, 0, ph.areas.length - 1); ph.sel = d.sel;
  sanitizeSel();
  for (const a of ph.areas) if (!S.design.photo[a.id]) S.design.photo[a.id] = defaultAreaDesign();
  const changed = e.ops.length !== ph.paintOps.length || e.ops.some((o, i) => o !== ph.paintOps[i]);
  ph.paintOps = e.ops.slice();
  if (changed) replayPaint();
  if (S.target !== "all" && !ph.areas.some((a) => a.id === S.target)) S.target = "all";
  syncPhotoZones(); rebuildMasks(true);
  renderRail(); renderHud(); renderCaption(); drawOverlay(); renderCard();
}
function sanitizeSel() {
  const ph = S.photo, a = curArea(); if (!a) return;
  if (!a.sections.length) a.sections.push(newSection());
  ph.sel = ph.sel || { sec: 0, pt: -1 };
  ph.sel.sec = clamp(ph.sel.sec ?? 0, 0, a.sections.length - 1);
  if (ph.sel.pt >= a.sections[ph.sel.sec].pts.length) ph.sel.pt = -1;
}

// ------------------------------------------------------------------ own photo: areas and sections
function defaultAreaDesign() {
  const src = Object.values(S.design.photo || {}).find((g) => g.mode === "stone") || Object.values(S.design.cabin || {}).find((g) => g.mode === "stone");
  return src ? { mode: "stone", stone: src.stone, joint: src.joint || "standard", mortar: src.mortar || "natural", _jointSet: src._jointSet, _mortarSet: src._mortarSet }
    : { mode: "stone", stone: DEFAULT_STONE, joint: "standard", mortar: "natural" };
}
const dirtyArea = (a) => !!a && a.sections.some((s) => !s.closed && s.pts.length > 0);
/** Keep finished work, close a shape that has 3+ points, drop scraps of 1-2 points and empty sections. */
function tidyArea(a) {
  if (!a) return;
  a.sections = a.sections.filter((s) => { if (s.closed) return true; if (s.pts.length >= 3) { s.closed = true; return true; } return false; });
  if (!a.sections.length) a.sections.push(newSection());
}

function addArea(opt = {}) {
  const ph = S.photo; if (!ph) return;
  if (ph.areas.length >= 6) { toast("One photo can hold up to six areas."); return; }
  const prev = curArea();
  const back = ph.wizard ? { cur: ph.cur, step: ph.wizard.step } : { exit: true };
  const doIt = () => {
    tidyArea(prev);
    areaN++;
    const a = { id: "a" + areaN, label: ph.areas.length ? `Area ${ph.areas.length + 1}` : "Main wall", sections: [newSection()], theta: prev ? prev.theta : 0, phi: prev ? prev.phi : 0, measure: null, guides: [], rectFit: true, angleSet: false };
    ph.areas.push(a); ph.cur = ph.areas.length - 1; ph.sel = { sec: 0, pt: -1 };
    if (!S.design.photo[a.id]) S.design.photo[a.id] = defaultAreaDesign();
    ensureStone(S.design.photo[a.id].stone);
  };
  if (opt.silent) doIt(); else withHist(doIt);
  ph.wizard = { step: "outline", back: opt.silent ? null : back, isNew: !opt.silent };
  closeCard();
  if (!opt.silent) { syncPhotoZones(); rebuildMasks(true); renderAll(); toast("New area: tap its corners on the photo."); }
}
/** Drop a new area the customer changed their mind about, and go back to where they were. */
function cancelNewArea() {
  const ph = S.photo, a = curArea(); if (!a) return;
  const back = ph.wizard?.back;
  wizardCancel(true);
  if (a.sections.some((s) => s.pts.length) && !confirmInline("cancelarea")) return;
  ph.areas.splice(ph.cur, 1);
  if (!ph.areas.length) { ph.wizard = { step: "outline", back: null }; addArea({ silent: true }); }
  else if (back && !back.exit) { ph.cur = clamp(back.cur, 0, ph.areas.length - 1); ph.wizard = { step: back.step || "outline", back: null }; }
  else { ph.cur = clamp(ph.cur, 0, ph.areas.length - 1); ph.wizard = null; }
  sanitizeSel();
  syncPhotoZones(); rebuildMasks(true); renderAll();
}
/** A one-tap "are you sure" without a browser dialog: the first tap arms, a second within 4 s confirms. */
const armed = {};
function confirmInline(key) {
  const now = performance.now();
  if (armed[key] && now - armed[key] < 4000) { delete armed[key]; return true; }
  armed[key] = now;
  toast("Tap again to throw away what you drew.");
  return false;
}

function editArea(id, step = "outline") {
  const ph = S.photo; const k = ph.areas.findIndex((a) => a.id === id); if (k < 0) return;
  ph.cur = k;
  const a = curArea();
  ph.sel = { sec: Math.max(0, a.sections.length - 1), pt: -1 };
  if (step === "size") foldSize(a);
  ph.wizard = { step, back: { exit: true } };
  S.grid = step === "angle" || step === "size";
  closeCard();
  syncPhotoZones(); renderAll();
  revealStage();
}
function selectArea(k) {
  const ph = S.photo; if (!ph.areas[k] || k === ph.cur) return;
  withHist(() => tidyArea(curArea()));
  ph.cur = k;
  const a = curArea();
  ph.sel = { sec: Math.max(0, a.sections.findIndex((s) => s.closed)), pt: -1 };
  syncPhotoZones(); rebuildMasks(true); renderRail(); renderHud(); drawOverlay(); renderCaption();
}
function selectSection(j) {
  const ph = S.photo, a = curArea(); if (!a || !a.sections[j]) return;
  if (j === ph.sel.sec) { ph.sel.pt = -1; renderHud(); drawOverlay(); renderRail(); return; }
  const target = a.sections[j];
  withHist(() => tidyArea(a));
  ph.sel = { sec: Math.max(0, a.sections.indexOf(target)), pt: -1 };
  syncPhotoZones(); rebuildMasks(true); renderRail(); renderHud(); drawOverlay();
}
function addSection() {
  const ph = S.photo, a = curArea(); if (!a) return;
  const cur = a.sections[ph.sel.sec];
  if (cur && !cur.closed && !cur.pts.length) { toast("Tap the corners of the new section on the photo."); return; }
  withHist(() => tidyArea(a));
  a.sections.push(newSection());
  ph.sel = { sec: a.sections.length - 1, pt: -1 };
  if (!ph.wizard) ph.wizard = { step: "outline", back: { exit: true } }; else ph.wizard.step = "outline";
  S.grid = false;
  closeCard();
  syncPhotoZones(); rebuildMasks(true); renderAll();
  toast("New section: tap its corners on the photo.");
}
function finishSection() {
  const ph = S.photo, s = curSec(); if (!s || s.closed || s.pts.length < 3) return;
  pushHist(); s.closed = true; ph.sel.pt = -1;
  if (ph.wizard) ph.wizard.isNew = false;
  geometryChanged(true);
}
function deleteSection(j = S.photo.sel.sec) {
  const ph = S.photo, a = curArea(); if (!a || !a.sections[j]) return;
  const s = a.sections[j];
  if (!s.pts.length) {          // an empty new section: just stop drawing it
    if (a.sections.length > 1) { a.sections.splice(j, 1); ph.sel = { sec: a.sections.length - 1, pt: -1 }; }
    renderRail(); renderHud(); drawOverlay();
    return;
  }
  pushHist();
  a.sections.splice(j, 1);
  if (!a.sections.length) a.sections.push(newSection());
  ph.sel = { sec: Math.min(j, a.sections.length - 1), pt: -1 };
  geometryChanged(true);
  toast(s.closed ? "Section deleted." : "Section canceled.", { a: "undo", label: "Undo" });
}
function deleteArea(k = S.photo.cur) {
  const ph = S.photo; const a = ph.areas[k]; if (!a) return;
  pushHist();
  ph.areas.splice(k, 1);
  if (S.target === a.id) S.target = "all";
  const inSetup = !!ph.wizard;
  if (!ph.areas.length) { ph.cur = -1; addArea({ silent: true }); ph.wizard = inSetup ? { step: "outline", back: null } : null; }
  else {
    if (k < ph.cur) ph.cur--;
    ph.cur = clamp(ph.cur, 0, ph.areas.length - 1);
    ph.sel = { sec: Math.max(0, curArea().sections.length - 1), pt: -1 };
  }
  closeCard();
  syncPhotoZones(); rebuildMasks(true); renderAll();
  toast(`${a.label} deleted.`, { a: "undo", label: "Undo" });
}
function deletePoint() {
  const ph = S.photo, s = curSec(); const i = ph.sel.pt;
  if (!s || i < 0 || i >= s.pts.length) return;
  pushHist();
  const n = s.pts.length;
  const prev = (i - 1 + n) % n;
  s.cf[prev] = !!(s.cf[prev] || s.cf[i]);      // merged edge keeps a corner mark from either side
  s.pts.splice(i, 1); s.cf.splice(i, 1);
  if (s.closed && s.pts.length < 3) s.closed = false;
  ph.sel.pt = -1;
  geometryChanged(true);
}
function insertPoint(sec, i, q) {
  sec.pts.splice(i + 1, 0, q);
  sec.cf.splice(i + 1, 0, !!sec.cf[i]);       // both halves of a corner edge stay corners
  return i + 1;
}
function geometryChanged(remask) {
  syncPhotoZones();
  if (remask) rebuildMasks(true);
  renderRail(); renderHud(); renderCaption(); drawOverlay(); invalidate();
}
function liveGeometry(remask = true) {
  syncPhotoZones();
  if (remask) rebuildMasks(false, false);
  drawOverlay(); invalidate();
}

// ------------------------------------------------------------------ own photo: the photo helper
// Finds the stone area for the customer. Claude says roughly what's where (layout.js); the
// segmentation model running on this device finds the exact edges (segment.js). The customer
// answers "Does this look right?" with one tap, fixes it with a few taps, or traces it as before.
// Without Claude (switched off, or not reachable) the customer taps the wall once instead.
let autoTok = 0;
const helperOn = () => Seg.supported() && Seg.status.state !== "failed" && window.HS_CONFIG?.photoHelper !== false;
const claudeOn = () => S.settings.aiPhotos !== false && window.HS_CONFIG?.aiPhotoHelp !== false;
const AUTO_MODES = [["add", "Add stone", "Tap a spot that should get stone", "plus"], ["remove", "No stone", "Tap a spot that shouldn't", "minus"], ["front", "Stays in front", "Tap a stove, pipe or mantel", "front"]];

if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__hs = { S, get auto() { const A = S.photo?.auto; return A && { state: A.state, mode: A.mode, busy: A.busy, hist: A.hist.length, times: A.times, objs: A.objs.map((o) => ({ kind: o.kind, label: o.label, n: o.mask ? MG.count(o.mask) : 0, pts: o.pts.length })) }; } };
}
const newAuto = (extra = {}) => ({ state: "loading", model: Seg.status.state === "ready" ? "ready" : "loading", claude: "waiting", objs: [], mode: "add", straight: true, hist: [], token: ++autoTok, note: "", busy: false, info: null, ...extra });
/** Look at the photo (again). A second look starts from scratch: the outline there now goes, and
 *  Cancel brings back the one from before the helper opened. */
function startAuto(opts = {}) {
  const ph = S.photo; if (!ph) return;
  const inSession = ph.wizard?.step === "auto" && !!ph.auto;
  const before = inSession ? ph.auto.before || null
    : doneAreas().length ? { g: geomSnap(), ops: ph.paintOps.slice(), auto: ph.auto || null, wizard: ph.wizard ? { ...ph.wizard } : null } : null;
  stopAuto(); wizardCancel(true); hideLoupe(); closeCard();
  if (before || inSession) {
    ph.areas = []; ph.cur = -1; addArea({ silent: true });
    ph.paintOps = ph.paintOps.filter((op) => !op.auto); replayPaint();
  } else if (!ph.areas.length) addArea({ silent: true });
  ph.auto = newAuto({ before, fresh: !!opts.fresh });
  ph.wizard = { step: "auto", back: null };
  S.grid = false;
  syncPhotoZones(); rebuildMasks(true, false);
  renderAll();
  runAuto(ph, ph.auto);
}
const sameOps = (a, b) => !!a && a.length === b.length && a.every((o, i) => o === b[i]);
/** Back into the helper's "Fix it" with the outline as it is now. If nothing changed since the
 *  helper's answer was used, it picks up exactly where it was (names and all); otherwise it takes
 *  the outline and painting as they are now. */
function reopenAuto() {
  const ph = S.photo; if (!ph || !helperOn()) return;
  if (!doneAreas().length) { startAuto(); return; }
  const before = { g: geomSnap(), ops: ph.paintOps.slice(), auto: ph.auto || null, wizard: ph.wizard ? { ...ph.wizard } : null };
  stopAuto(); wizardCancel(true); hideLoupe(); closeCard();
  const prev = ph.auto;
  let A;
  if (prev?.doneSnap && prev.doneSnap === outlineSnap() && sameOps(prev.doneOps, ph.paintOps)) {
    A = newAuto({ objs: prev.objs.map((o) => ({ ...o, pts: o.pts.slice() })), info: prev.info, straight: prev.straight, source: prev.source });
  } else {
    A = newAuto(autoImport(ph));
    ph.paintOps = [];                 // the painting is now part of the helper's shapes
  }
  Object.assign(A, { state: "fix", before, lit: true, claude: "off" });
  ph.auto = A;
  ph.wizard = { step: "auto", back: null };
  S.grid = false;
  applyAuto();
  renderAll();
  // a tap needs the model to have read this photo: start that now
  const unsub = Seg.onStatus(() => { if (ph.auto === A) autoProgress(); });
  Seg.encode(ph.canvas).then(() => { unsub(); if (ph.auto === A) { A.model = "ready"; if (ph.wizard?.step === "auto") renderRail(); } },
    () => { unsub(); if (ph.auto === A) { autoCancel(true); toast("The photo helper couldn't start here. Use Edit outlines to move the corners instead."); } });
}
/** The outline and painting as they are now, as the helper's shapes (one per area, and each painted
 *  piece on its own so a tap can change just that piece). */
function autoImport(ph) {
  const W = ph.width, H = ph.height, k = 1024 / Math.max(W, H), w = Math.round(W * k), h = Math.round(H * k), N = w * h;
  const objs = [];
  for (const a of ph.areas) {
    const secs = closedSecs(a); if (!secs.length) continue;
    const m = MG.fillPolys(w, h, secs.map((sec) => sec.pts.map(([x, y]) => [x * k, y * k])));
    if (!MG.count(m)) continue;
    objs.push({ kind: "surface", label: a.label, box: null, pts: [], mask: m, areaId: a.id });
    a._autoMask = m; a._autoStraight = true;           // its outline stays exactly as it is until a tap changes it
  }
  const fromCanvas = (c) => {
    const t = document.createElement("canvas"); t.width = w; t.height = h;
    const x = t.getContext("2d", { willReadFrequently: true }); x.drawImage(c, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, m = MG.blank(w, h);
    for (let i = 0; i < m.d.length; i++) if (d[i * 4 + 3] > 127) m.d[i] = 1;
    return m;
  };
  for (const [c, kind, label] of [[ph.occ, "front", "In front"], [ph.open, "open", "Opening"]]) {
    const all = fromCanvas(c);
    const { comps } = MG.components(all);
    for (const cp of comps) if (cp.n >= N * 0.0004) objs.push({ kind, label, box: null, pts: [], mask: MG.keepPieces(all, (x) => x.id === cp.id) });
  }
  return { objs, info: { w, h, k }, source: "outline", straight: true };
}
/** Leave the helper and put back what was there before it opened. */
function autoCancel(silent) {
  const ph = S.photo, A = ph?.auto; if (!A?.before) return;
  const b = A.before;
  stopAuto();
  const d = JSON.parse(b.g);
  ph.areas = d.areas; ph.cur = clamp(d.cur, 0, Math.max(0, ph.areas.length - 1)); ph.sel = d.sel; sanitizeSel();
  ph.paintOps = b.ops.slice(); replayPaint();
  ph.auto = b.auto;
  ph.wizard = b.wizard;
  S.grid = false;
  if (S.target !== "all" && !ph.areas.some((a) => a.id === S.target)) S.target = "all";
  syncPhotoZones(); rebuildMasks(true); renderAll();
  if (!silent) toast("Your outline is back the way it was.");
}
/** From the helper to moving each corner by hand, keeping what the helper found. */
function autoPoints() {
  const ph = S.photo, A = ph?.auto; if (!A || A.busy) return;
  if (!doneAreas().length) { toast("There's no stone area yet. Tap Add stone, then tap the wall."); return; }
  stopAuto(); A.state = "done";
  ph.areas.forEach(tidyArea);
  A.doneSnap = outlineSnap(); A.doneOps = ph.paintOps.slice();
  ph.cur = 0; ph.sel = { sec: 0, pt: -1 };
  ph.wizard = { step: "outline", back: null, isNew: false };
  S.grid = false;
  syncPhotoZones(); rebuildMasks(true); renderAll();
  toast("Drag any corner to move it. Press Finish setup when it looks right.");
}
function stopAuto() {
  const A = S.photo?.auto; if (!A) return;
  A.token = -1;
  try { A.ctl?.abort(); } catch (e) { /* already done */ }
}

async function runAuto(ph, A) {
  const tok = A.token, t0 = performance.now();
  A.times = {};
  const mark = (k) => { A.times[k] = Math.round(performance.now() - t0); };
  const alive = () => S.photo === ph && ph.auto === A && A.token === tok;
  const unsub = Seg.onStatus(() => { if (alive()) autoProgress(); });
  Seg.load().then(() => mark("model"), () => {});
  const enc = Seg.encode(ph.canvas).then((info) => { A.info = info; A.model = "ready"; mark("encoded"); if (alive()) autoProgress(); return info; });
  enc.catch(() => {});
  let lay = null;
  const ask = claudeOn() && (await LY.available().catch(() => false));
  if (!alive()) { unsub(); return; }
  if (ask) {
    A.claude = "asking"; autoProgress();
    A.ctl = new AbortController();
    try { const r = await LY.findLayout(ph.canvas, { signal: A.ctl.signal, fresh: A.fresh }); lay = r.layout || null; mark("claude"); }
    catch (e) { unsub(); return; }                      // canceled: the customer moved on
  } else A.claude = "off";
  let info;
  try { info = await enc; } catch (e) { unsub(); if (alive()) autoFailed(); return; }
  unsub();
  if (!alive() || !info) return;
  if (lay && lay.surfaces.length && lay.confidence !== "low") {
    A.claude = "done"; A.source = "claude"; A.note = lay.note;
    try { await autoFromLayout(ph, A, lay); } catch (e) { if (!alive()) return; A.objs = []; }
    if (!alive()) return;
    mark("shapes");
    if (A.objs.some((o) => o.kind === "surface" && o.mask)) { A.state = "confirm"; applyAuto(); mark("applied"); renderAll(); mark("shown"); return; }
    A.objs = [];
  } else if (ask) A.claude = lay ? "none" : "failed";
  A.note = lay?.note || "";
  A.source = "tap";
  A.state = "tapwall";
  renderAll();
}
function autoFailed() {
  autoTrace(true);
  toast("The photo helper couldn't start here. Outline the area by hand instead.");
}

/** Turn Claude's rough boxes into exact shapes: things in front and openings first, so each surface
 *  can be told "not this" at their spots. */
async function autoFromLayout(ph, A, L) {
  const k = A.info.k;
  const P = (q, l) => [q[0] * k, q[1] * k, l];
  const B = (b) => b.map((v) => v * k);
  for (const f of L.front) await autoSeg(A, { kind: "front", label: f.label, box: B(f.box), pts: f.points.map((q) => P(q, 1)) }, true);
  for (const o of L.openings) await autoSeg(A, { kind: "open", label: o.label, box: B(o.box), pts: [] }, true);
  for (const s of L.surfaces) {
    const box = B(s.box);
    const negs = [];
    for (const o of A.objs) if (o.mask && boxOverlap(o.box, box) > 0) { const c = innerPoint(o.mask); if (c) negs.push([c[0], c[1], 0]); }
    await autoSeg(A, { kind: "surface", label: s.label, box, whole: s.whole, pts: [...s.points.map((q) => P(q, 1)), ...negs.slice(0, 5)] }, true);
  }
  const surfs = A.objs.filter((o) => o.kind === "surface" && o.mask);
  for (let i = 1; i < surfs.length; i++) for (let j = 0; j < i; j++) surfs[i].mask = MG.minus(surfs[i].mask, surfs[j].mask);
}

const boxOverlap = (a, b) => (!a || !b ? 0 : Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])));
const growBox = (b, f, w, h) => { const dx = (b[2] - b[0]) * f, dy = (b[3] - b[1]) * f; return [Math.max(0, b[0] - dx), Math.max(0, b[1] - dy), Math.min(w, b[2] + dx), Math.min(h, b[3] + dy)]; };
const inBox = (b, q) => q[0] >= b[0] && q[0] <= b[2] && q[1] >= b[1] && q[1] <= b[3];
function boxCount(m, b) {
  let n = 0;
  const x0 = Math.max(0, Math.floor(b[0])), x1 = Math.min(m.w, Math.ceil(b[2])), y0 = Math.max(0, Math.floor(b[1])), y1 = Math.min(m.h, Math.ceil(b[3]));
  for (let y = y0; y < y1; y++) { const r = y * m.w; for (let x = x0; x < x1; x++) n += m.d[r + x]; }
  return n;
}
/** A spot well inside the mask: its middle if that's on it, else the nearest pixel that is. */
function innerPoint(m) {
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < m.d.length; i++) if (m.d[i]) { sx += i % m.w; sy += (i / m.w) | 0; n++; }
  if (!n) return null;
  const cx = sx / n, cy = sy / n;
  if (MG.at(m, cx, cy)) return [cx, cy];
  let best = null, bd = Infinity;
  for (let i = 0; i < m.d.length; i += 3) if (m.d[i]) { const x = i % m.w, y = (i / m.w) | 0, d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; } }
  return best;
}

/** Ask the model about one thing, pick the best of its four answers, tidy it up. */
async function autoSeg(A, o, push) {
  const r = await Seg.segment(S.photo.canvas, { points: o.pts.map((p) => [p[0], p[1], p[2]]), box: o.box || null });
  o.mask = pickMask(A, o, r);
  if (push && o.mask) A.objs.push(o);
  return o.mask;
}
function pickMask(A, o, r) {
  const { w, h } = r.info, N = w * h;
  const pos = o.pts.filter((p) => p[2] === 1), neg = o.pts.filter((p) => p[2] === 0);
  const single = !o.box && pos.length === 1 && !neg.length;
  let best = -1, bq = -Infinity;
  r.masks.forEach((m, i) => {
    const a = r.areas[i];
    if (a < 0.0004 || a > 0.85) return;                       // a speck, or the whole picture: never what's meant
    let q = r.scores[i];
    if (pos.length) q += 0.6 * pos.filter((p) => MG.at(m, p[0], p[1])).length / pos.length;
    if (neg.length) q += 0.6 * neg.filter((p) => !MG.at(m, p[0], p[1])).length / neg.length;
    if (o.box) {
      const inside = boxCount(m, growBox(o.box, 0.03, w, h)), boxN = Math.max(1, (o.box[2] - o.box[0]) * (o.box[3] - o.box[1]));
      q += 0.4 * Math.min(1, inside / boxN) + (o.kind !== "surface" || o.whole ? 0.4 * inside / Math.max(1, a * N) : 0);
    }
    if (single && o.kind === "surface") q += 0.15 * Math.min(1, a / 0.25);           // a tap on a wall means the wall
    if (single && o.kind !== "surface") q += a > 0.35 ? -0.5 : 0;                     // a thing in front isn't half the room
    if (q > bq) { bq = q; best = i; }
  });
  if (best < 0) return null;
  let m = r.masks[best];
  if (o.box) m = MG.inter(m, MG.boxMask(w, h, o.kind === "surface" && !o.whole ? o.box : growBox(o.box, 0.03, w, h)));
  if (o.extra) m = MG.union(m, o.extra);
  if (o.carve) m = MG.minus(m, o.carve);
  // keep the pieces that hold a wanted spot, and any big ones
  const { comps, lab } = MG.components(m);
  if (!comps.length) return null;
  const big = Math.max(...comps.map((c) => c.n));
  const held = new Set(pos.map((p) => lab[Math.min(h - 1, Math.floor(p[1])) * w + Math.min(w - 1, Math.floor(p[0]))]).filter(Boolean));
  m = MG.keepPieces(m, (c) => c.n >= big * 0.15 || held.has(c.id));
  m = MG.fillSmallHoles(m, N * 0.0008);
  return MG.count(m) >= N * 0.0004 ? m : null;
}
/** Just the piece that holds the tap (and any big pieces with it), without stray specks elsewhere. */
function mainPieces(m, q) {
  const { lab, comps } = MG.components(m); if (!comps.length) return m;
  const at = lab[Math.min(m.h - 1, Math.floor(q[1])) * m.w + Math.min(m.w - 1, Math.floor(q[0]))];
  const big = Math.max(...comps.map((c) => c.n));
  return MG.keepPieces(m, (c) => c.id === at || c.n >= big * 0.15);
}
/** Everything the model sees at one tap, from a part to the whole thing, with its own score. */
async function piecesAt(q) {
  const r = await Seg.segment(S.photo.canvas, { points: [[q[0], q[1], 1]] });
  return r.masks.map((m, i) => ({ m, s: r.scores[i], a: r.areas[i] })).filter((x) => x.a > 0.0004 && x.a < 0.85 && MG.at(x.m, q[0], q[1]))
    .map((x) => ({ ...x, m: mainPieces(x.m, q) }));
}
/** What's at one tap on its own: "small" for taking a bit away, "big" for adding a wall. */
async function pieceAt(A, q, size) {
  const r = await Seg.segment(S.photo.canvas, { points: [[q[0], q[1], 1]] });
  const c = r.masks.map((m, i) => ({ m, s: r.scores[i], a: r.areas[i] })).filter((x) => x.a > 0.0004 && x.a < 0.85 && MG.at(x.m, q[0], q[1]));
  if (!c.length) return null;
  const good = c.filter((x) => x.s >= (size === "small" ? 0.75 : 0.8));
  const pool = good.length ? good : c;
  pool.sort((a, b) => (size === "small" ? a.a - b.a : b.a - a.a));
  return pool[0].m;
}

/** The helper's shapes become the photo's areas (outlines) and its "in front" and "opening" painting.
 *  Only areas whose shape changed get a new outline, so one tap never moves the corners of another
 *  area, and a measured size or a set angle stays. */
function applyAuto() {
  const ph = S.photo, A = ph?.auto; if (!A?.info) return;
  const { w, h, k } = A.info, N = w * h, diag = Math.hypot(w, h);
  const blankM = MG.blank(w, h);
  const F = A.objs.filter((o) => o.kind === "front" && o.mask).reduce((t, o) => MG.union(t, o.mask), blankM);
  const O = A.objs.filter((o) => o.kind === "open" && o.mask).reduce((t, o) => MG.union(t, o.mask), blankM);
  let FO = null;
  const behind = () => (FO ||= MG.morph(MG.union(F, O), 3));
  const toPhoto = (p) => p.map(([x, y]) => [clamp(x / k, 0, ph.width), clamp(y / k, 0, ph.height)]);
  const surfs = A.objs.filter((o) => o.kind === "surface" && o.mask && MG.count(o.mask) > N * 0.002).slice(0, 6);
  const areas = [], labels = [];
  for (const s of surfs) {
    if (!s.areaId) s.areaId = "a" + ++areaN;
    let a = ph.areas.find((x) => x.id === s.areaId);
    if (!a || a._autoMask !== s.mask || a._autoStraight !== A.straight || !closedSecs(a).length) {
      // the surface carries on behind whatever stands in front of it (inside its own outer shape)
      const hullM = MG.fillPolys(w, h, [MG.hull(s.mask)]);
      let full = MG.fillHoles(MG.close(MG.union(s.mask, MG.inter(behind(), hullM)), 4));
      if (s.box && !s.whole) full = MG.inter(full, MG.boxMask(w, h, s.box));
      const loops = MG.outlines(full).filter((l) => MG.area(l) > N * 0.002).sort((x, y) => MG.area(y) - MG.area(x)).slice(0, 4);
      const polys = loops.map((l) => {
        const p = A.straight ? MG.straighten(l, diag * 0.01) : MG.simplify(l, Math.max(1.2, diag * 0.0022));
        return toPhoto(MG.dropDetours(p, A.straight ? 0.004 : 0.0006));
      }).filter((p) => p.length >= 3);
      if (!polys.length) continue;
      a = a || { id: s.areaId, guides: [], rectFit: true, angleSet: false, theta: 0, phi: 0, measure: null };
      a.label = s.label;
      a.sections = polys.map((p) => ({ pts: p, cf: p.map(() => false), closed: true }));
      if (!a.measure || a.measure.guessed) a.measure = null;        // a size the customer measured stays
      if (!a.angleSet) autoAngle(a);
      a._autoMask = s.mask; a._autoStraight = A.straight;
    }
    areas.push(a);
    const pts = closedSecs(a).flatMap((sec) => sec.pts), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    labels.push({ at: [(Math.min(...xs) + Math.max(...xs)) / 2, y0 + (y1 - y0) * 0.1], text: a.label, kind: "stone" });
  }
  if (!areas.length) { areaN++; areas.push({ id: "a" + areaN, label: "Main wall", sections: [newSection()], theta: 0, phi: 0, measure: null, guides: [], rectFit: true, angleSet: false }); }
  ph.areas = areas; ph.cur = 0; ph.sel = { sec: 0, pt: -1 };
  for (const a of ph.areas) if (!S.design.photo[a.id]) { S.design.photo[a.id] = defaultAreaDesign(); ensureStone(S.design.photo[a.id].stone); }
  // painting: what stays in front, and openings that get no stone (they come off the estimate)
  ph.paintOps = ph.paintOps.filter((op) => !op.auto);
  if (MG.count(F)) ph.paintOps.push({ t: "magic", c: MG.toCanvas(F), auto: true });
  if (MG.count(O)) ph.paintOps.push({ t: "magicopen", c: MG.toCanvas(O), auto: true });
  replayPaint();
  // dashed outlines and name tags for the picture
  const loopsOf = (m) => MG.outlines(MG.close(m, 2)).filter((l) => MG.area(l) > N * 0.0008).map((l) => toPhoto(MG.simplify(l, 1.5)));
  const fronts = A.objs.filter((o) => o.kind === "front" && o.mask);
  A.frontLoops = fronts.flatMap((o) => loopsOf(o.mask));
  fronts.map((o) => ({ o, n: MG.count(o.mask) })).sort((x, y) => y.n - x.n).slice(0, 2).forEach(({ o }) => {   // tag the biggest two
    const b = MG.bbox(o.mask);
    if (b) labels.push({ at: [(b[0] + b[2]) / 2 / k, b[1] / k], text: "Stays in front", kind: "front" });
  });
  A.openLoops = A.objs.filter((o) => o.kind === "open" && o.mask).flatMap((o) => {
    const b = MG.bbox(o.mask);
    if (b) labels.push({ at: [(b[0] + b[2]) / 2 / k, (b[1] + b[3]) / 2 / k], text: "No stone", kind: "open" });
    return loopsOf(o.mask);
  });
  A.labels = labels;
  if (S.target !== "all" && !ph.areas.some((a) => a.id === S.target)) S.target = "all";
  // the shapes show at once; the room's light is read from the wall a moment later, once (it barely
  // changes with a fix), and again when the customer says yes
  syncPhotoZones(); rebuildMasks(true, false);
  if (!A.lit) { A.lit = true; setTimeout(() => { if (S.photo?.auto === A && A.state !== "done") rebuildMasks(true, true); }, 80); }
}
/** A four-cornered outline is most likely a rectangle seen at an angle: use it for the wall's angle. */
function autoAngle(a) {
  const ph = S.photo;
  a.theta = 0; a.phi = 0;
  const secs = closedSecs(a); if (secs.length !== 1) return;
  const pts = secs[0].pts, A0 = Math.abs(MG.area(pts)); if (!A0) return;
  const q = pts.length === 4 ? pts : MG.dropDetours(pts, 1, 4);
  const r4 = Math.abs(MG.area(q)) / A0;
  if (q.length !== 4 || r4 < 0.9 || r4 > 1.1) return;
  const r = G.solveFromRectangle(ph.width, ph.height, ph.f, q);
  if (r && Math.abs(r.theta) <= 65 * G.D2R && Math.abs(r.phi) <= 25 * G.D2R) { a.theta = r.theta; a.phi = r.phi; }
}

/** A tap on the picture while the helper is up. */
async function autoTap(p) {
  const ph = S.photo, A = ph?.auto; if (!A?.info || A.busy) return;
  const [ix, iy] = cssToImg(p[0], p[1]);
  if (ix < 0 || iy < 0 || ix > ph.width || iy > ph.height) return;
  if (A.state === "confirm") { toast("To change the outline, press Fix it.", { a: "autofix", label: "Fix it" }); return; }
  if (A.state !== "tapwall" && A.state !== "fix") return;
  const q = [ix * A.info.k, iy * A.info.k], tok = A.token;
  A.busy = true; A.pulse = [ix, iy]; renderHud(); drawOverlay();
  const before = A.objs.map((o) => ({ ...o, pts: o.pts.slice() }));
  try {
    const changed = A.state === "tapwall" ? await autoAddWall(A, q) : await autoFix(A, A.mode, q);
    if (A.token !== tok || S.photo?.auto !== A) return;
    if (changed) {
      A.hist.push(before); if (A.hist.length > 40) A.hist.shift();
      if (A.state === "tapwall") A.state = "confirm";
      applyAuto();
    }
  } catch (e) {
    if (A.token === tok && String(e?.message) !== "stale") toast("That didn't work. Try tapping again.");
  } finally {
    if (S.photo?.auto === A) { A.busy = false; A.pulse = null; renderAll(); }
  }
}
/** Choose among the model's pieces at one tap. "first": the wall itself (not a speck, not the whole room);
 *  "small": the smallest piece it's sure of, so a tap never grabs more than meant (tap again for more). */
function choosePiece(pieces, how) {
  const ok = (x) => x.a >= 0.004 && x.a <= 0.6;
  if (how === "first") return pieces.filter(ok).sort((a, b) => b.s - a.s)[0] || pieces.sort((a, b) => b.s - a.s)[0] || null;
  const sure = pieces.filter((x) => ok(x) && x.s >= 0.85).sort((a, b) => a.a - b.a);
  return sure[0] || pieces.filter(ok).sort((a, b) => b.s - a.s)[0] || null;
}
const nextAreaName = (A) => (A.objs.some((o) => o.kind === "surface" && o.mask) ? `Area ${A.objs.filter((o) => o.kind === "surface" && o.mask).length + 1}` : "Main wall");
async function autoAddWall(A, q) {
  const piece = choosePiece(await piecesAt(q), "first");
  if (!piece) { toast("Couldn't find a wall there. Try another spot on it."); return null; }
  const m = MG.fillSmallHoles(piece.m, A.info.w * A.info.h * 0.0008);
  A.objs.push({ kind: "surface", label: "Main wall", box: null, pts: [[q[0], q[1], 1]], mask: m });
  return m;
}
async function autoFix(A, mode, q) {
  const { w, h } = A.info, N = w * h;
  const surfs = A.objs.filter((o) => o.kind === "surface" && o.mask);
  const inSurf = surfs.find((o) => MG.at(o.mask, q[0], q[1]));
  const thing = A.objs.find((o) => o.kind !== "surface" && o.mask && MG.at(o.mask, q[0], q[1]));
  const allStone = () => surfs.reduce((t, o) => MG.union(t, o.mask), MG.blank(w, h));
  if (mode === "add") {
    if (thing) { A.objs.splice(A.objs.indexOf(thing), 1); return thing.mask; }     // not in front after all: the stone goes over it
    const pieces = await piecesAt(q);
    if (inSurf) {
      // already stone here: take in the next bigger thing at this spot (tap again for more)
      const cur = inSurf.mask, curN = MG.count(cur), others = MG.minus(allStone(), cur);
      const g = pieces.filter((x) => x.s >= 0.8 && x.a <= 0.7).map((x) => ({ ...x, add: MG.minus(MG.minus(x.m, cur), others) }))
        .map((x) => ({ ...x, n: MG.count(x.add) })).filter((x) => x.n >= Math.max(N * 0.003, curN * 0.1)).sort((a, b) => a.n - b.n)[0];
      if (!g) { toast("That part already gets stone."); return null; }
      inSurf.extra = MG.union(inSurf.extra || MG.blank(w, h), g.add);
      inSurf.mask = MG.union(cur, g.add);
      return g.add;
    }
    const piece = choosePiece(pieces, "small");
    if (!piece) { toast("Couldn't find an edge there. Try another spot."); return null; }
    const add = MG.minus(MG.fillSmallHoles(piece.m, N * 0.0008), allStone());
    if (MG.count(add) < N * 0.002) { toast("That part already gets stone."); return null; }
    // right next to a stone area: it's more of that area; otherwise it's a new one
    const grown = MG.morph(add, 4);
    const near = surfs.map((o) => ({ o, t: MG.countIn(grown, o.mask) })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t)[0]?.o;
    if (near) { near.extra = MG.union(near.extra || MG.blank(w, h), add); near.mask = MG.union(near.mask, add); return add; }
    if (surfs.length >= 6) { toast("One photo can hold up to six areas."); return null; }
    A.objs.push({ kind: "surface", label: nextAreaName(A), box: null, pts: [[q[0], q[1], 1]], mask: add });
    return add;
  }
  if (mode === "remove") {
    if (!inSurf) { toast("No stone goes there already."); return null; }
    const was = inSurf.mask, wasN = MG.count(was), qi = Math.floor(q[1]) * w + Math.floor(q[0]);
    const removed = (now) => { const r = MG.minus(was, now || MG.blank(w, h)); return MG.count(r) ? r : null; };
    const drop = () => { A.objs.splice(A.objs.indexOf(inSurf), 1); return was; };
    // 1. a piece added by an earlier "Add stone" tap here simply comes off again
    if (inSurf.extra?.d[qi]) {
      const { lab } = MG.components(inSurf.extra);
      const piece = MG.keepPieces(inSurf.extra, (c) => c.id === lab[qi]);
      inSurf.extra = MG.minus(inSurf.extra, piece); inSurf.mask = MG.minus(was, piece);
      return MG.count(inSurf.mask) < Math.max(N * 0.002, wasN * 0.08) ? drop() : removed(inSurf.mask);
    }
    // 2. ask again, now with "not here": the model redraws the edge between the yes and no spots
    inSurf.pts.push([q[0], q[1], 0]);
    const fresh = await autoSeg(A, inSurf, false);
    if (fresh && !MG.at(fresh, q[0], q[1]) && MG.count(fresh) >= wasN * 0.2) { inSurf.mask = MG.inter(fresh, MG.union(was, inSurf.extra || MG.blank(w, h))); return removed(inSurf.mask); }
    inSurf.mask = was;
    const pieces = (await piecesAt(q)).filter((x) => x.s >= 0.72).map((x) => ({ ...x, n: MG.count(x.m), own: MG.countIn(x.m, was) }));
    // 3. the tap's piece is (nearly) this whole area: no stone on it at all
    if (pieces.some((x) => x.own / x.n >= 0.7 && x.own >= wasN * 0.7)) return drop();
    // 4. otherwise cut out the smallest clean piece at the tap
    const cut = pieces.filter((x) => x.own / x.n >= 0.7 && x.own >= Math.min(N * 0.004, wasN * 0.08)).sort((a, b) => a.own - b.own)[0];
    if (!cut) { inSurf.pts.pop(); toast("Couldn't find an edge there. Try another spot, or zoom in."); return null; }
    inSurf.carve = MG.union(inSurf.carve || MG.blank(w, h), cut.m);
    inSurf.mask = MG.minus(was, cut.m);
    return MG.count(inSurf.mask) < Math.max(N * 0.002, wasN * 0.08) ? drop() : removed(inSurf.mask);
  }
  // "stays in front"
  if (thing?.kind === "front") { toast("That already stays in front."); return null; }
  if (thing?.kind === "open") { thing.kind = "front"; return thing.mask; }
  // the thing at the tap: the most certain piece that isn't most of a wall
  const cands = (await piecesAt(q)).filter((x) => x.a < 0.3).map((x) => ({ ...x, wall: surfs.length ? Math.max(...surfs.map((o) => MG.countIn(x.m, o.mask) / Math.max(1, MG.count(o.mask)))) : 0 }));
  const ok = cands.filter((x) => x.wall < 0.5).sort((a, b) => b.s - a.s);
  if (!ok.length) { toast(cands.length ? "That looks like the wall itself. Tap the thing standing in front of it, like the stove." : "Couldn't pick that out. Try tapping the middle of it."); return null; }
  const o = { kind: "front", label: "In front", box: null, pts: [[q[0], q[1], 1]], mask: MG.fillSmallHoles(ok[0].m, N * 0.0008) };
  A.objs.push(o);
  return o.mask;
}

function autoUndo() {
  const A = S.photo?.auto; if (!A || A.busy || !A.hist.length) return;
  A.objs = A.hist.pop();
  if (!A.objs.some((o) => o.kind === "surface" && o.mask) && A.source === "tap") A.state = "tapwall";
  applyAuto(); renderAll();
}
function autoAccept() {
  const ph = S.photo, A = ph?.auto; if (!A) return;
  if (!doneAreas().length) { toast("There's no stone area yet. Tap Add stone, then tap the wall."); return; }
  A.state = "done"; stopAuto();
  exitSetup();
  A.doneSnap = outlineSnap(); A.doneOps = ph.paintOps.slice();
}
/** Back to outlining by hand: the helper's guesses go. */
function autoTrace(silent) {
  const ph = S.photo; if (!ph) return;
  stopAuto(); ph.auto = null;
  ph.paintOps = ph.paintOps.filter((op) => !op.auto); replayPaint();
  ph.areas = []; ph.cur = -1;
  addArea({ silent: true });
  ph.wizard = { step: "outline", back: null, isNew: false };
  syncPhotoZones(); rebuildMasks(true); renderAll();
  if (!silent) toast(ph.outlineMode === "draw" ? "Draw around the area that will get stone." : "Tap each corner of the area that will get stone.");
}

/** Keep the loading panel's progress up to date without redrawing the whole panel. */
function autoProgress() {
  const A = S.photo?.auto; if (!A) return;
  const el = $("#autoload");
  if (el) el.innerHTML = autoLoadRows(A);
  else if (A.state === "loading") renderRail();
}
function autoLoadRows(A) {
  const st = Seg.status;
  const pct = st.state === "ready" || A.model === "ready" ? 100 : Math.round(100 * Math.min(1, st.done / (st.total || 1)));
  const modelDone = A.model === "ready";
  const fetching = st.state === "loading" && pct < 100;
  const row = (state, title, sub) => `<div class="arow is-${state}"><i class="st">${state === "done" ? ICON.check : ""}</i><span><b>${title}</b>${sub ? `<span class="note">${sub}</span>` : ""}</span></div>`;
  let h = row(modelDone ? "done" : "busy", modelDone ? "Photo helper ready" : fetching ? "Getting the photo helper ready" : "Reading your photo",
    modelDone ? "" : fetching ? `${pct}% · the first time downloads about ${Seg.DOWNLOAD_MB} MB` : "A few seconds");
  if (fetching) h += `<div class="abar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`;
  if (A.claude === "asking" || A.claude === "waiting") h += row(A.claude === "asking" ? "busy" : "wait", "Finding the wall and the stove", A.claude === "asking" ? "Claude is looking at your photo" : "");
  else if (A.claude === "done") h += row("done", "Found the wall", "");
  return h;
}

function autoPanel(head) {
  const ph = S.photo, A = ph.auto;
  const trace = `<button class="btn ghost" data-a="autotrace">${ICON.points}I'll trace it myself</button>`;
  const cancel = A.before ? `<button class="btn ghost" data-a="autocancel">${ICON.back}Cancel, keep my old outline</button>` : "";
  const rescan = `<button class="btn" data-a="autorescan">${ICON.scan}Scan again</button>`;
  if (A.state === "loading") {
    return head + `<h2 class="h">Looking at your photo…</h2>
      <p class="sub">Finding where the stone goes, and anything in front of it like a stove. It takes a few seconds.</p>
      <div class="aload" id="autoload" aria-live="polite">${autoLoadRows(A)}</div>
      ${A.claude === "asking" || (A.claude === "waiting" && claudeOn()) ? `<p class="note">Claude, an AI model, looks at your photo to find the wall. The photo isn't posted or shared.</p>` : ""}
      <div class="row">${trace}${cancel}</div>`;
  }
  if (A.state === "tapwall") {
    return head + `<h2 class="h">Tap the wall that gets stone</h2>
      <p class="sub">Tap once anywhere on the wall, chimney or fireplace where the stone will go. The app finds its edges.</p>
      ${A.note ? `<p class="note">${esc(A.note)}</p>` : A.claude === "failed" ? `<p class="note">The automatic look didn't work this time, so it needs one tap from you.</p>` : ""}
      <div class="row">${trace}${cancel}</div>`;
  }
  const names = (kind) => [...new Set(A.objs.filter((o) => o.kind === kind && o.mask).map((o) => o.label))];
  const stone = ph.areas.filter((a) => closedSecs(a).length).map((a) => areaLabel(a)), front = names("front"), open = names("open");
  const legend = `<div class="alegend">
      ${stone.length ? `<div><i class="lg stone"></i><span><b>Stone</b>${esc(stone.join(", "))}</span></div>` : ""}
      ${front.length ? `<div><i class="lg front"></i><span><b>Stays in front</b>${esc(front.join(", "))}</span></div>` : ""}
      ${open.length ? `<div><i class="lg open"></i><span><b>No stone</b>${esc(open.join(", "))}</span></div>` : ""}</div>`;
  if (A.state === "confirm") {
    return head + `<h2 class="h">Does this look right?</h2>
      <p class="sub">The stone shows where we think it goes${front.length ? ", and what's in front stays in front" : ""}.</p>${legend}
      <div class="abig"><button class="btn primary" data-a="autoyes">${ICON.check}Yes, use it</button><button class="btn" data-a="autofix">${ICON.pen}Fix it</button></div>
      <div class="row">${rescan}${trace}</div>${cancel ? `<div class="row">${cancel}</div>` : ""}
      <p class="note">Scan again takes a fresh look at the photo. The size is a first guess: measure something later for a better estimate.</p>`;
  }
  // fix
  return head + `<h2 class="h">Fix it</h2>
    <p class="sub">Choose what to do, then tap that spot on the picture. Each tap finds the edges of what you tapped.</p>
    <div class="fixmodes" role="group" aria-label="What a tap does">${AUTO_MODES.map(([id, l, sub, ic]) => `<button class="toolbtn" data-a="automode" data-v="${id}" aria-pressed="${A.mode === id}"><i class="fm ${id}">${ICON[ic]}</i><span><b>${l}</b><span>${sub}</span></span></button>`).join("")}</div>
    ${A.model !== "ready" ? `<div class="aload" id="autoload" aria-live="polite">${autoLoadRows(A)}</div>` : ""}
    <label class="check"><input type="checkbox" id="autoStraight" ${A.straight ? "checked" : ""}><span>Straighten the edges</span></label>
    ${legend}
    <div class="row" style="justify-content:space-between"><button class="btn ghost" data-a="autoundo"${A.hist.length ? "" : " disabled"}>${ICON.undo}Undo</button><button class="btn primary" data-a="autodone">${ICON.check}Done, use it</button></div>
    <div class="row"><button class="btn" data-a="autopoints">${ICON.points}Move the corners</button>${rescan}</div>${cancel ? `<div class="row">${cancel}</div>` : ""}
    <p class="note">Move the corners lets you drag each corner exactly. Scan again takes a fresh look at the whole photo.</p>`;
}

/** Outlines and name tags on the picture while the helper is up. */
function autoSVG() {
  const ph = S.photo, A = ph.auto; let out = "";
  const P2 = (q) => imgToCss(q[0], q[1]);
  const path = (pts) => pts.map((q, i) => { const c = P2(q); return `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`; }).join(" ") + " Z";
  if (A.state === "confirm" || A.state === "fix") {
    for (const [loops, col] of [[A.frontLoops, "#e2763d"], [A.openLoops, "#5aa0d8"]]) for (const l of loops || []) {
      const d = path(l);
      out += `<path d="${d}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="3.5"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="7 5"/>`;
    }
    for (const a of ph.areas) for (const s of closedSecs(a)) {
      const d = path(s.pts);
      out += `<path d="${d}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="3.6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#f4f2ec" stroke-width="1.8" stroke-linejoin="round"/>`;
    }
    const W = stage.clientWidth, H = stage.clientHeight, narrow = W < 560;
    const fs = narrow ? 11 : 12.5, th = narrow ? 20 : 24, cw = narrow ? 6.2 : 6.9;
    let tags = A.labels || [];
    if (narrow) tags = tags.filter((l) => l.kind !== "front");     // a small picture: the dashed lines and the legend say it
    for (const lb of tags) {
      const c = P2(lb.at), tw = Math.round(lb.text.length * cw + 20);
      // things in front get their tag just above them, so it doesn't hide them; stone areas inside, near the top
      let y = lb.kind === "front" ? c[1] - th / 2 - 5 : lb.kind === "open" ? c[1] : c[1] + th / 2 + 4;
      if (lb.kind === "front" && y < th) y = c[1] + th / 2 + 5;
      const x = clamp(c[0], tw / 2 + 6, W - tw / 2 - 6); y = clamp(y, th / 2 + 4, H - th / 2 - 4);
      const col = lb.kind === "front" ? "#e2763d" : lb.kind === "open" ? "#5aa0d8" : "#86c4ab";
      out += `<g class="atag" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><rect x="${-tw / 2}" y="${-th / 2}" width="${tw}" height="${th}" rx="${th / 2}" fill="rgba(12,14,14,.84)" stroke="${col}" stroke-width="1.5"/><text x="0" y="${(fs * 0.36).toFixed(1)}" text-anchor="middle" fill="#f4f2ec" font-size="${fs}" font-weight="600">${esc(lb.text)}</text></g>`;
    }
  }
  if (A.pulse) { const c = P2(A.pulse); out += `<circle class="apulse" cx="${c[0]}" cy="${c[1]}" r="18" fill="rgba(134,196,171,.18)" stroke="#86c4ab" stroke-width="3"/>`; }
  return out;
}

// ------------------------------------------------------------------ own photo: setup panel
const STEPS = [["outline", "Outline"], ["angle", "Angle"], ["size", "Size"], ["front", "In front"], ["light", "Light"]];
const thetaText = (v) => (Math.abs(v) < 1 ? "straight on" : `${Math.abs(v)}° ${v > 0 ? "away on the right" : "away on the left"}`);
const phiText = (v) => (Math.abs(v) < 1 ? "level" : `${Math.abs(v)}° ${v > 0 ? "up" : "down"}`);
const levelText = (v) => (Math.abs(v) < 0.25 ? "level" : `${Math.abs(v)}° ${v > 0 ? "clockwise" : "counterclockwise"}`);
function rect4(a) {
  const s = a.sections[S.photo.sel.sec];
  if (s && s.closed && s.pts.length === 4) return s;
  return closedSecs(a).find((x) => x.pts.length === 4) || null;
}
function fitRect(manual) {
  const ph = S.photo, a = curArea(); if (!a) return false;
  if (!manual && (a.rectFit === false || closedSecs(a).length !== 1)) return false;
  const s = rect4(a); if (!s) return false;
  const r = G.solveFromRectangle(ph.width, ph.height, ph.f, s.pts);
  if (!r) return false;
  if (!manual && (Math.abs(r.theta) > 65 * G.D2R || Math.abs(r.phi) > 25 * G.D2R)) return false;
  a.theta = r.theta; a.phi = r.phi;
  if (manual) a.angleSet = true;
  return true;
}

function wizardPanel() {
  const ph = S.photo, a = curArea(), s = curSec(), st = ph.wizard.step;
  if (st === "auto" && ph.auto) return autoPanel(`<div class="group"><div class="eyebrow">Set up your photo</div></div>`);
  const idx = STEPS.findIndex((x) => x[0] === st);
  const ready = closedSecs(a).length > 0 || (s && !s.closed && s.pts.length >= 3);
  const anyDone = doneAreas().length > 0 || ready;
  const newEmpty = ph.wizard.isNew && !closedSecs(a).length;
  const head = `<div class="group">
      <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div class="eyebrow">Set up your photo${ph.areas.length > 1 ? ` · ${esc(areaLabel(a))}` : ""}</div>
        ${newEmpty ? `<button class="btn small ghost" data-a="cancelarea">${ICON.x}Cancel new area</button>`
          : anyDone ? `<button class="btn small" data-a="wdone">${ICON.check}Finish setup</button>`
          : ph.areas.length > 1 || S.design.photo ? `<button class="btn small ghost" data-a="wexit">Exit setup</button>` : ""}</div>
      <div class="stepper" role="tablist" aria-label="Setup steps">${STEPS.map((x, i) => `<button role="tab" data-a="wstep" data-v="${x[0]}" class="${i <= idx ? "on" : ""}${i === idx ? " cur" : ""}" aria-selected="${i === idx}"${i > 0 && !ready ? " disabled" : ""}>${x[1]}</button>`).join("")}</div></div>`;
  const nav = (label = "Next") => `<div class="row" style="justify-content:space-between">
      ${idx > 0 ? `<button class="btn ghost" data-a="wback">Back</button>` : "<span></span>"}
      <button class="btn primary" data-a="wnext"${ready ? "" : " disabled"}>${label}</button></div>`;
  if (st === "outline") {
    const draw = ph.outlineMode === "draw", touchy = S.mode === "kiosk" || window.matchMedia("(pointer: coarse)").matches;
    const tip = draw
      ? (!s || !s.closed ? `Draw around the area with your ${touchy ? "finger" : "mouse"}, all the way around. Let go and the shape closes itself. ${touchy ? "Use two fingers to move or zoom the picture." : "Scroll to zoom; drag with the right button to move the picture."}`
        : "Drag a point to fine-tune the shape. To add another piece of this wall, just draw around it.")
      : !s || !s.pts.length ? (closedSecs(a).length ? "Tap the corners of the new section on the photo." : "Tap each corner of the area that will get stone, working your way around it.")
      : !s.closed && s.pts.length < 3 ? "Keep tapping corners. Drag the picture to move around, and pinch, scroll or use + to zoom in on tight spots."
      : !s.closed ? "Tap the orange first point, or press <b>Finish section</b>, to close the shape."
      : "Drag a point to move it, or tap it to select and delete it. Drag the small + between two points to add a corner.";
    const one = closedSecs(a);
    return head + `<h2 class="h">Outline the stone</h2>
      <div class="seg wmode" role="group" aria-label="How to outline">
        <button data-a="wmode" data-v="tap" aria-pressed="${!draw}">${ICON.points}Tap the corners</button>
        <button data-a="wmode" data-v="draw" aria-pressed="${draw}">${ICON.scribble}Draw around it</button></div>
      <p class="sub">${tip}</p>
      ${!helperOn() ? "" : !doneAreas().length && !s?.pts.length ? `<button class="btn" data-a="autofind">${ICON.wand}Let the app find it</button>` : doneAreas().length ? `<div class="row"><button class="btn" data-a="autoreopen">${ICON.wand}Fix it with taps</button><button class="btn" data-a="autorescan">${ICON.scan}Scan again</button></div>` : ""}${areaList()}
      ${one.length === 1 && one[0].pts.length === 4 ? `<label class="check"><input type="checkbox" id="rectFit" ${a.rectFit !== false ? "checked" : ""}><span>This section is a rectangle on the real wall. Use its corners to work out the angle.</span></label>` : ""}
      <p class="note">${draw ? "Drawing is quick for curved or uneven edges. Tapping corners is more exact for straight ones; you can switch any time." : S.mode === "kiosk" || window.matchMedia("(pointer: coarse)").matches ? "Tip: your finger hides the spot you're tapping. Hold still for a moment and a magnified view appears; slide to place the point exactly, then let go." : "Tip: zoom in with the mouse wheel for tight spots. Keys: Enter finishes a section, Delete removes the selected point, Ctrl+Z undoes, Alt turns off snapping."}</p>
      ${nav()}
      <div class="row"><button class="btn small ghost" data-a="photo">${ICON.cam}Use a different photo</button></div>`;
  }
  if (st === "angle") {
    return head + `<h2 class="h">Match the angle</h2><p class="sub">Turn the wall until the grid lines run parallel to straight lines in your photo, like a mantel, the ceiling line or the floor.</p>
      ${slider("w_theta", "Wall angle", Math.round(a.theta / G.D2R), -70, 70, 1, thetaText)}
      ${slider("w_phi", "Camera tilt", Math.round(a.phi / G.D2R), -30, 30, 1, phiText)}
      ${slider("w_rot", "Level the stone", a.rot || 0, -20, 20, 0.5, levelText)}
      <div class="row"><button class="btn small" data-a="wstraight">Straight on</button><button class="btn small" data-a="wguide">Line up with an edge</button>${rect4(a) ? `<button class="btn small" data-a="wrect">Use the corners</button>` : ""}</div>
      ${a.guides.length ? `<p class="note">Drag the ends of the orange guide onto a straight edge in the photo. A mantel or the ceiling line works well. The angle follows.</p>` : ""}
      <p class="note">${ph.focalKnown ? `Lens read from the photo: ${ph.f35} mm equivalent.` : "Lens assumed: a typical phone camera."}</p>` + nav();
  }
  if (st === "size") {
    const m = a.measure || { inches: 96, guessed: true };
    const ft = Math.floor(m.inches / 12), inch = Math.round((m.inches - ft * 12) * 10) / 10;
    return head + `<h2 class="h">Set the size</h2><p class="sub">Drag the white measuring line onto something you know the length of, then enter that length. The stone rescales to match.</p>
      <div class="inline"><div class="field"><label for="m_ft">Feet</label><input id="m_ft" type="number" min="0" max="60" value="${ft}" inputmode="numeric"></div>
        <div class="field"><label for="m_in">Inches</label><input id="m_in" type="number" min="0" max="11.9" step="0.5" value="${inch}" inputmode="decimal"></div></div>
      <div class="pills">${[["Ceiling 8 ft", 96], ["Ceiling 9 ft", 108], ["Door 6′8″", 80], ["Outlet cover 4½″", 4.5], ["Brick 2¼″ tall", 2.25]].map(([l, v]) => `<button class="pill" data-a="wpreset" data-v="${v}">${l}</button>`).join("")}</div>
      ${m.guessed ? `<p class="warnnote">The size is a guess: the measuring line is assumed to be 8 ft. Measure something for an accurate estimate.</p>` : m.eyeballed ? `<p class="warnnote">The size was set by eye with Size &amp; angle. Measure something for an accurate estimate.</p>` : ""}
      <div class="group"><div class="eyebrow">Outside corners (optional)</div><p class="note">Tap any edge of the outline where the stone wraps around an outside corner. It turns orange, and the estimate adds corner pieces for it.</p></div>` + nav();
  }
  if (st === "front") {
    const tools = [["front", "Paint in front", "Stove, mantel, furniture", "#e2763d"], ["open", "Paint openings", "Windows, firebox: no stone", "#5aa0d8"], ["erase", "Erase", "Remove painting", "#888"], ["magic", "Tap to select", helperOn() ? "Picks out the thing you tap" : "Picks a similar-colored shape", "#7dbba3"]];
    return head + `<h2 class="h">Keep things in front</h2><p class="sub">Paint over anything that stands in front of the wall so it stays in front of the stone. Mark openings separately: they come off the estimate.</p>
      <div class="tools4">${tools.map(([id, l, sub, c]) => `<button class="toolbtn" data-a="wtool" data-v="${id}" aria-pressed="${ph.tool === id}"><i style="background:${c}"></i><span><b>${l}</b><span>${sub}</span></span></button>`).join("")}</div>
      ${slider("w_brush", "Brush size", ph.brush, 6, 120, 1, (v) => `${v}px`)}
      <div class="row"><button class="btn small ghost" data-a="wclearpaint"${ph.paintOps.length ? "" : " disabled"}>Clear all painting</button></div>
      <p class="note">For something tall and narrow like a stove pipe, it's often easier to go back to Outline and draw the wall on each side as its own section.</p>` + nav();
  }
  if (st === "light") {
    return head + `<h2 class="h">Match the light</h2><p class="sub">The stone already picks up your room's light from the photo. Fine-tune it here.</p>` + photoLightControls().replace('<div class="group"><div class="eyebrow">Match your room\'s light</div>', '<div class="group">') + nav("Done");
  }
  return "";
}

function areaList() {
  const ph = S.photo;
  return `<div class="arealist">${ph.areas.map((a, k) => {
    const cur = k === ph.cur;
    const n = closedSecs(a).length;
    const opts = AREA_KINDS.includes(a.label) ? AREA_KINDS : [a.label, ...AREA_KINDS];
    return `<div class="arearow ${cur ? "cur" : ""}" ${cur ? "" : `data-a="selarea" data-v="${k}" role="button" tabindex="0"`}>
      <div class="hd">
        ${cur ? `<select data-arealabel="${k}" aria-label="What is this area?">${opts.map((o) => `<option${o === a.label ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
          : `<b>${esc(areaLabel(a))}</b><span class="note">${n ? `${n} section${n === 1 ? "" : "s"}` : "not outlined"}</span>`}
        <button class="btn small ghost icon" data-a="delarea" data-v="${k}" data-tip="Delete this area" aria-label="Delete ${esc(areaLabel(a))}">${ICON.trash}</button>
      </div>
      ${cur ? `<div class="secs">${a.sections.map((s, j) => (s.pts.length || j === ph.sel.sec) ? `<span class="secchip ${j === ph.sel.sec ? "sel" : ""}"><button data-a="selsec" data-v="${j}"><i class="st ${s.closed ? "" : "open"}"></i>Section ${j + 1}${s.closed ? "" : s.pts.length ? " · drawing" : " · new"}</button>${s.pts.length ? `<button class="x" data-a="delsecat" data-v="${j}" aria-label="Delete section ${j + 1}">${ICON.x}</button>` : ""}</span>` : "").join("")}
        <button class="btn small" data-a="addsec">${ICON.plus}Add section</button></div>` : ""}
    </div>`;
  }).join("")}
  <button class="btn" data-a="addarea"${ph.areas.length >= 6 ? " disabled" : ""}>${ICON.plus}Add an area at a different angle</button>
  <p class="note">Sections are pieces of one flat surface, like the wall on each side of a stove pipe; the stone lines up across them. Add an area for a surface that faces another way, like a chimney side or the front of a hearth.</p></div>`;
}

function bindWizardPanel() {
  const ph = S.photo, a = curArea();
  const as = $("#autoStraight");
  if (as) as.addEventListener("change", () => { const A = ph.auto; if (!A) return; A.straight = as.checked; applyAuto(); renderAll(); });
  const rf = $("#rectFit");
  if (rf) rf.addEventListener("change", () => { pushHist(); a.rectFit = rf.checked; if (rf.checked) { a.angleSet = false; fitRect(false); } geometryChanged(false); });
  // one undo step per slider drag or per typed value
  const armedInput = (el, fn) => { if (!el) return; let on = true; el.addEventListener("input", () => { if (on) { pushHist(); on = false; } fn(); }); el.addEventListener("change", () => { on = true; renderHud(); }); };
  armedInput($("#m_ft"), setMeasureFromInputs); armedInput($("#m_in"), setMeasureFromInputs);
  armedInput($("#s_w_theta"), () => { const v = +$("#s_w_theta").value; a.theta = v * G.D2R; a.angleSet = true; $("#o_w_theta").textContent = thetaText(v); liveGeometry(false); });
  armedInput($("#s_w_phi"), () => { const v = +$("#s_w_phi").value; a.phi = v * G.D2R; a.angleSet = true; $("#o_w_phi").textContent = phiText(v); liveGeometry(false); });
  armedInput($("#s_w_rot"), () => { const v = +$("#s_w_rot").value; a.rot = v; $("#o_w_rot").textContent = levelText(v); liveGeometry(false); });
  const br = $("#s_w_brush"); if (br) br.addEventListener("input", () => { ph.brush = +br.value; $("#o_w_brush").textContent = br.value + "px"; });
  const sel = $("select[data-arealabel]"); if (sel) sel.addEventListener("change", () => { pushHist(); a.label = sel.value; syncPhotoZones(); renderRail(); renderCaption(); renderHud(); });
}
function setMeasureFromInputs() {
  const a = curArea(); if (!a?.measure) return;
  const ft = parseFloat($("#m_ft").value) || 0, inch = parseFloat($("#m_in").value) || 0;
  const v = ft * 12 + inch;
  if (v > 0) { a.measure = { ...a.measure, inches: v, guessed: false, eyeballed: false }; a.sizeK = 1; liveGeometry(false); const w = $("#railBody .warnnote"); if (w) w.remove(); }
}

/** Move between setup steps. Unfinished shapes with 3+ points are closed; scraps are dropped. */
function goStep(target) {
  const ph = S.photo, a = curArea(); if (!ph || !a) return;
  wizardCancel(true); hideLoupe(); drawBrush(null);
  const from = ph.wizard?.step;
  if (target === "exit") { exitSetup(); return; }
  withHist(() => { tidyArea(a); if (from === "outline" && target !== "outline" && !a.angleSet) fitRect(false); });
  sanitizeSel(); ph.sel.pt = -1;
  if (target !== "outline" && !closedSecs(a).length) { toast("Outline at least one section first: tap its corners on the photo."); renderAll(); return; }
  if (target === "done") { exitSetup(); return; }
  if (target === "size") foldSize(a);
  ph.wizard = { ...ph.wizard, step: target, isNew: false };
  S.grid = target === "angle" || target === "size";
  syncPhotoZones(); rebuildMasks(true); renderAll();
}
/** Leave setup. Areas that never got an outline are removed. */
function exitSetup() {
  const ph = S.photo; if (!ph) return;
  wizardCancel(true); hideLoupe(); drawBrush(null);
  withHist(() => {
    ph.areas.forEach(tidyArea);
    const keep = ph.areas.filter((a) => closedSecs(a).length);
    if (keep.length) ph.areas = keep;
    else ph.areas = ph.areas.slice(0, 1);
  });
  ph.cur = clamp(ph.cur, 0, ph.areas.length - 1); sanitizeSel(); ph.sel.pt = -1;
  ph.wizard = null; S.grid = false; S.tab = "stone";
  const a = curArea();
  S.target = a && closedSecs(a).length ? a.id : "all";
  syncPhotoZones(); rebuildMasks(true); renderAll(); setTimeout(refit, 30);
  revealStage();
  if (doneAreas().length) toast("Your photo is set up. If the stones look too big, too small or crooked, use Size & angle.", { a: "fitopen", label: "Size & angle" });
}

async function wizardAction(a, v) {
  if (a === "samplephoto") { samplePhoto(); return; }
  if (ideaActions[a]) { ideaActions[a](v); return; }
  if (cardActions[a]) { cardActions[a](v); return; }
  if (a === "openphoto") { if (S.photo) { closeLayer(); await setRoom("photo"); } return; }
  const ph = S.photo; if (!ph) return;
  const order = STEPS.map((x) => x[0]);
  const i = order.indexOf(ph.wizard?.step);
  const area = curArea();
  switch (a) {
    case "undo": stepHist(-1); return;
    case "redo": stepHist(1); return;
    case "zoomin": zoomBy(1.6); return;
    case "zoomout": zoomBy(1 / 1.6); return;
    case "finishsec": finishSection(); return;
    case "delpt": deletePoint(); return;
    case "delsec": deleteSection(); return;
    case "delsecat": deleteSection(+v); return;
    case "selsec": selectSection(+v); return;
    case "addsec":
      if (v !== undefined && v !== "" && +v !== ph.cur) { ph.cur = clamp(+v, 0, ph.areas.length - 1); sanitizeSel(); }
      addSection(); return;
    case "addarea": addArea(); return;
    case "cancelarea": cancelNewArea(); return;
    case "selarea": selectArea(+v); return;
    case "delarea": deleteArea(+v); return;
    case "wstep": goStep(v); return;
    case "wnext": goStep(i < order.length - 1 ? order[i + 1] : "done"); return;
    case "wback": if (i > 0) goStep(order[i - 1]); return;
    case "wdone": goStep("done"); return;
    case "wexit": exitSetup(); return;
    case "wstraight": pushHist(); area.theta = 0; area.phi = 0; area.rot = 0; area.guides = []; area.angleSet = true; geometryChanged(false); return;
    case "wrect": pushHist(); fitRect(true); geometryChanged(false); return;
    case "wguide": {
      const pts = closedSecs(area).flatMap((s) => s.pts);
      const c = G.centroid(pts.length ? pts : [[ph.width / 2, ph.height / 2]]);
      const w = ph.width * 0.18;
      pushHist();
      area.guides = [[[c[0] - w, c[1] - ph.height * 0.08], [c[0] + w, c[1] - ph.height * 0.08]]];
      renderRail(); renderHud(); drawOverlay(); return;
    }
    case "wpreset": pushHist(); area.measure = { ...area.measure, inches: parseFloat(v), guessed: false, eyeballed: false }; area.sizeK = 1; geometryChanged(false); return;
    case "wtool": ph.tool = v; renderRail(); return;
    case "wmode": {
      ph.outlineMode = v === "draw" ? "draw" : "tap";
      const sec = curSec();
      if (ph.outlineMode === "draw" && sec && !sec.closed && sec.pts.length && sec.pts.length < 3) { pushHist(); sec.pts = []; sec.cf = []; }   // drop a couple of stray taps
      renderRail(); renderHud(); drawOverlay();
      toast(ph.outlineMode === "draw" ? (S.mode === "kiosk" || window.matchMedia("(pointer: coarse)").matches ? "Draw around the area with your finger." : "Draw around the area with the mouse.") : "Tap each corner of the area.");
      return;
    }
    case "autoyes": case "autodone": autoAccept(); return;
    case "autofix": if (ph.auto) { ph.auto.state = "fix"; renderAll(); } return;
    case "autotrace": autoTrace(); return;
    case "autofind": startAuto(); return;
    case "autorescan": if (S.roomId !== "photo") await setRoom("photo"); startAuto({ fresh: true }); return;
    case "autoreopen": if (S.roomId !== "photo") await setRoom("photo"); reopenAuto(); return;
    case "autocancel": autoCancel(); return;
    case "autopoints": autoPoints(); return;
    case "automode": if (ph.auto) { ph.auto.mode = v; renderRail(); renderHud(); } return;
    case "autoundo": autoUndo(); return;
    case "wclearpaint": if (!ph.paintOps.length) return; pushHist(); ph.paintOps = []; replayPaint(); rebuildMasks(true); geometryChanged(false); return;
  }
}

// ------------------------------------------------------------------ own photo: pointer handling
// Tap = add a point. Drag = move the picture (like a map). Press and hold, then slide = place a point
// exactly, with a magnifier. Drag a point to move it. Pinch, wheel or the +/- buttons zoom.
const HANDLE = { mouse: { r: 4.5, hit: 13, snap: 9 }, touch: { r: 6, hit: 22, snap: 14 } };
const ptrKind = (ev) => (ev && (ev.pointerType === "touch" || ev.pointerType === "pen") ? "touch" : "mouse");
function hsize(kind) {
  const h = HANDLE[kind || S.photo?.lastKind || "mouse"] || HANDLE.mouse;
  return S.mode === "kiosk" ? { r: h.r + 1.5, hit: h.hit + 6, snap: h.snap + 4 } : h;
}
const dispScale = () => engine.view.scale * (stage.clientWidth / canvas.width);   // CSS px per photo px
const isZoomed = () => engine.view.scale > (engine.view.fitScale || engine.view.scale) * 1.02;
let wd = null;          // the gesture in progress during setup
let spaceDown = false;

function hitTest(p, kind, drawing) {
  const ph = S.photo, a = curArea(), st = ph.wizard?.step; if (!a) return null;
  const H = hsize(kind);
  let best = null, bd = H.hit;
  const take = (q, h, bias = 0) => { const c = imgToCss(q[0], q[1]); const d = Math.hypot(c[0] - p[0], c[1] - p[1]) + bias; if (d < bd) { bd = d; best = h; } };
  if (st === "outline") {
    a.sections.forEach((s, j) => {
      if (drawing && j !== ph.sel.sec) return;      // while drawing, other sections' points are snap targets, not handles
      s.pts.forEach((q, i) => take(q, { kind: "vtx", sec: j, i }, j === ph.sel.sec ? 0 : 2));
    });
    const s = a.sections[ph.sel.sec];
    if (!best && s && s.closed) {
      bd = H.hit * 0.85;
      s.pts.forEach((q, i) => {
        const r = s.pts[(i + 1) % s.pts.length];
        const c1 = imgToCss(q[0], q[1]), c2 = imgToCss(r[0], r[1]);
        if (Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) < 28) return;
        take([(q[0] + r[0]) / 2, (q[1] + r[1]) / 2], { kind: "mid", sec: ph.sel.sec, i });
      });
    }
  }
  if (st === "size" && a.measure && a.map) { take(a.measure.a, { kind: "meas", end: "a" }); take(a.measure.b, { kind: "meas", end: "b" }); }
  if (st === "angle") a.guides.forEach((g, gi) => g.forEach((q, e) => take(q, { kind: "guide", gi, e })));
  return best;
}
function nearestEdge(p, kind) {
  const a = curArea(); if (!a) return null;
  let best = null, bd = hsize(kind).hit * 0.8;
  a.sections.forEach((s, j) => {
    if (!s.closed) return;
    s.pts.forEach((q, i) => { const d = segDist(p, imgToCss(...q), imgToCss(...s.pts[(i + 1) % s.pts.length])); if (d < bd) { bd = d; best = { sec: j, i }; } });
  });
  return best;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** Snap to existing corners (shared edges line up exactly) or to the photo's edges. */
function snapImg(q, kind, skip, allowFirst = false) {
  const ph = S.photo, H = hsize(kind);
  const c = imgToCss(q[0], q[1]);
  let best = null, bd = H.snap;
  ph.areas.forEach((a, k) => a.sections.forEach((s, j) => {
    const same = skip && skip.k === k && skip.j === j;
    s.pts.forEach((v, i) => {
      if (same && !(allowFirst && i === 0 && s.pts.length >= 3)) return;
      const cv = imgToCss(v[0], v[1]); const d = Math.hypot(cv[0] - c[0], cv[1] - c[1]);
      if (d < bd) { bd = d; best = { q: [v[0], v[1]], k, j, i, hit: true }; }
    });
  }));
  if (best) return best;
  let [x, y] = q, hit = false;
  const e0 = imgToCss(0, 0), e1 = imgToCss(ph.width, ph.height);
  if (Math.abs(c[0] - e0[0]) < H.snap) { x = 0; hit = true; } else if (Math.abs(c[0] - e1[0]) < H.snap) { x = ph.width; hit = true; }
  if (Math.abs(c[1] - e0[1]) < H.snap) { y = 0; hit = true; } else if (Math.abs(c[1] - e1[1]) < H.snap) { y = ph.height; hit = true; }
  return { q: [clamp(x, 0, ph.width), clamp(y, 0, ph.height)], hit };
}
function rawImg(p) { const ph = S.photo; const [x, y] = cssToImg(p[0], p[1]); return [clamp(x, 0, ph.width), clamp(y, 0, ph.height)]; }

function wizardPointerDown(ev, p) {
  const ph = S.photo, st = ph.wizard.step, kind = ptrKind(ev);
  ph.lastKind = kind;
  const a = curArea(), s = curSec();
  const base = { start: p, view0: { ...engine.view }, ptype: kind, t: performance.now(), moved: false };
  if (st === "auto") { wd = { ...base, kind: "autotap" }; return true; }
  if (st === "outline") {
    const drawing = !!(s && !s.closed);
    const h = hitTest(p, kind, drawing);
    if (h && h.kind === "vtx") {
      if (drawing && h.sec === ph.sel.sec && h.i === 0 && s.pts.length >= 3) { wd = { ...base, kind: "closeTap" }; return true; }
      if (h.sec !== ph.sel.sec) { const target = a.sections[h.sec]; withHist(() => tidyArea(a)); ph.sel.sec = Math.max(0, a.sections.indexOf(target)); }
      ph.sel.pt = h.i;
      const q = a.sections[ph.sel.sec].pts[h.i];
      wd = { ...base, kind: "vtx", sec: ph.sel.sec, i: h.i, orig: [q[0], q[1]] };
      if (kind === "touch") showLoupe(p, q);
      renderHud(); drawOverlay(); renderRail();
      return true;
    }
    if (h && h.kind === "mid") { wd = { ...base, kind: "mid", sec: h.sec, i: h.i }; return true; }
    if (ph.outlineMode === "draw") { wd = { ...base, kind: "draw", css: [p], pts: [rawImg(p)] }; drawOverlay(); return true; }
    if (drawing || !s) {
      wd = { ...base, kind: "place", mode: "pending" };
      // hold still for a moment: precise placement with a magnifier
      wd.timer = setTimeout(() => {
        if (!wd || wd.kind !== "place" || wd.mode !== "pending") return;
        wd.mode = "precise";
        const sn = ev.altKey ? { q: rawImg(wd.start) } : snapImg(rawImg(wd.start), kind, { k: ph.cur, j: ph.sel.sec }, true);
        wd.q = sn.q; wd.snap = sn;
        showLoupe(wd.last || wd.start, wd.q); drawOverlay();
      }, 280);
      return true;
    }
    wd = { ...base, kind: "idle" };
    return true;
  }
  if (st === "angle" || st === "size") {
    const h = hitTest(p, kind);
    if (h) {
      wd = { ...base, ...h };
      if (kind === "touch") showLoupe(p, h.kind === "meas" ? a.measure[h.end] : a.guides[h.gi][h.e]);
      return true;
    }
    if (st === "size") {
      const e = nearestEdge(p, kind);
      if (e) { pushHist(); const sec = a.sections[e.sec]; sec.cf[e.i] = !sec.cf[e.i]; geometryChanged(false); return true; }
    }
    wd = { ...base, kind: "idle" };
    return true;
  }
  if (st === "front") {
    const [ix, iy] = cssToImg(p[0], p[1]);
    if (ph.tool === "magic" && helperOn() && Seg.status.state === "ready") { magicPick(ix, iy); return true; }
    if (ph.tool === "magic") {
      const r = P.magicSelect(ph.canvas, ix, iy, 30);
      if (!r || r.fraction > 0.5) { toast("That selected too much. Try tapping the object itself, or paint it."); return true; }
      pushHist();
      ph.paintOps.push({ t: "magic", c: r.small });
      ph.occ.getContext("2d").drawImage(r.canvas, 0, 0);
      paintEnd();
      toast("Added to “in front”. Paint or erase to touch it up.", { a: "undo", label: "Undo" });
      return true;
    }
    pushHist(); paintStart(ix, iy);
    wd = { ...base, kind: "paint" };
    return true;
  }
  wd = { ...base, kind: "idle" };
  return true;
}

function wizardPointerMove(ev, p) {
  const ph = S.photo;
  if (!wd) { wizardHover(ev, p); return; }
  const kind = wd.ptype, a = curArea();
  const dist = Math.hypot(p[0] - wd.start[0], p[1] - wd.start[1]);
  wd.last = p;
  const pan = () => {
    if (!isZoomed()) return;
    const [dx, dy] = cssToCanvas(p[0] - wd.start[0], p[1] - wd.start[1]);
    engine.view.ox = wd.view0.ox + dx; engine.view.oy = wd.view0.oy + dy;
    clampView(); invalidate(); drawOverlay();
  };
  switch (wd.kind) {
    case "closeTap":
      if (dist > 6) { const s = curSec(); ph.sel.pt = 0; wd = { ...wd, kind: "vtx", sec: ph.sel.sec, i: 0, orig: [...s.pts[0]] }; }
      return;
    case "vtx": {
      if (!wd.moved) { if (dist < 3) return; pushHist(); wd.moved = true; }
      const sn = ev.altKey ? { q: rawImg(p) } : snapImg(rawImg(p), kind, { k: ph.cur, j: wd.sec });
      a.sections[wd.sec].pts[wd.i] = sn.q; wd.snap = sn;
      showLoupe(p, sn.q);
      liveGeometry(a.sections[wd.sec].closed);
      return;
    }
    case "mid": {
      if (dist < 4) return;
      pushHist();
      const sec = a.sections[wd.sec];
      const ni = insertPoint(sec, wd.i, rawImg(p));
      ph.sel = { sec: wd.sec, pt: ni };
      wd = { ...wd, kind: "vtx", i: ni, moved: true };
      renderHud(); liveGeometry(true);
      return;
    }
    case "place": {
      if (wd.mode === "pending") {
        if (dist > 7) { clearTimeout(wd.timer); wd.mode = "pan"; }
        else return;
      }
      if (wd.mode === "pan") { pan(); return; }
      // precise placement
      const sn = ev.altKey ? { q: rawImg(p) } : snapImg(rawImg(p), kind, { k: ph.cur, j: ph.sel.sec }, true);
      wd.q = sn.q; wd.snap = sn;
      showLoupe(p, sn.q); drawOverlay();
      return;
    }
    case "meas": case "guide": {
      if (!wd.moved) { if (dist < 3) return; pushHist(); wd.moved = true; }
      const q = rawImg(p);
      if (wd.kind === "meas") a.measure = { ...a.measure, [wd.end]: q, auto: false };
      else { a.guides[wd.gi][wd.e] = q; solveGuides(); }
      showLoupe(p, q); liveGeometry(false);
      return;
    }
    case "paint": { const [ix, iy] = cssToImg(p[0], p[1]); paintMove(ix, iy); drawBrush(p); return; }
    case "draw": {
      const last = wd.css[wd.css.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
      wd.css.push(p); wd.pts.push(rawImg(p)); wd.moved = true;
      drawOverlay();
      return;
    }
    case "idle": case "autotap": if (dist > 6) { wd.moved = true; pan(); } return;
  }
}

function wizardPointerUp(ev, p) {
  const ph = S.photo; const w = wd; wd = null; hideLoupe();
  if (!w) return;
  clearTimeout(w.timer);
  const a = curArea();
  switch (w.kind) {
    case "closeTap": finishSection(); return;
    case "vtx":
      if (w.moved) { if (ph.wizard) ph.wizard.isNew = false; geometryChanged(true); }
      else { renderHud(); drawOverlay(); }
      return;
    case "mid": {   // a tap on a midpoint adds a corner there
      pushHist();
      const sec = a.sections[w.sec];
      const q0 = sec.pts[w.i], q1 = sec.pts[(w.i + 1) % sec.pts.length];
      ph.sel = { sec: w.sec, pt: insertPoint(sec, w.i, [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2]) };
      geometryChanged(true);
      return;
    }
    case "place": {
      if (w.mode === "pan") return;
      let s = curSec();
      if (!s || s.closed) {     // tapped empty photo while nothing is being drawn: start a new section
        if (s && s.closed) { tapSelect(p); return; }
      }
      if (!s) return;
      const sn = w.mode === "precise" ? w.snap : (ev.altKey ? { q: rawImg(p) } : snapImg(rawImg(p), w.ptype, { k: ph.cur, j: ph.sel.sec }, true));
      if (sn.k === ph.cur && sn.j === ph.sel.sec && sn.i === 0 && s.pts.length >= 3) { finishSection(); return; }
      pushHist();
      s.pts.push(sn.q); s.cf.push(false);
      ph.sel.pt = -1;
      geometryChanged(false);
      return;
    }
    case "meas": case "guide":
      if (w.moved) { if (w.kind === "guide") a.angleSet = true; geometryChanged(false); }
      return;
    case "paint": paintEnd(); return;
    case "draw": finishDrawing(w); return;
    case "idle": if (!w.moved) tapSelect(p); return;
    case "autotap": if (!w.moved) autoTap(p); return;
  }
}

/** "Tap to select" with the photo helper: the model picks out the thing that was tapped (a stove,
 *  a pipe, a chair) by its edges, not just by its color. */
let magicBusy = false;
async function magicPick(ix, iy) {
  const ph = S.photo; if (magicBusy || !ph) return;
  magicBusy = true;
  const slow = setTimeout(() => toast("Finding its edges…"), 600);
  try {
    const info = await Seg.encode(ph.canvas);
    if (S.photo !== ph) return;
    const q = [ix * info.k, iy * info.k];
    const pick = (await piecesAt(q)).filter((x) => x.a < 0.3 && x.s >= 0.7).sort((a, b) => b.s - a.s)[0];
    if (!pick) { toast("That selected too much. Try tapping the object itself, or paint it."); return; }
    pushHist();
    const c = MG.toCanvas(MG.fillSmallHoles(pick.m, info.w * info.h * 0.0008));
    ph.paintOps.push({ t: "magic", c });
    P.drawMagic(c, ph.width, ph.height, ph.occ);
    paintEnd();
    toast("Added to “in front”. Paint or erase to touch it up.", { a: "undo", label: "Undo" });
  } catch (e) {
    toast("That didn't work. Try again, or paint it.");
  } finally { clearTimeout(slow); magicBusy = false; }
}

/** Freehand outline: the finger's path becomes a closed shape with just enough corners to follow
 *  it, which can then be fine-tuned point by point like a tapped outline. */
function finishDrawing(w) {
  const ph = S.photo, a = curArea();
  const len = w.css.reduce((t, c, i) => (i ? t + Math.hypot(c[0] - w.css[i - 1][0], c[1] - w.css[i - 1][1]) : 0), 0);
  if (len < 40) { if (!w.moved || len < 8) tapSelect(w.start); drawOverlay(); return; }     // a tap, not a drawing
  const k = dispScale() || 1;                       // CSS px per photo px
  const raw = smoothPath(w.pts);
  let eps = (w.ptype === "touch" ? 6 : 4) / k, poly = simplifyClosed(raw, eps);   // a fingertip wobbles more than a mouse
  while (poly.length > 32) { eps *= 1.35; poly = simplifyClosed(raw, eps); }
  if (poly.length < 3 || G.shoelace(poly) * k * k < 900) { toast("Draw all the way around the area, then let go."); drawOverlay(); return; }
  pushHist();
  let s = curSec();
  if (!s || s.closed) { a.sections.push(newSection()); ph.sel = { sec: a.sections.length - 1, pt: -1 }; s = curSec(); }
  s.pts = poly.map((q) => [clamp(q[0], 0, ph.width), clamp(q[1], 0, ph.height)]);
  s.cf = s.pts.map(() => false);
  s.closed = true;
  ph.sel.pt = -1;
  if (ph.wizard) ph.wizard.isNew = false;
  geometryChanged(true);
}
/** A light moving average takes the wobble out of a finger-drawn line. */
function smoothPath(pts) {
  if (pts.length < 5) return pts.slice();
  return pts.map((q, i) => {
    if (i === 0 || i === pts.length - 1) return q;
    const a = pts[i - 1], b = pts[i + 1];
    return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4];
  });
}
/** Douglas-Peucker on a closed loop: split at the point farthest from the start, simplify both halves. */
function simplifyClosed(pts, eps) {
  if (pts.length < 4) return pts.slice();
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const rdp = (seg) => {
    if (seg.length < 3) return seg.slice();
    const a = seg[0], b = seg[seg.length - 1];
    let idx = -1, dmax = 0;
    for (let i = 1; i < seg.length - 1; i++) { const d = segDist(seg[i], a, b); if (d > dmax) { dmax = d; idx = i; } }
    if (dmax <= eps) return [a, b];
    const l = rdp(seg.slice(0, idx + 1)), r = rdp(seg.slice(idx));
    return l.slice(0, -1).concat(r);
  };
  const one = rdp(pts.slice(0, far + 1)), two = rdp(pts.slice(far).concat([pts[0]]));
  const out = one.slice(0, -1).concat(two.slice(0, -1));
  // the loop's own closing gap: drop a last point that sits right next to the first
  while (out.length > 3 && Math.hypot(out[out.length - 1][0] - out[0][0], out[out.length - 1][1] - out[0][1]) < eps * 1.5) out.pop();
  return out;
}

/** Abandon the gesture in progress (a second finger arrived, Escape, undo). */
function wizardCancel(silent) {
  const w = wd; if (!w) return;
  wd = null; hideLoupe(); clearTimeout(w.timer);
  const ph = S.photo;
  if ((w.kind === "vtx" || w.kind === "meas" || w.kind === "guide") && w.moved && ph.hist.undo.length) {
    restoreSnap(ph.hist.undo.pop());
    return;
  }
  if (w.kind === "paint") paintEnd();
  if (!silent) { renderHud(); drawOverlay(); }
}

function wizardHover(ev, p) {
  const ph = S.photo; if (!ph?.wizard) return;
  const st = ph.wizard.step;
  if (st === "auto") { stage.style.cursor = ph.auto?.busy ? "progress" : ph.auto?.state === "fix" || ph.auto?.state === "tapwall" ? "crosshair" : isZoomed() ? "grab" : "default"; return; }
  if (st === "front") { drawBrush(p); stage.style.cursor = ph.tool === "magic" ? "pointer" : "none"; return; }
  drawBrush(null);
  if (ev.pointerType !== "mouse") return;
  const s = curSec();
  const drawing = !!(s && !s.closed);
  const h = hitTest(p, "mouse", drawing);
  const edge = st === "size" && !h ? nearestEdge(p, "mouse") : null;
  stage.style.cursor = spaceDown ? "grab" : h ? (h.kind === "mid" ? "copy" : "grab") : edge ? "pointer" : st === "outline" ? "crosshair" : isZoomed() ? "grab" : "default";
  if (st === "outline" && ph.outlineMode === "draw") { if (ph.hover) { ph.hover = null; drawOverlay(); } return; }
  if (st === "outline" && drawing) {
    const sn = ev.altKey ? { q: rawImg(p) } : snapImg(rawImg(p), "mouse", { k: ph.cur, j: ph.sel.sec }, true);
    ph.hover = sn.q; ph.hoverSnap = sn;
    drawOverlay();
  } else if (ph.hover) { ph.hover = null; drawOverlay(); }
}

/** Tap on the photo during setup: pick the section (or area) under the finger. */
function tapSelect(p) {
  const ph = S.photo; const q = rawImg(p);
  const order = [ph.cur, ...ph.areas.map((_, k) => k).filter((k) => k !== ph.cur)];
  for (const k of order) {
    const a = ph.areas[k]; if (!a) continue;
    for (let j = a.sections.length - 1; j >= 0; j--) {
      const s = a.sections[j];
      if (s.closed && pointInPoly(q, s.pts)) {
        if (k !== ph.cur) { selectArea(k); const jj = curArea().sections.indexOf(s); if (jj >= 0) selectSection(jj); }
        else selectSection(j);
        return;
      }
    }
  }
  if (ph.sel.pt >= 0) { ph.sel.pt = -1; renderHud(); drawOverlay(); return; }
  const s = curSec();
  if (ph.wizard?.step === "outline" && s && s.closed && !ph.hintedAdd) { ph.hintedAdd = true; toast("To outline another piece of this wall, press Add section.", { a: "addsec", label: "Add section" }); }
}

function solveGuides() {
  const a = curArea(), ph = S.photo;
  const r = G.solveFromLines(ph.width, ph.height, ph.f, a.guides, a.phi);
  if (r) {
    a.theta = r.theta; a.phi = r.phi; a.angleSet = true;
    const t = $("#s_w_theta"), f = $("#s_w_phi");
    if (t) { t.value = Math.round(a.theta / G.D2R); $("#o_w_theta").textContent = thetaText(+t.value); }
    if (f) { f.value = Math.round(a.phi / G.D2R); $("#o_w_phi").textContent = phiText(+f.value); }
  }
}

function zoomBy(k) {
  let c = [stage.clientWidth / 2, stage.clientHeight / 2];
  const ph = S.photo, s = curSec();
  if (ph?.wizard && s && ph.sel.pt >= 0 && s.pts[ph.sel.pt]) c = imgToCss(...s.pts[ph.sel.pt]);
  else if (ph?.wizard && s && !s.closed && s.pts.length) c = imgToCss(...s.pts[s.pts.length - 1]);
  zoomAt(c, { ...engine.view }, k);
}

let nudgeT = 0;
function nudge(key, stepPx) {
  const ph = S.photo, s = curSec(); if (!s || ph.sel.pt < 0) return;
  const now = performance.now(); if (now - nudgeT > 700) pushHist(); nudgeT = now;
  const k = 1 / dispScale();
  const q = s.pts[ph.sel.pt];
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  s.pts[ph.sel.pt] = [clamp(q[0] + d[0] * stepPx * k, 0, ph.width), clamp(q[1] + d[1] * stepPx * k, 0, ph.height)];
  liveGeometry(s.closed);
  clearTimeout(nudge.t); nudge.t = setTimeout(() => geometryChanged(true), 400);
}

// ------------------------------------------------------------------ own photo: painting (with undo)
function brushImgR() { return S.photo.brush / dispScale(); }
function strokePath(op, pts) {
  const ph = S.photo;
  const draw = (cv, erase) => {
    const c = cv.getContext("2d");
    c.globalCompositeOperation = erase ? "destination-out" : "source-over";
    c.strokeStyle = "#fff"; c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = op.r * 2;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 1) c.lineTo(pts[0][0] + 0.01, pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    c.globalCompositeOperation = "source-over";
  };
  if (op.t === "front") draw(ph.occ, false);
  else if (op.t === "open") draw(ph.open, false);
  else if (op.t === "erase") { draw(ph.occ, true); draw(ph.open, true); }
}
function paintStart(x, y) {
  const ph = S.photo;
  const op = { t: ph.tool, r: brushImgR(), pts: [[x, y]] };
  ph.paintOps.push(op);
  strokePath(op, op.pts); paintPreview();
}
function paintMove(x, y) {
  const ph = S.photo; const op = ph.paintOps[ph.paintOps.length - 1]; if (!op || !op.pts) return;
  const last = op.pts[op.pts.length - 1];
  op.pts.push([x, y]); strokePath(op, [last, [x, y]]); paintPreview();
}
function paintEnd() { const ph = S.photo; ph.paintVer++; rebuildMasks(true); geometryChanged(false); }
function replayPaint() {
  const ph = S.photo;
  ph.occ.getContext("2d").clearRect(0, 0, ph.width, ph.height);
  ph.open.getContext("2d").clearRect(0, 0, ph.width, ph.height);
  for (const op of ph.paintOps) {
    if (op.t === "magic") P.drawMagic(op.c, ph.width, ph.height, ph.occ);
    else if (op.t === "magicopen") P.drawMagic(op.c, ph.width, ph.height, ph.open);
    else if (op.pts && op.pts.length) strokePath(op, op.pts);
  }
  ph.paintVer++;
  paintPreview();
}
let pv = null;
function paintPreview() {
  if (!pv) { pv = document.createElement("canvas"); pv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.55"; stage.insertBefore(pv, overlay); }
  const ph = S.photo; if (!ph || !ph.wizard || ph.wizard.step !== "front" || S.roomId !== "photo") { pv.hidden = true; return; }
  pv.hidden = false;
  pv.width = stage.clientWidth; pv.height = stage.clientHeight;
  const c = pv.getContext("2d");
  const [x0, y0] = imgToCss(0, 0), [x1, y1] = imgToCss(ph.width, ph.height);
  const tmp = document.createElement("canvas"); tmp.width = pv.width; tmp.height = pv.height;
  const t = tmp.getContext("2d");
  c.clearRect(0, 0, pv.width, pv.height);
  for (const [src, col] of [[ph.occ, "#e2763d"], [ph.open, "#5aa0d8"]]) {
    t.clearRect(0, 0, tmp.width, tmp.height);
    t.globalCompositeOperation = "source-over"; t.drawImage(src, x0, y0, x1 - x0, y1 - y0);
    t.globalCompositeOperation = "source-in"; t.fillStyle = col; t.fillRect(0, 0, tmp.width, tmp.height);
    c.drawImage(tmp, 0, 0);
  }
}
let brushEl = null;
function drawBrush(p) {
  if (!brushEl) { brushEl = document.createElement("div"); brushEl.style.cssText = "position:absolute;border:2px solid #fff;border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.4);transform:translate(-50%,-50%)"; stage.appendChild(brushEl); }
  const ph = S.photo; const show = !!p && ph?.wizard?.step === "front" && ph.tool !== "magic" && S.roomId === "photo";
  brushEl.hidden = !show; if (!show) return;
  const d = ph.brush * 2; brushEl.style.width = d + "px"; brushEl.style.height = d + "px"; brushEl.style.left = p[0] + "px"; brushEl.style.top = p[1] + "px";
}

// ------------------------------------------------------------------ own photo: magnifier
let loupeEl = null;
function showLoupe(p, q) {
  const ph = S.photo; if (!ph || !q) return;
  if (ph.lastKind !== "touch") return;      // only for fingers, which cover the spot being placed
  if (!loupeEl) { loupeEl = document.createElement("canvas"); loupeEl.className = "loupe"; loupeEl.setAttribute("aria-hidden", "true"); stage.appendChild(loupeEl); }
  const size = S.mode === "kiosk" ? 156 : 128, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (loupeEl.width !== Math.round(size * dpr)) { loupeEl.width = loupeEl.height = Math.round(size * dpr); loupeEl.style.width = loupeEl.style.height = size + "px"; }
  loupeEl.hidden = false;
  const disp = dispScale();
  const z = Math.max(disp * 1.8, Math.min(disp * 3.5, 4));     // CSS px per photo px inside the magnifier
  const half = size / 2 / z;
  const x = loupeEl.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, size, size);
  x.save();
  x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); x.clip();
  x.fillStyle = "#0b0d0d"; x.fillRect(0, 0, size, size);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  const sx = q[0] - half, sy = q[1] - half, sw = half * 2;
  const cx0 = Math.max(0, sx), cy0 = Math.max(0, sy), cx1 = Math.min(ph.width, sx + sw), cy1 = Math.min(ph.height, sy + sw);
  if (cx1 > cx0 && cy1 > cy0) x.drawImage(ph.canvas, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - sx) * z, (cy0 - sy) * z, (cx1 - cx0) * z, (cy1 - cy0) * z);
  const L = (v) => [(v[0] - q[0]) * z + size / 2, (v[1] - q[1]) * z + size / 2];
  const a = curArea();
  if (a) a.sections.forEach((s) => {
    if (s.pts.length < 2) return;
    x.beginPath(); s.pts.forEach((v, i) => { const c = L(v); i ? x.lineTo(c[0], c[1]) : x.moveTo(c[0], c[1]); }); if (s.closed) x.closePath();
    x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = 3; x.stroke(); x.strokeStyle = "#f4f2ec"; x.lineWidth = 1.2; x.stroke();
  });
  const s = curSec();
  if (wd && wd.kind === "place" && s && !s.closed && s.pts.length) {
    const c0 = L(s.pts[s.pts.length - 1]);
    x.beginPath(); x.moveTo(c0[0], c0[1]); x.lineTo(size / 2, size / 2); x.setLineDash([4, 3]); x.strokeStyle = "#f4f2ec"; x.lineWidth = 1.2; x.stroke(); x.setLineDash([]);
  }
  x.strokeStyle = "#e2763d"; x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(size / 2 - 14, size / 2); x.lineTo(size / 2 - 4, size / 2); x.moveTo(size / 2 + 4, size / 2); x.lineTo(size / 2 + 14, size / 2);
  x.moveTo(size / 2, size / 2 - 14); x.lineTo(size / 2, size / 2 - 4); x.moveTo(size / 2, size / 2 + 4); x.lineTo(size / 2, size / 2 + 14);
  x.stroke();
  x.restore();
  const gap = 34;
  let top = p[1] - size - gap;
  if (top < 4) top = p[1] + gap;
  loupeEl.style.left = clamp(p[0] - size / 2, 4, stage.clientWidth - size - 4) + "px";
  loupeEl.style.top = clamp(top, 4, stage.clientHeight - size - 4) + "px";
}
function hideLoupe() { if (loupeEl) loupeEl.hidden = true; }

// ------------------------------------------------------------------ own photo: toolbar on the picture
function renderHud() {
  let el = $("#hud");
  const ph = S.photo;
  const on = !!(ph && ph.wizard && S.roomId === "photo" && !S.attract);
  if (!on) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement("div"); el.id = "hud"; el.className = "hud"; el.setAttribute("role", "toolbar"); el.setAttribute("aria-label", "Outline tools"); stage.appendChild(el); }
  el.hidden = false;
  const st = ph.wizard.step, s = curSec(), a = curArea();
  const b = (act, icon, label, o = {}) => `<button class="hb${o.primary ? " primary" : ""}" data-a="${act}"${o.disabled ? " disabled" : ""} data-tip="${esc(o.title || label)}" aria-label="${esc(label)}">${icon}<span>${label}</span></button>`;
  el.classList.toggle("top", st === "auto");          // the helper's bar sits up top: the hearth is usually at the bottom
  if (st === "auto" && ph.auto) {
    // just a note of what's happening, or of what a tap does now: the buttons are in the panel
    const A = ph.auto;
    const msg = A.busy ? "Finding the edges…" : A.state === "loading" ? "Looking at your photo…" : A.state === "tapwall" ? "Tap the wall that gets stone"
      : A.state === "fix" ? { add: "Tap where stone should go", remove: "Tap where stone shouldn't go", front: "Tap what stays in front" }[A.mode] : "";
    if (!msg) { el.hidden = true; return; }
    const ic = A.busy || A.state === "loading" ? `<i class="spin"></i>` : A.state === "fix" ? `<i class="fm ${A.mode}">${ICON[{ add: "plus", remove: "minus", front: "front" }[A.mode]]}</i>` : "";
    el.innerHTML = `<span class="hmsg" role="status">${ic}${msg}</span>`;
    return;
  }
  let h = b("undo", ICON.undo, "Undo", { disabled: !ph.hist.undo.length, title: "Undo (Ctrl+Z)" }) + b("redo", ICON.redo, "Redo", { disabled: !ph.hist.redo.length, title: "Redo (Ctrl+Shift+Z)" });
  h += `<i class="sep"></i>`;
  if (st === "outline" && s) {
    const draw = ph.outlineMode === "draw";
    h += `<span class="hseg" role="group" aria-label="How to outline"><button class="hb" data-a="wmode" data-v="tap" aria-pressed="${!draw}" data-tip="Tap the corners" aria-label="Tap the corners">${ICON.points}<span>Points</span></button><button class="hb" data-a="wmode" data-v="draw" aria-pressed="${draw}" data-tip="Draw around it" aria-label="Draw around it">${ICON.scribble}<span>Draw</span></button></span><i class="sep"></i>`;
    const newEmpty = ph.wizard.isNew && !closedSecs(a).length && !s.pts.length;
    if (ph.sel.pt >= 0) h += b("delpt", ICON.trash, "Delete point", { title: "Delete point (Delete key)" });
    if (newEmpty) h += b("cancelarea", ICON.x, "Cancel new area");
    else if (!s.closed && draw && !s.pts.length) {
      if (closedSecs(a).length) h += b("wnext", ICON.next, "Next", { primary: true });
    } else if (!s.closed) {
      if (s.pts.length) h += b("delsec", ICON.x, "Cancel section");
      h += b("finishsec", ICON.check, "Finish section", { primary: true, disabled: s.pts.length < 3, title: "Finish section (Enter)" });
    } else {
      if (ph.sel.pt < 0) h += b("delsec", ICON.trash, "Delete section");
      if (!draw) h += b("addsec", ICON.plus, "Add section");
      h += b("wnext", ICON.next, "Next", { primary: true });
    }
  } else {
    h += b("wnext", ICON.next, st === "light" ? "Done" : "Next", { primary: true });
  }
  el.innerHTML = h;
}

// ------------------------------------------------------------------ own photo: outline drawing on the picture
function wizardSVG() {
  const ph = S.photo, a = curArea(); if (!a) return "";
  const st = ph.wizard.step, R = hsize(ph.lastKind).r;
  if (st === "auto") return ph.auto ? autoSVG() : "";
  const P2 = (q) => imgToCss(q[0], q[1]);
  const path = (pts, closed) => pts.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ") + (closed ? " Z" : "");
  const ring = (c, r, col, dash = "") => `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="${col}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  let out = "";
  // other areas: faint dashed outlines (tap one to switch to it)
  ph.areas.forEach((o, k) => {
    if (k === ph.cur) return;
    o.sections.forEach((s) => {
      if (s.pts.length < 2) return;
      const d = path(s.pts.map(P2), s.closed);
      out += `<path d="${d}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3"/><path d="${d}" fill="none" stroke="rgba(244,242,236,.8)" stroke-width="1.25" stroke-dasharray="5 4"/>`;
    });
  });
  a.sections.forEach((s, j) => {
    if (!s.pts.length) return;
    const isSel = j === ph.sel.sec;
    const pts = s.pts.map(P2);
    const d = path(pts, s.closed);
    const fill = st === "outline" && s.closed ? (isSel ? "rgba(125,187,163,.14)" : "rgba(244,242,236,.06)") : "none";
    out += `<path d="${d}" fill="${fill}" stroke="rgba(0,0,0,.55)" stroke-width="3.2" stroke-linejoin="round"/>`;
    out += `<path d="${d}" fill="none" stroke="${isSel ? "#f4f2ec" : "rgba(244,242,236,.8)"}" stroke-width="1.4" stroke-linejoin="round"/>`;
    s.cf.forEach((on, i) => {
      if (!on || (!s.closed && i >= pts.length - 1)) return;
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      out += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#e2763d" stroke-width="4" stroke-dasharray="9 5" stroke-linecap="round"/>`;
    });
  });
  if ((st === "angle" || st === "size") && a.map) {
    const secs = closedSecs(a);
    // guide lines run with the stone (leveled with Level the stone, if it was)
    const Hf = G.inv3(a.map.Htex || a.map.Hpix);
    const allW = (a.map.texSecs || a.map.wallSecs).flat();
    const u0 = Math.min(...allW.map((w) => w[0])), v0 = Math.min(...allW.map((w) => w[1]));
    const u1 = Math.max(...allW.map((w) => w[0])), v1 = Math.max(...allW.map((w) => w[1]));
    const step = st === "angle" ? Math.max(6, Math.round((v1 - v0) / 10 / 6) * 6) : 12;
    const clipId = "cp" + a.id;
    out += `<clipPath id="${clipId}">${secs.map((s) => `<polygon points="${s.pts.map((q) => P2(q).join(",")).join(" ")}"/>`).join("")}</clipPath><g clip-path="url(#${clipId})" stroke="rgba(244,242,236,.75)" stroke-width="1">`;
    const Lw = (p1, p2) => { const a1 = G.applyH(Hf, p1[0], p1[1]), b1 = G.applyH(Hf, p2[0], p2[1]); const c1 = P2(a1), c2 = P2(b1); return `<line x1="${c1[0]}" y1="${c1[1]}" x2="${c2[0]}" y2="${c2[1]}"/>`; };
    for (let v = Math.floor(v0 / step) * step; v <= v1 + 0.01; v += step) out += Lw([u0 - 2, v], [u1 + 2, v]);
    if (st === "size") for (let u = Math.floor(u0 / step) * step; u <= u1 + 0.01; u += step) out += Lw([u, v0 - 2], [u, v1 + 2]);
    out += "</g>";
  }
  if (st === "outline" && wd && wd.kind === "draw" && wd.css.length > 1) {
    const d = wd.css.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
    out += `<path d="${d} Z" fill="rgba(134,196,171,.16)" stroke="none"/><path d="${d}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#86c4ab" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const c0 = wd.css[0];
    out += `<circle cx="${c0[0]}" cy="${c0[1]}" r="5" fill="#86c4ab" stroke="#111" stroke-width="1.5"/>`;
  }
  if (st === "outline") {
    const s = curSec();
    const placing = wd && wd.kind === "place" && wd.mode === "precise";
    if (s && !s.closed && s.pts.length) {     // rubber band to where the next point will go
      const last = P2(s.pts[s.pts.length - 1]);
      const tq = placing ? wd.q : ph.hover;
      if (tq) {
        const t = P2(tq);
        out += `<line x1="${last[0]}" y1="${last[1]}" x2="${t[0]}" y2="${t[1]}" stroke="#f4f2ec" stroke-width="1.4" stroke-dasharray="5 4"/>`;
        if (s.pts.length >= 2) { const f = P2(s.pts[0]); out += `<line x1="${t[0]}" y1="${t[1]}" x2="${f[0]}" y2="${f[1]}" stroke="rgba(244,242,236,.45)" stroke-width="1" stroke-dasharray="3 4"/>`; }
      }
    }
    if (s && s.closed) s.pts.forEach((q, i) => {      // midpoint handles: drag (or tap) to add a corner
      const c1 = P2(q), c2 = P2(s.pts[(i + 1) % s.pts.length]);
      if (Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) < 28) return;
      const m = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
      out += `<circle cx="${m[0]}" cy="${m[1]}" r="${R - 0.5}" fill="rgba(244,242,236,.4)" stroke="rgba(0,0,0,.65)" stroke-width="1"/><path d="M${m[0] - 2.2},${m[1]}h4.4M${m[0]},${m[1] - 2.2}v4.4" stroke="#111" stroke-width="1.2"/>`;
    });
    a.sections.forEach((sec, j) => sec.pts.forEach((q, i) => {
      const c = P2(q), isSel = j === ph.sel.sec;
      const selected = isSel && i === ph.sel.pt;
      const first = isSel && !sec.closed && i === 0;
      if (selected) out += ring(c, R + 5, "#86c4ab");
      if (first && sec.pts.length >= 3) out += ring(c, R + 5, "#e2763d", "3 3");
      const fill = selected ? "#86c4ab" : first ? "#e2763d" : isSel ? "#f4f2ec" : "rgba(244,242,236,.8)";
      out += `<circle cx="${c[0]}" cy="${c[1]}" r="${isSel ? R : R - 1}" fill="${fill}" stroke="#111" stroke-width="1.5"/>`;
    }));
    if (placing) {
      const c = P2(wd.q);
      out += `<circle cx="${c[0]}" cy="${c[1]}" r="${R}" fill="#f4f2ec" stroke="#111" stroke-width="1.5"/>`;
      if (wd.snap?.hit) out += ring(c, R + 6, "#e2763d");
    } else if (ph.hover && ph.hoverSnap?.hit && s && !s.closed) out += ring(P2(ph.hover), R + 6, "#e2763d");
    if (wd && wd.kind === "vtx" && wd.snap?.hit) { const q = a.sections[wd.sec]?.pts[wd.i]; if (q) out += ring(P2(q), R + 6, "#e2763d"); }
  }
  if (st === "angle") a.guides.forEach((g) => {
    const p1 = P2(g[0]), p2 = P2(g[1]);
    out += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="rgba(0,0,0,.5)" stroke-width="5"/><line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#e2763d" stroke-width="2.5"/>`;
    [p1, p2].forEach((q) => (out += `<circle cx="${q[0]}" cy="${q[1]}" r="${R + 1.5}" fill="#e2763d" stroke="#111" stroke-width="1.5"/>`));
  });
  if (st === "size" && a.measure && a.map) {
    const p1 = P2(a.measure.a), p2 = P2(a.measure.b);
    const m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const ft = Math.floor(a.measure.inches / 12), inch = Math.round((a.measure.inches - ft * 12) * 10) / 10;
    out += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#111" stroke-width="6" stroke-linecap="round"/><line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#f4f2ec" stroke-width="3" stroke-linecap="round"/>`;
    [p1, p2].forEach((q) => (out += `<circle cx="${q[0]}" cy="${q[1]}" r="${R + 1.5}" fill="#f4f2ec" stroke="#111" stroke-width="1.5"/>`));
    out += `<g transform="translate(${m[0] + 14},${m[1]})"><rect x="0" y="-15" rx="6" width="${ft ? 74 : 56}" height="30" fill="rgba(10,12,12,.8)"/><text x="10" y="5" fill="#f4f2ec" font-family="IBM Plex Mono, monospace" font-size="14">${ft ? `${ft}′ ` : ""}${inch}″</text></g>`;
  }
  return out;
}

// ------------------------------------------------------------------ area card: tap a finished area to see and change it
let cardFor = null;      // {gid, at:[x,y]}
const STOVE_CARD = "@stove";   // cardFor.gid for the stove's card (stoveCardHTML); no area has it
function openCard(gid, p) {
  // adjusting Size & angle and tapping another area: carry on adjusting that one
  const fa = cardFor?.view === "fit" ? S.photo?.areas.find((a) => a.id === gid) : null;
  cardFor = fa ? { gid, at: p, view: "fit", fitStart: fitSnap(fa) } : { gid, at: p }; renderCard();
  const el = $("#acard");   // on phones the card sits under the picture: make sure it's on screen
  if (el && el.classList.contains("under") && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function closeCard() { cardFor = null; const el = $("#acard"); if (el) el.hidden = true; }
function renderCard() {
  let el = $("#acard");
  const r = S.room;
  if (!cardFor || !r || S.attract || S.photo?.wizard && S.roomId === "photo") { if (el) el.hidden = true; return; }
  const stove = cardFor.gid === STOVE_CARD ? stoveCardHTML() : "";
  const g = stove ? null : r.groups.find((x) => x.id === cardFor.gid);
  if (!stove && !g) { closeCard(); return; }
  if (!el) { el = document.createElement("div"); el.id = "acard"; el.className = "acard"; el.setAttribute("role", "dialog"); stage.appendChild(el); bindCardDrag(el); }
  if (stove) { el.innerHTML = stove; el.hidden = false; el.classList.remove("fit"); placeCard(el); return; }
  const d = currentDesign()[g.id] || { mode: "off" };
  const st = S.cat.get(d.stone);
  const photo = r.kind === "photo";
  const area = photo ? S.photo.areas.find((x) => x.id === g.id) : null;
  const k = photo ? S.photo.areas.indexOf(area) : -1;
  let size = "";
  if (photo && area?.map) size = `${fmt(area.areaSqft, 0)} sq ft${sizeIsGuess(area) ? " (size not measured)" : ""} · ${closedSecs(area).length} section${closedSecs(area).length === 1 ? "" : "s"}`;
  else if (!photo) { const zs = g.zones.map((z) => r.zones.find((x) => x.id === z)).filter(Boolean); size = `${fmt(zs.reduce((t, z) => t + z.area_sqft, 0), 0)} sq ft`; }
  const paint = d.mode === "paint" ? paintOf(d) : null;
  const what = d.mode === "stone" ? esc(st?.name || "") : paint ? `Painted · ${esc(paintName(d))}` : "Left as it is";
  const meta = d.mode === "stone" ? `${JOINTS[d.joint || "standard"].label}${d.joint === "dry" ? "" : " · " + esc(MORTARS.find((m) => m.id === d.mortar)?.label || "") + " mortar"}` : paint?.code ? esc(paint.code) : "";
  el.innerHTML = cardFor.view === "fit" && area ? fitCardHTML(g, area) : g.kind === "pad" ? `<div class="agrip" data-tip="Drag to move this box" aria-hidden="true"></div><div class="ahd">
      <i class="atile" style="background:${padOf(d).hex}"></i>
      <div class="at"><div class="k">${esc(g.label)}</div><div class="v">${esc(padOf(d).label)}</div><div class="m plain">${esc(g.hint || "")}</div></div>
      <button class="hb" data-a="closecard" aria-label="Close">${ICON.x}</button></div>
    ${padChoices(g.id, d, "padpick")}` : `<div class="agrip" data-tip="Drag to move this box" aria-hidden="true"></div><div class="ahd">
      ${d.mode === "stone" && st ? `<img src="assets/stone/${st.id}/thumb.jpg" alt="">` : paint ? `<i class="atile" style="background:${paint.hex}"></i>` : ""}
      <div class="at"><div class="k">${esc(g.label)}</div><div class="v">${what}</div><div class="m">${[meta, size, d.link ? `same as ${esc((r.groups.find((x) => x.id === d.link.to)?.label || "").toLowerCase())}` : ""].filter(Boolean).join(" · ")}</div></div>
      <button class="hb" data-a="closecard" aria-label="Close">${ICON.x}</button></div>
    <div class="aseg" role="group" aria-label="What goes on ${esc(g.label)}">
      <button data-a="cardmode" data-v="stone" aria-pressed="${d.mode === "stone"}">Stone</button>
      <button data-a="cardmode" data-v="paint" aria-pressed="${d.mode === "paint"}">Paint</button>
      <button data-a="cardmode" data-v="off" aria-pressed="${d.mode === "off"}">As is</button></div>
    ${matchRow(g, d)}
    ${paint ? `<div class="aswatch" role="group" aria-label="Paint colors">${quickPaints().map(([k, c]) => swatchBtn(k, c, paint, "cardpaint")).join("")}</div>` : ""}
    <div class="aacts">
      ${paint ? `<button class="hb primary" data-a="cardpaintmore">${ICON.drop}<span>More colors${S.lookupFn && !S.lookupOff ? " &amp; paint names" : ""}</span></button>`
        : `<button class="hb primary" data-a="cardstone">${ICON.swatch}<span>${d.mode === "stone" ? "Change stone" : "Choose a stone"}</span></button>`}
      ${d.mode === "stone" ? `<button class="hb" data-a="cardfinish">${ICON.grid}<span>Joint &amp; mortar</span></button>` : ""}
      ${photo && d.mode === "stone" ? `<button class="hb" data-a="cardfit">${ICON.sizeangle}<span>Size &amp; angle</span></button>` : ""}
      ${photo ? `<button class="hb" data-a="editsurf" data-v="${g.id}">${ICON.pen}<span>Edit outline</span></button>
        <button class="hb" data-a="addsec" data-v="${k}">${ICON.plus}<span>Add section</span></button>
        <button class="hb danger" data-a="delsurf" data-v="${g.id}">${ICON.trash}<span>Delete</span></button>` : ""}
    </div>`;
  el.hidden = false;
  el.classList.toggle("fit", cardFor.view === "fit" && !!area);
  placeCard(el);
}
function placeCard(el) {
  // place it next to the tap, inside the picture. On phones it sits just under the picture so the
  // whole picture stays in view while colors and stones change; in a narrow window it docks to the bottom.
  const stacked = window.matchMedia("(max-width: 860px)").matches;
  const narrow = stage.clientWidth < 560 && !stacked;
  if (stacked) { if (el.previousElementSibling !== stage) stage.after(el); }
  else if (el.parentElement !== stage) stage.appendChild(el);
  el.classList.toggle("under", stacked);
  el.classList.toggle("docked", narrow && !cardSpot);
  el.classList.toggle("dtop", narrow && !cardSpot && cardFor?.gid === STOVE_CARD);   // a stove stands low in the picture: its card docks at the top
  if (stacked) { el.style.left = ""; el.style.top = ""; el.style.width = ""; return; }
  if (cardSpot) {                     // the customer moved it: keep it where they put it
    if (narrow) el.style.width = Math.min(360, stage.clientWidth - 24) + "px";
    const W = stage.clientWidth, H = stage.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = clamp(cardSpot.fx * (W - w), 8, Math.max(8, W - w - 8)) + "px";
    el.style.top = clamp(cardSpot.fy * (H - h), 8, Math.max(8, H - h - 8)) + "px";
    return;
  }
  el.style.width = "";
  if (!narrow) {
    const w = el.offsetWidth || 340, h = el.offsetHeight || 160;
    // chosen once per tap, so the card doesn't hop about as its contents change
    cardFor.spot ||= bestCardSpot(cardFor.gid, cardFor.at, w, h);
    const [left, top] = cardFor.spot;
    el.style.left = clamp(left, 12, stage.clientWidth - w - 12) + "px";
    el.style.top = clamp(top, 12, stage.clientHeight - h - 12) + "px";
  } else { el.style.left = ""; el.style.top = ""; }
}
/** Where the card hides the least of the area it's about: close to the tap, off the area itself,
 *  and off the picture's own buttons where it can be. */
function bestCardSpot(gid, at, w, h) {
  const W = stage.clientWidth, H = stage.clientHeight, m = 12;
  let fl = at[0] + 18; if (fl + w > W - m) fl = at[0] - w - 18;
  const fallback = [fl, at[1] - h / 2];
  const cov = areaCover(gid);
  if (!cov || !cov.total || W < w + 2 * m || H < h + 2 * m) return fallback;
  const sr = stage.getBoundingClientRect();
  const ui = [...stage.querySelectorAll(".stage-tools, .chips, .cap, .hud")].filter((e) => !e.hidden && e.offsetWidth)
    .map((e) => { const b = e.getBoundingClientRect(); return [b.left - sr.left, b.top - sr.top, b.right - sr.left, b.bottom - sr.top]; });
  const toMap = (x, y) => { const [cx, cy] = cssToCanvas(x, y); const [u, v] = engine.toUV(cx, cy); return [clamp(Math.round(u * cov.w), 0, cov.w), clamp(Math.round(v * cov.h), 0, cov.h)]; };
  const row = cov.w + 1;
  const hidden = (l, t) => {
    const [x0, y0] = toMap(l, t), [x1, y1] = toMap(l + w, t + h);
    return cov.sat[y1 * row + x1] - cov.sat[y0 * row + x1] - cov.sat[y1 * row + x0] + cov.sat[y0 * row + x0];
  };
  const onUi = (l, t) => ui.reduce((a, [x0, y0, x1, y1]) => a + Math.max(0, Math.min(l + w, x1) - Math.max(l, x0)) * Math.max(0, Math.min(t + h, y1) - Math.max(t, y0)), 0);
  const steps = (lo, hi) => { const out = []; for (let v = lo; v < hi; v += 16) out.push(v); out.push(hi); return out; };
  const reach = Math.hypot(W, H);
  let best = fallback, bs = Infinity;
  for (const t of steps(m, H - h - m)) for (const l of steps(m, W - w - m)) {
    const dx = Math.max(l - at[0], 0, at[0] - l - w), dy = Math.max(t - at[1], 0, at[1] - t - h);
    const score = hidden(l, t) / cov.total * 1000 + onUi(l, t) / (w * h) * 300 + Math.hypot(dx, dy) / reach * 90;
    if (score < bs) { bs = score; best = [l, t]; }
  }
  return best;
}
/** The area's pixels on a small map of the picture, summed so any box can be counted at once. */
function areaCover(gid) {
  const r = S.room; if (!r) return null;
  let w, h, on;
  if (gid === STOVE_CARD) {   // the stove's outline, so its card keeps off the stove (not kept: it moves and resizes)
    w = 192; h = Math.max(1, Math.round(192 * r.height / r.width));
    on = (i) => { const u = (i % w + 0.5) / w, v = (Math.floor(i / w) + 0.5) / h; return stoveAtUV(u, v) || sampleStoveAtUV(u, v); };
  } else if (r.kind === "photo") {
    const area = S.photo?.areas.find((a) => a.id === gid); if (!area) return null;
    w = 300; h = Math.max(1, Math.round(300 * r.height / r.width));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.scale(w / r.width, h / r.height); ctx.fillStyle = "#fff";
    for (const s of closedSecs(area)) { ctx.beginPath(); s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); }
    const d = ctx.getImageData(0, 0, w, h).data;
    on = (i) => d[i * 4 + 3] > 127;
  } else {
    if (r.cover?.[gid]) return r.cover[gid];
    const pk = r.pick, g = r.groups.find((x) => x.id === gid); if (!pk || !g) return null;
    w = pk.w; h = pk.h;
    const zs = r.zones.filter((z) => z.mask && g.zones.includes(z.id));
    on = (i) => zs.some((z) => pk.datas[z.mask[0]]?.[i * 4 + z.mask[1]] > 60);
  }
  const sat = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) { run += on(y * w + x) ? 1 : 0; sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + run; }
  }
  const out = { w, h, sat, total: sat[sat.length - 1] };
  if (r.kind !== "photo" && gid !== STOVE_CARD) (r.cover ||= {})[gid] = out;
  return out;
}
/** Drag the card by its top (the grip or the title) to move it off the part of the picture you're
 *  looking at. It stays where it was put, for other areas too, until the room changes. */
let cardSpot = null;
function bindCardDrag(el) {
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    if (el.classList.contains("under") || !e.target.closest(".agrip, .ahd") || e.target.closest("button")) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    if (el.classList.contains("docked")) { el.style.width = r.width + "px"; el.classList.remove("docked"); }
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.classList.add("dragging");
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const sr = stage.getBoundingClientRect(), W = stage.clientWidth, H = stage.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    const left = clamp(e.clientX - sr.left - drag.dx, 8, Math.max(8, W - w - 8)), top = clamp(e.clientY - sr.top - drag.dy, 8, Math.max(8, H - h - 8));
    el.style.left = left + "px"; el.style.top = top + "px";
    cardSpot = { fx: W > w ? left / (W - w) : 0, fy: H > h ? top / (H - h) : 0 };
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; el.classList.remove("dragging"); } };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
/** "Same as": one tap makes this area follow another area's stone (or paint), e.g. the hearth in
 *  front of the stove following the chimney behind it. Tap the same button again to let go. */
function matchRow(g, d) {
  const all = currentDesign();
  const outlined = (id) => S.room.kind !== "photo" || !!S.photo?.areas.find((a) => a.id === id)?.map;
  const others = S.room.groups.filter((x) => x.id !== g.id && !x.kind && all[x.id] && all[x.id].mode !== "off" && outlined(x.id));
  if (!others.length) return "";
  return `<div class="amatch" role="group" aria-label="Make ${esc(g.label)} the same as another area"><span class="k">Same as</span>
    ${others.map((o) => {
      const od = all[o.id], same = d.link?.to === o.id;
      const pic = od.mode === "stone" ? `<img src="assets/stone/${od.stone}/thumb.jpg" alt="">` : `<i style="background:${paintOf(od).hex}"></i>`;
      const what = od.mode === "stone" ? S.cat.get(od.stone)?.name || "" : paintName(od);
      return `<button class="mchip" data-a="cardmatch" data-v="${o.id}" aria-pressed="${same}" data-tip="${esc(`${o.label}: ${what}`)}" data-tip-always>${pic}<span>${esc(o.label)}</span>${same ? ICON.check : ""}</button>`;
    }).join("")}</div>`;
}
// ------------------------------------------------------------------ own photo: stone size & angle
// Right on the area's card: make the stones bigger or smaller and turn them to match the wall in the
// photo, watching the picture. Size changes the wall's real size too (so the estimate follows);
// Measure something gives exact numbers.
const turnText = (v) => (Math.abs(v) < 1 ? "straight on" : `${Math.abs(v)}°, ${v > 0 ? "right" : "left"} side farther`);
const FIT = [
  { k: "size", label: "Stone size", min: -160, max: 160, step: 1, nudge: 5, ends: ["smaller", "bigger"],
    get: (a) => Math.round(Math.log2(a.sizeK || 1) * 100), text: (v) => `${Math.round(2 ** (v / 100) * 100)}%` },
  { k: "turn", label: "Wall angle", min: -70, max: 70, step: 1, nudge: 1, ends: ["left side farther", "right side farther"],
    get: (a) => Math.round((a.theta || 0) / G.D2R), text: turnText },
  { k: "tilt", label: "Camera tilt", min: -30, max: 30, step: 1, nudge: 1, ends: ["looking down", "looking up"],
    get: (a) => Math.round((a.phi || 0) / G.D2R), text: phiText },
  { k: "level", label: "Level", min: -20, max: 20, step: 0.5, nudge: 0.5, ends: ["counterclockwise", "clockwise"],
    get: (a) => a.rot || 0, text: levelText },
];
const ftIn = (inch) => { const t = Math.max(0, Math.round(inch)), f = Math.floor(t / 12), i = t % 12; return f ? (i ? `${f} ft ${i} in` : `${f} ft`) : `${i} in`; };
/** How big the area works out at this size: the customer's check against what they know. */
function fitDims(a) {
  if (!a?.map) return "";
  const w = a.map.wallSecs.flat(), us = w.map((p) => p[0]), vs = w.map((p) => p[1]);
  return `About ${ftIn(Math.max(...vs) - Math.min(...vs))} tall and ${ftIn(Math.max(...us) - Math.min(...us))} wide · ${fmt(a.areaSqft, 0)} sq ft`;
}
const fitArea = () => (cardFor?.view === "fit" && S.photo ? S.photo.areas.find((a) => a.id === cardFor.gid) : null);
const fitSnap = (a) => JSON.parse(JSON.stringify({ theta: a.theta, phi: a.phi, rot: a.rot || 0, sizeK: a.sizeK || 1, measure: a.measure, angleSet: !!a.angleSet }));
function fitCardHTML(g, a) {
  return `<div class="agrip" data-tip="Drag to move this box" aria-hidden="true"></div><div class="ahd">
      <div class="at"><div class="k">${esc(g.label)}</div><div class="v">Stone size &amp; angle</div><div class="m plain" id="fitDims">${fitDims(a)}</div></div>
      <button class="hb" data-a="closecard" aria-label="Close">${ICON.x}</button></div>
    <div class="fits">${FIT.map((f) => { const v = f.get(a); return `<div class="fitrow">
        <div class="fl"><label for="fs_${f.k}">${f.label}</label><output id="fo_${f.k}">${f.text(v)}</output></div>
        <div class="fc"><button class="hb fstep" data-a="fitstep" data-v="${f.k}:-1" aria-label="${f.label}: ${f.ends[0]}">${ICON.minus}</button>
          <input type="range" id="fs_${f.k}" data-fit="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
          <button class="hb fstep" data-a="fitstep" data-v="${f.k}:1" aria-label="${f.label}: ${f.ends[1]}">${ICON.plus}</button></div>
        <div class="fe" aria-hidden="true"><span>${f.ends[0]}</span><span>${f.ends[1]}</span></div></div>`; }).join("")}</div>
    <p class="fnote">Watch the stone as you go: its rows should run with the straight lines in the room, like the mantel or the ceiling, and the stones should look the right size next to the stove.</p>
    <div class="aacts">
      <button class="hb primary" data-a="fitdone">${ICON.check}<span>Done</span></button>
      <button class="hb" data-a="fitreset">${ICON.reset}<span>Put it back</span></button>
      <button class="hb" data-a="fitmeasure">${ICON.ruler}<span>Measure something</span></button>
    </div>`;
}
/** Open Size & angle for an area (from the Stone, Finish or Areas tab, or the setup's last message). */
function openFit(id) {
  const ph = S.photo; if (!ph || S.roomId !== "photo") return;
  const areas = doneAreas(); if (!areas.length) return;
  const a = areas.find((x) => x.id === id) || areas.find((x) => x.id === S.target) || areas[0];
  const pts = closedSecs(a).flatMap((sec) => sec.pts), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const at = imgToCss((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  S.target = a.id; select(a.id);
  cardFor = { gid: a.id, at, view: "fit", fitStart: fitSnap(a) };
  renderCard(); renderRail({ keep: true }); renderQuick();
  revealStage();
  const el = $("#acard");
  if (el && el.classList.contains("under") && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function fitApply(a, k, v) {
  if (k === "size") a.sizeK = 2 ** (v / 100);
  else if (k === "turn") { a.theta = v * G.D2R; a.angleSet = true; }
  else if (k === "tilt") { a.phi = v * G.D2R; a.angleSet = true; }
  else if (k === "level") a.rot = v;
}
/** Bring the card's sliders and readouts up to date without redrawing it (a slider being dragged keeps going). */
function refreshFit(a) {
  for (const f of FIT) {
    const v = f.get(a), sl = $("#fs_" + f.k), o = $("#fo_" + f.k);
    if (sl && document.activeElement !== sl) sl.value = v;
    if (o) o.textContent = f.text(v);
  }
  const dEl = $("#fitDims"); if (dEl) dEl.textContent = fitDims(a);
}
let fitArmed = true;   // one undo step per slider drag
function fitInput(k, v) {
  const a = fitArea(); if (!a) return;
  if (fitArmed) { pushHist(); fitArmed = false; }
  fitApply(a, k, v);
  liveGeometry(false);
  refreshFit(a);
}
function fitCommit() {
  fitArmed = true;
  renderCaption();
  if (S.tab === "estimate" || S.tab === "areas") renderRail({ keep: true });
}
const cardActions = {
  closecard: () => closeCard(),
  cardmatch: async (v) => {
    const g = cardFor?.gid, all = currentDesign(), src = all[v];
    if (!g || !src || v === g) return;
    const d = (all[g] = all[g] || { mode: "off" });
    if (d.link?.to === v) {                         // tapped again: back to its own look
      const was = d.link.was; delete d.link;
      if (was) setFinish(d, was);
    } else {                                        // follow this area (its own lay of the stones stays)
      const was = d.link ? d.link.was : finishOf(d);
      if (src.link?.to === g) delete src.link;      // no going round in circles
      setFinish(d, finishOf(src));
      d.link = { to: v, was, sig: finishSig(src) };
    }
    if (d.mode === "stone") await ensureStone(d.stone);
    if (S.paintFor === g && d.mode !== "paint") S.paintFor = null;
    persist(); select(g); renderCard(); renderCaption(); renderQuick();
    if (["stone", "finish", "areas", "estimate"].includes(S.tab)) renderRail({ keep: true });
    invalidate(600);
  },
  cardstone: () => { const g = cardFor?.gid; if (!g) return; S.target = g; S.tab = "stone"; closeCard(); renderChrome(); renderRail(); renderQuick(); revealRail("#railBody .grid"); },
  cardstoves: () => { S.paintFor = null; S.tab = "stove"; closeCard(); renderChrome(); renderRail(); revealRail("#railBody .stoves"); },
  cardfit: () => {
    const a = S.photo?.areas.find((x) => x.id === cardFor?.gid); if (!a) return;
    Object.assign(cardFor, { view: "fit", spot: null, fitStart: fitSnap(a) });
    renderCard();
  },
  fitdone: () => { if (!cardFor) return; Object.assign(cardFor, { view: "main", spot: null }); renderCard(); },
  fitreset: () => {
    const a = fitArea(); if (!a || !cardFor.fitStart) return;
    pushHist();
    Object.assign(a, JSON.parse(JSON.stringify(cardFor.fitStart)));
    syncPhotoZones(); invalidate(); refreshFit(a); fitCommit();
    toast("Size and angle are back the way they were.", { a: "undo", label: "Undo" });
  },
  fitstep: (v) => {
    const a = fitArea(); const [k, dir] = String(v).split(":"); const f = FIT.find((x) => x.k === k);
    if (!a || !f) return;
    pushHist();
    fitApply(a, k, clamp(f.get(a) + (+dir) * f.nudge, f.min, f.max));
    liveGeometry(false); refreshFit(a); fitCommit();
  },
  fitmeasure: () => { const g = cardFor?.gid; if (g) editArea(g, "size"); },
  cardfinish: () => { const g = cardFor?.gid; if (!g) return; S.target = g; S.tab = "finish"; closeCard(); renderChrome(); renderRail(); revealRail("#railBody .options"); },
  cardmode: async (v) => {
    const g = cardFor?.gid; if (!g) return;
    const d = currentDesign(); d[g] = d[g] || {};
    d[g].mode = v;
    if (v === "stone" && !d[g].stone) Object.assign(d[g], { stone: firstStone(d), joint: "standard", mortar: "natural" });
    if (v === "paint" && !d[g].paint) d[g].paint = "warmwhite";
    if (v === "stone") await ensureStone(d[g].stone);
    if (v === "paint") { S.tab = "areas"; S.paintFor = g; renderChrome(); }   // the full color panel opens beside the picture
    persist(); renderCard(); renderCaption(); if (S.tab === "areas" || S.tab === "estimate") renderRail(); invalidate();
  },
  cardpaint: (v) => {
    const g = cardFor?.gid, c = paintFromKey(v); if (!g || !c) return;
    applyPaint(g, c);
    if (S.tab === "areas") renderRail({ keep: true });
  },
  cardpaintmore: () => {
    const g = cardFor?.gid; if (!g) return;
    S.tab = "areas"; S.paintFor = g; closeCard(); renderChrome(); renderRail(); revealRail("#railBody");
    if (!window.matchMedia("(max-width: 860px)").matches) $("#railBody").scrollTop = 0;
  },
};
/** On phones the picture sits above the panel: bring it back into view after finishing in the panel. */
function revealStage() {
  if (window.matchMedia("(max-width: 860px)").matches && stage.getBoundingClientRect().top < 0) stage.scrollIntoView({ behavior: "smooth", block: "start" });
}
/** On phones the panel sits under the picture: bring the part the customer asked for into view. */
function revealRail(sel) {
  const el = $(sel) || $("#railBody");
  if (!el) return;
  if (window.matchMedia("(max-width: 860px)").matches) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else { const body = $("#railBody"); body.scrollTop = Math.max(0, el.offsetTop - body.offsetTop - 8); }
}

boot();
