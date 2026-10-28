// Paint colors for walls that aren't getting stone: a palette of generic shades, a color
// mixer, and "type or say a paint color" (Claude works out the brand color), with voice
// input where the browser has it. Colors on a screen are always approximate; the UI says so.

// ------------------------------------------------------------------ palette (generic shades, not brand colors)
export const PAINT_FAMILIES = [
  { id: "white", label: "Whites & creams", items: [
    { id: "brightwhite", label: "Bright white", hex: "#f1f0eb" },
    { id: "warmwhite", label: "Warm white", hex: "#e6e1d6" },
    { id: "cream", label: "Cream", hex: "#ebe0c8" },
    { id: "linen", label: "Linen", hex: "#e0d6c3" },
  ] },
  { id: "neutral", label: "Beiges & greiges", items: [
    { id: "sand", label: "Sand", hex: "#d3c4a9" },
    { id: "greige", label: "Greige", hex: "#bcb2a2" },
    { id: "mushroom", label: "Mushroom", hex: "#a79b8a" },
    { id: "taupe", label: "Taupe", hex: "#8b7e71" },
  ] },
  { id: "gray", label: "Grays", items: [
    { id: "palegray", label: "Pale gray", hex: "#d5d6d2" },
    { id: "dove", label: "Dove gray", hex: "#b6b7b2" },
    { id: "slate", label: "Slate", hex: "#6e7674" },
    { id: "charcoal", label: "Charcoal", hex: "#47494a" },
  ] },
  { id: "green", label: "Greens", items: [
    { id: "eucalyptus", label: "Eucalyptus", hex: "#b4bea8" },
    { id: "sage", label: "Sage", hex: "#9da692" },
    { id: "olive", label: "Olive", hex: "#76745a" },
    { id: "pine", label: "Pine", hex: "#4f5e50" },
    { id: "forest", label: "Forest", hex: "#34443a" },
  ] },
  { id: "blue", label: "Blues", items: [
    { id: "mist", label: "Mist blue", hex: "#c2cbcf" },
    { id: "lake", label: "Lake blue", hex: "#7b8e98" },
    { id: "denim", label: "Denim", hex: "#58708a" },
    { id: "teal", label: "Deep teal", hex: "#3e6365" },
    { id: "navy", label: "Navy", hex: "#2f3a4c" },
  ] },
  { id: "warm", label: "Warm & earthy", items: [
    { id: "wheat", label: "Wheat", hex: "#d8c18f" },
    { id: "ochre", label: "Ochre", hex: "#bf994f" },
    { id: "clay", label: "Clay", hex: "#b8846a" },
    { id: "terracotta", label: "Terracotta", hex: "#a65d43" },
    { id: "rust", label: "Rust", hex: "#8c4b33" },
  ] },
  { id: "deep", label: "Deep & dramatic", items: [
    { id: "oxblood", label: "Oxblood", hex: "#5d2f2c" },
    { id: "espresso", label: "Espresso", hex: "#4a3c34" },
    { id: "softblack", label: "Soft black", hex: "#2b2b2a" },
  ] },
];
export const PAINTS = PAINT_FAMILIES.flatMap((f) => f.items);
export const PAINT_BY_ID = new Map(PAINTS.map((p) => [p.id, p]));
/** A short row for the area card on the picture. */
export const QUICK_PAINTS = ["warmwhite", "greige", "sage", "lake", "pine", "navy", "clay", "charcoal"];

// ------------------------------------------------------------------ color maths (sRGB <-> OKLCH)
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function normHex(s) {
  const m = String(s || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return "#" + h;
}
export function hexToRgb(hex) { const h = normHex(hex) || "#000000"; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }
export function rgbToHex(rgb) { return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join(""); }
function labToLin(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
function linToLab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363377535 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const lchLin = (L, C, h) => labToLin(L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180));
const inGamut = (v) => v[0] >= -1e-4 && v[0] <= 1.0001 && v[1] >= -1e-4 && v[1] <= 1.0001 && v[2] >= -1e-4 && v[2] <= 1.0001;
/** Richest chroma that stays on screen at this lightness and hue. */
export function maxChroma(L, h) {
  let lo = 0, hi = 0.37;
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (inGamut(lchLin(L, mid, h))) lo = mid; else hi = mid; }
  return lo;
}
export function lchToHex(L, C, h) {
  let lin = lchLin(L, C, h);
  if (!inGamut(lin)) lin = lchLin(L, Math.min(C, maxChroma(L, h)), h);
  return rgbToHex(lin.map((v) => toGam(Math.min(1, Math.max(0, v)))));
}
export function hexToLch(hex) {
  const [L, a, b] = linToLab(...hexToRgb(hex).map(toLin));
  const C = Math.hypot(a, b);
  let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360;
  return [L, C, h];
}
/** sRGB hex -> linear RGB, for the renderer. */
export function hexToLinear(hex) { return hexToRgb(hex).map(toLin); }

