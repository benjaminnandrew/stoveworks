// POST { "query": "Behr Drift Blue" }  ->  { "result": PaintMatch }
//
// Hearth Studio's "Know the paint you want?" box (handoff/hearth-studio/production/paint-lookup,
// installed 28 Oct 2026). It runs here, not in the browser, so the Claude API key never leaves the
// server. Claude searches the web (paint makers publish an on-screen value for each color), then
// hands back its answer through a strict tool, so the shape is guaranteed. The page shows the
// source site under the color ("Matched from behr.com").
//
// Setup
//   ANTHROPIC_API_KEY=...                (required; Replit Secrets in production, .env.local in dev)
//   PAINT_LOOKUP_MODEL=claude-sonnet-5-5 (optional; claude-haiku-5-5 is cheaper and faster, a little
//                                         less sure of rare colors: decision 6 in INTEGRATION.md)
//   public/hs/index.html sets window.HS_CONFIG.paintLookupUrl to this route.
//   Without a key it answers 503 "not_configured" and the box says it couldn't look the color up.
//
// Cost: one lookup is usually one or two web searches (US$10 per 1,000 searches) plus tokens,
// so roughly 2-4 cents with Sonnet. Answers are cached, so a popular color is paid for once.
// Web search must be on for the organization in the Claude Console (it is by default).
//
// Changed from the package: web search is the current tool version (web_search_20260209); the
// client is made on first use and a missing key answers a clean 503 "not_configured"; a
// declined request stops instead of being asked again, and on Sonnet the API's server-side
// fallback reruns declines it can (fallbacks: "default").

import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MODEL = process.env.PAINT_LOOKUP_MODEL ?? "claude-sonnet-5-5";
// Claude Haiku 5.5 has no server-side fallback, so the parameter is left off for it.
const FALLBACK = MODEL.startsWith("claude-haiku")
  ? {}
  : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

// Made on first use. Credentials are only looked for when a request goes out, so a site without
// a key still builds and serves; the request then fails and answers "not_configured".
let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic());

type Match = { brand: string; name: string; code: string; hex: string };
type PaintMatch = Match & {
  kind: "named" | "described" | "none";
  confidence: "high" | "medium" | "low";
  source_url: string;
  note: string;
  alternatives: Match[];
};

const MATCH_SCHEMA = {
  type: "object",
  properties: { brand: { type: "string" }, name: { type: "string" }, code: { type: "string" }, hex: { type: "string" } },
  required: ["brand", "name", "code", "hex"],
  additionalProperties: false,
};

const REPORT: Anthropic.Beta.BetaTool = {
  name: "report_paint_color",
  description: "Report the paint color the customer means. Call this once, as your final step, after any searching.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["named", "described", "none"] },
      brand: { type: "string" },
      name: { type: "string" },
      code: { type: "string", description: "The brand's color number, or \"\" if you couldn't confirm it" },
      hex: { type: "string", description: "#RRGGBB as the paint maker shows the color on screen; \"\" for kind none" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      source_url: { type: "string", description: "The page the hex value came from, or \"\"" },
      note: { type: "string", description: "Optional, under 15 words, for the customer" },
      alternatives: { type: "array", items: MATCH_SCHEMA },
    },
    required: ["kind", "brand", "name", "code", "hex", "confidence", "source_url", "note", "alternatives"],
    additionalProperties: false,
  },
};

function prompt(q: string) {
  return `A customer at a fireplace and stove showroom wants to preview a wall paint color on screen. They typed or said this (it may come from speech recognition, so words can be misheard, for example "bear" for Behr or "sure win" for Sherwin):

"${q.replace(/"/g, "'")}"

Work out which paint color they mean.
- If they named a real paint color (a brand and a color name, or a color number such as "SW 7015"), look it up with web search, preferring the paint maker's own website. Report the brand, the color's name, the brand's color number, and the hex value the maker publishes (or the one on a reliable color-reference page if the maker shows none), with that page as source_url.
- If they described a color instead ("a soft sage green"), choose a fitting color and give it a short plain name, with no brand. No search needed.
- If the words could mean more than one brand's color, put the best match first and up to 3 other real candidates in alternatives.
- Never make up a color name or number. If you can't confirm the color exists, set confidence to "low" and say so in note.
- Use kind "none", with hex "", if the text isn't about a color.
Finish by calling report_paint_color.`;
}

const HEX = /^#?([0-9a-f]{6})$/i;
const hex = (h: unknown) => { const m = HEX.exec(String(h ?? "").trim()); return m ? "#" + m[1].toLowerCase() : ""; };
const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function clean(r: PaintMatch): PaintMatch {
  return {
    kind: r.kind,
    brand: str(r.brand, 40), name: str(r.name, 48), code: str(r.code, 24), hex: hex(r.hex),
    confidence: r.confidence,
    source_url: /^https?:\/\//.test(r.source_url) ? r.source_url : "",
    note: str(r.note, 140),
    alternatives: (r.alternatives ?? [])
      .map((a) => ({ brand: str(a.brand, 40), name: str(a.name, 48), code: str(a.code, 24), hex: hex(a.hex) }))
      .filter((a) => a.hex && a.name)
      .slice(0, 3),
  };
}

// Answers keep for 30 days. This in-memory copy is per server process: move it to a Postgres
// table (query text -> result JSON) to share it across servers and restarts.
const cache = new Map<string, { at: number; result: PaintMatch }>();
const KEEP = 30 * 86_400_000;
// A public endpoint that spends API credit: at most 20 lookups per visitor per 10 minutes.
const recent = new Map<string, number[]>();

export async function POST(req: Request) {
  let q = "";
  try { q = String((await req.json())?.query ?? ""); } catch { /* empty body */ }
  q = q.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!q) return Response.json({ error: "empty" }, { status: 400 });

  const now = Date.now();
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const mine = (recent.get(who) ?? []).filter((t) => now - t < 600_000);
  if (mine.length >= 20) return Response.json({ error: "rate_limited" }, { status: 429 });
  recent.set(who, [...mine, now]);

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && now - hit.at < KEEP) return Response.json({ result: hit.result, cached: true });

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt(q) }];
  try {
    for (let round = 0; round < 4; round++) {
      const res = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 4096,
        output_config: { effort: "low" },   // a lookup, not an essay: keeps it to a few seconds
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }, REPORT],
        messages,
        ...FALLBACK,
      });
      if (res.stop_reason === "refusal") return Response.json({ error: "declined" }, { status: 502 });
      const call = res.content.find((b) => b.type === "tool_use" && b.name === REPORT.name);
      if (call && call.type === "tool_use") {
        const result = clean(call.input as PaintMatch);
        cache.set(key, { at: now, result });
        return Response.json({ result });
      }
      // A long search can pause the turn: send it back unchanged to continue. If Claude answered
      // in words instead of calling the tool, ask once more for the tool call.
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason !== "pause_turn") messages.push({ role: "user", content: "Please call report_paint_color with your answer now." });
    }
  } catch (e) {
    // Not set up: a key the API refused, or a failure before reaching the API with no key in the
    // environment (the SDK raises a plain Error when it finds no credentials).
    const noKey = !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;
    if (e instanceof Anthropic.AuthenticationError || (noKey && !(e instanceof Anthropic.APIError))) {
      console.error("paint lookup: no working Claude API key (set ANTHROPIC_API_KEY)");
      return Response.json({ error: "not_configured" }, { status: 503 });
    }
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 503 });
    console.error("paint lookup failed", e);
    return Response.json({ error: "upstream" }, { status: 502 });
  }
  return Response.json({ error: "no_answer" }, { status: 502 });
}