/** A plain description for a mixed color ("Light blue-gray"), so a saved custom color reads sensibly. */
export function describe(hex) {
  const [L, C, h] = hexToLch(hex);
  if (C < 0.009) return L > 0.93 ? "White" : L < 0.3 ? "Near black" : `${L > 0.8 ? "Light" : L > 0.55 ? "Mid" : "Dark"} gray`;
  const lw = L > 0.9 ? "Pale" : L > 0.78 ? "Light" : L > 0.6 ? "Mid" : L > 0.42 ? "Deep" : "Dark";
  let hue = h < 15 || h >= 345 ? "rose" : h < 45 ? "red" : h < 70 ? (L < 0.55 ? "brown" : "orange") : h < 95 ? (L < 0.55 ? "brown" : "gold") : h < 125 ? (L < 0.6 ? "olive" : "yellow") : h < 165 ? "green" : h < 215 ? "teal" : h < 275 ? "blue" : h < 315 ? "violet" : "plum";
  if (C < 0.045) hue = h >= 45 && h < 95 ? (L > 0.7 ? "beige" : "taupe") : h >= 95 && h < 125 ? "olive-gray" : `${hue}-gray`;
  return `${lw} ${hue}`;
}

// ------------------------------------------------------------------ color mixer (lightness x richness pad + hue)
const PAD_CMAX = 0.16;     // paint lives at the quiet end of what a screen can show
const PAD_L0 = 0.97, PAD_L1 = 0.22;
export function mixerHTML(id) {
  return `<div class="mixer" id="${id}">
    <div class="mx-pad" role="slider" tabindex="0" aria-label="Lighter or darker, quieter or richer"><canvas width="120" height="72"></canvas><i class="mx-dot"></i></div>
    <p class="note">Drag up for lighter, down for darker, right for a richer color. The strip changes the color itself.</p>
    <input class="mx-hue" type="range" min="0" max="359" step="1" aria-label="Color">
    <div class="mx-row"><label class="mx-hexl">Color code <input class="mx-hex" maxlength="7" spellcheck="false" autocomplete="off" placeholder="#a7bcc6" aria-label="Hex color code"></label>
      <span class="note">Paint websites list a code like #A7BCC6 for each color.</span></div>
  </div>`;
}
/** Wire a mixer: onInput(hex) while dragging, onCommit(hex) when the finger lifts or a code is typed. */
export function bindMixer(root, startHex, { onInput, onCommit }) {
  if (!root) return null;
  const pad = root.querySelector(".mx-pad"), cv = pad.querySelector("canvas"), dot = pad.querySelector(".mx-dot");
  const hueEl = root.querySelector(".mx-hue"), hexEl = root.querySelector(".mx-hex");
  let [L, C, h] = hexToLch(startHex || "#e6e1d6");
  let x = 0.5, y = 0.5;
  const cmax = (Lv, hv) => Math.min(PAD_CMAX, maxChroma(Lv, hv));
  const fromLch = () => { y = Math.min(1, Math.max(0, (PAD_L0 - L) / (PAD_L0 - PAD_L1))); const m = cmax(L, h); x = m > 1e-4 ? Math.min(1, C / m) : 0; };
  const toHex = () => { const Lv = PAD_L0 - y * (PAD_L0 - PAD_L1); return lchToHex(Lv, x * cmax(Lv, h), h); };
  const drawPad = () => {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      const Lv = PAD_L0 - (j / (H - 1)) * (PAD_L0 - PAD_L1), m = cmax(Lv, h);
      for (let i = 0; i < W; i++) {
        const lin = lchLin(Lv, (i / (W - 1)) * m, h), o = (j * W + i) * 4;
        img.data[o] = Math.round(toGam(Math.min(1, Math.max(0, lin[0]))) * 255);
        img.data[o + 1] = Math.round(toGam(Math.min(1, Math.max(0, lin[1]))) * 255);
        img.data[o + 2] = Math.round(toGam(Math.min(1, Math.max(0, lin[2]))) * 255);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const stops = []; for (let k = 0; k <= 12; k++) stops.push(lchToHex(0.72, 0.11, k * 30));
    hueEl.style.setProperty("--hue-track", `linear-gradient(90deg, ${stops.join(", ")})`);
  };
  const place = () => {
    dot.style.left = x * 100 + "%"; dot.style.top = y * 100 + "%";
    const hx = toHex(); dot.style.background = hx;
    pad.setAttribute("aria-valuetext", `${describe(hx)}, ${hx}`);
    if (document.activeElement !== hexEl) hexEl.value = hx.toUpperCase();
    hueEl.value = String(Math.round(h) % 360);
  };
  const set = (hex) => { const v = hexToLch(hex); L = v[0]; C = v[1]; if (v[1] > 0.012) h = v[2]; fromLch(); drawPad(); place(); };
  set(startHex || "#e6e1d6");
  // pad drag
  let dragging = false;
  const at = (ev) => { const r = pad.getBoundingClientRect(); x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)); place(); onInput?.(toHex()); };
  pad.addEventListener("pointerdown", (ev) => { dragging = true; pad.setPointerCapture(ev.pointerId); at(ev); ev.preventDefault(); });
  pad.addEventListener("pointermove", (ev) => { if (dragging) at(ev); });
  const end = () => { if (!dragging) return; dragging = false; onCommit?.(toHex()); };
  pad.addEventListener("pointerup", end); pad.addEventListener("pointercancel", end);
  pad.addEventListener("keydown", (ev) => {
    const k = { ArrowLeft: [-0.04, 0], ArrowRight: [0.04, 0], ArrowUp: [0, -0.04], ArrowDown: [0, 0.04] }[ev.key];
    if (!k) return; ev.preventDefault();
    x = Math.min(1, Math.max(0, x + k[0])); y = Math.min(1, Math.max(0, y + k[1])); place(); onInput?.(toHex()); onCommit?.(toHex());
  });
  hueEl.addEventListener("input", () => { h = +hueEl.value; drawPad(); place(); onInput?.(toHex()); });
  hueEl.addEventListener("change", () => onCommit?.(toHex()));
  let lastTyped = "";
  const takeHex = () => {
    const v = normHex(hexEl.value);
    if (!v) { hexEl.value = toHex().toUpperCase(); return; }
    if (v === lastTyped) return;        // Enter, then the blur that follows: one commit
    lastTyped = v; set(v); onCommit?.(v, true);
  };
  hexEl.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); takeHex(); hexEl.blur(); } });
  hexEl.addEventListener("change", takeHex);
  return { set };
}

// ------------------------------------------------------------------ "type or say a paint color": Claude finds it
// Three ways to reach Claude, tried in order:
//  1. the store's own endpoint (window.HS_CONFIG.paintLookupUrl, e.g. "/api/paint-lookup"):
//     the live site. Its server calls the Claude API with web search, so the color comes
//     from the paint maker's own page (see production/paint-lookup/route.ts);
//  2. the Claude artifact runtime (this preview): asks Claude on the viewer's own account,
//     from what Claude knows, without browsing;
//  3. neither: the box is hidden and the palette and mixer still work.
export function lookupPrompt(q) {
  return `A customer at a fireplace and stove showroom wants to preview a wall paint color on screen. They typed or said this (it may come from speech recognition, so words can be misheard, for example "bear" for Behr or "sure win" for Sherwin):

"${q.replace(/"/g, "'")}"

Work out which paint color they mean.
- If they named a real paint color (a brand and a color name, or a color number such as "SW 7015"), identify it: the brand, the color's name, and the brand's color number.
- If they described a color instead (for example "a soft sage green"), choose a fitting color and give it a short plain name. Do not attach a brand.

Reply with only a JSON object in this shape:
{"kind": "named" | "described" | "none", "brand": "", "name": "", "code": "", "hex": "#RRGGBB", "confidence": "high" | "medium" | "low", "note": "", "alternatives": [{"brand": "", "name": "", "code": "", "hex": "#RRGGBB"}]}

Rules:
- hex is the color as the paint maker shows it on screen (sRGB), as best you know it.
- confidence is "high" only when you are sure the color exists and you know its published value; "low" when you are estimating.
- Leave code "" unless you are sure of it. Never make up a color number or a color name.
- If the words could mean colors from more than one brand, or you are unsure which color they mean, put your best match first and up to 3 other real candidates in alternatives; otherwise alternatives is [].
- Use kind "none", with hex "", if the text isn't about a color.
- note is optional: under 15 words, plain English, for anything the customer should know.`;
}
const str = (v, n = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export function normalizeMatch(raw, src) {
  const r = raw && typeof raw === "object" ? (raw.result && typeof raw.result === "object" ? raw.result : raw) : {};
  const kind = ["named", "described", "none"].includes(r.kind) ? r.kind : (normHex(r.hex) ? "named" : "none");
  const conf = ["high", "medium", "low"].includes(String(r.confidence).toLowerCase()) ? String(r.confidence).toLowerCase() : "low";
  const one = (x) => ({ brand: kind === "described" ? "" : str(x.brand, 40), name: str(x.name, 48), code: str(x.code, 24), hex: normHex(x.hex) });
  const top = one(r);
  const alts = (Array.isArray(r.alternatives) ? r.alternatives : []).map((x) => one(x || {})).filter((x) => x.hex && x.name).slice(0, 4);
  let source = "";
  try { if (r.source_url) source = new URL(String(r.source_url)).hostname.replace(/^www\./, ""); } catch (e) { /* not a URL */ }
  return { kind: top.hex && top.name ? kind : "none", ...top, confidence: conf, note: str(r.note, 140), alternatives: alts, src, source };
}
export function createLookup() {
  let ready = null;
  async function init() {
    const url = window.HS_CONFIG?.paintLookupUrl;
    if (url) {
      return async (q, signal) => {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }), signal });
        if (res.status === 429) throw { code: "rate_limited" };
        const j = await res.json().catch(() => null);
        if (!res.ok || !j || !j.result) throw { code: res.status === 400 ? "invalid_request" : "upstream_error" };
        return normalizeMatch(j.result, "web");
      };
    }
    try {
      const sample = window.claude?.use ? await window.claude.use("sample") : null;
      if (sample) return async (q, signal) => normalizeMatch(await sample.json(lookupPrompt(q), { signal, modelTier: "default" }), "memory");
    } catch (e) { /* no runtime here */ }
    return null;
  }
  return { ready() { if (!ready) ready = init(); return ready; } };
}
/** Plain-English messages for a failed lookup; `off` means hide the feature for this visit. */
export function lookupError(e) {
  const c = e?.code || "upstream_error";
  if (c === "cancelled") return { msg: "", off: false };
  if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(c)) return { msg: "Looking up paint names isn't switched on here. Pick a shade or mix one below.", off: true };
  if (c === "rate_limited") return { msg: "Lots of lookups just now. Try again in a minute.", off: false };
  if (c === "session_expired") return { msg: "Sign in again to look up paint names.", off: false };
  if (c === "invalid_json" || c === "empty_completion" || c === "refused") return { msg: "Couldn't work that one out. Try the brand and the name as printed on the chip.", off: false };
  return { msg: "The lookup didn't answer. Check the connection and try again.", off: false };
}

// ------------------------------------------------------------------ voice (Web Speech API, where the browser has it)
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export function canListen() {
  if (!SR) return false;
  try {
    const pol = document.permissionsPolicy || document.featurePolicy;
    if (pol && typeof pol.allowsFeature === "function" && !pol.allowsFeature("microphone")) return false;
  } catch (e) { /* no policy API */ }
  return true;
}
/** Listen for one phrase. Returns a stop function. */
export function listenOnce({ onText, onDone, onError }) {
  const r = new SR();
  r.lang = navigator.language || "en-US"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let finalText = "", ended = false;
  r.onresult = (e) => {
    let t = "", fin = false;
    for (const res of e.results) { t += res[0].transcript; if (res.isFinal) fin = true; }
    t = t.trim();
    if (fin) finalText = t;
    onText?.(t, fin);
  };
  r.onerror = (e) => { if (ended) return; ended = true; onError?.(e.error || "error"); };
  r.onend = () => { if (!ended) onDone?.(finalText); ended = true; };
  try { r.start(); } catch (e) { ended = true; onError?.("not-allowed"); }
  return () => { ended = true; try { r.abort(); } catch (e) { /* already stopped */ } };
}
