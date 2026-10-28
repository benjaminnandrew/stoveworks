// POST multipart/form-data { photo: JPEG, width, height }  ->  { "layout": Layout }
//
// Hearth Studio's photo helper, "what's what" step (handoff/hearth-studio/production/find-surfaces,
// installed 28 Oct 2026): Claude looks at the customer's photo and says roughly where the stone
// would go, what stands in front of it and where the openings are. The exact edges are found in
// the browser by the segmentation model (public/hs/js/segment.js), so this only needs rough boxes
// and a few spots. The API key stays on the server.
//
// Setup
//   ANTHROPIC_API_KEY=...                   (required; Replit Secrets in production, .env.local in dev)
//   FIND_SURFACES_MODEL=claude-sonnet-5-5   (optional)
//   public/hs/index.html sets window.HS_CONFIG.findSurfacesUrl to this route. Without a key it
//   answers 503 "not_configured" and the helper asks the customer to tap the wall once instead.
//
// Privacy: the photo is read in memory, sent to Claude for this one answer and dropped. Nothing
// here stores or logs it. (Anthropic's API terms cover what happens on their side; link them from
// the site's privacy page.) To keep photos on the customer's device instead, take findSurfacesUrl
// out of HS_CONFIG: the helper then asks the customer to tap the wall once and does the rest in
// the browser.
//
// Cost per photo: about 2,000 input tokens (mostly the image, sent at 1280 px) and a few hundred
// output tokens. Multiply by the model's current per-token price.
//
// Keep the instructions below in step with layoutPrompt() in public/hs/js/layout.js (same wording;
// this one ends with the tool call instead of "reply with JSON").
//
// Changed from the package: the client is made on first use and a missing key answers a clean 503
// "not_configured"; a declined request stops instead of being asked again, and on Sonnet
// the API's server-side fallback reruns declines it can (fallbacks: "default").

import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MODEL = process.env.FIND_SURFACES_MODEL ?? "claude-sonnet-5-5";
// Claude Haiku 5.5 has no server-side fallback, so the parameter is left off for it.
const FALLBACK = MODEL.startsWith("claude-haiku")
  ? {}
  : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
const KINDS = ["Chimney face", "Chimney side", "Main wall", "Hearth front", "Hearth side", "Accent wall"];

// Made on first use. Credentials are only looked for when a request goes out, so a site without
// a key still builds and serves; the request then fails and answers "not_configured".
let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic());

const NUMS = { type: "array", items: { type: "number" } };
const REPORT: Anthropic.Beta.BetaTool = {
  name: "report_layout",
  description: "Report where stone would go in the photo, what stands in front of it, and the openings. Call this once, as your final step.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      surfaces: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string", enum: KINDS }, box: NUMS, points: { type: "array", items: NUMS }, whole: { type: "boolean" } },
          required: ["label", "box", "points", "whole"],
          additionalProperties: false,
        },
      },
      in_front: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, box: NUMS, points: { type: "array", items: NUMS } }, required: ["label", "box", "points"], additionalProperties: false },
      },
      openings: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, box: NUMS }, required: ["label", "box"], additionalProperties: false },
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      note: { type: "string" },
    },
    required: ["surfaces", "in_front", "openings", "confidence", "note"],
    additionalProperties: false,
  },
};

function prompt(w: number, h: number) {
  return `This photo (${w} x ${h} pixels) comes from a customer of a fireplace and stove shop. The shop's app is about to show them what stone veneer would look like in this room, and needs to know where the stone would go and what stands in front of it.

Coordinates are pixels in this photo: x from 0 at the left edge to ${w} at the right, y from 0 at the top to ${h} at the bottom. A box is [left, top, right, bottom]; a point is [x, y].

surfaces: the upright, flat surfaces that would get stone veneer, biggest first, at most 4.
- If there is a chimney, chimney breast, fireplace surround or raised hearth, those are the stone areas: the face, each side you can see, and the front of a raised hearth, each as its own surface.
- If a stove stands against a plain wall, the stone area is the wall behind the stove, from the floor (or the hearth) up to the ceiling, out to the nearest natural edges such as a corner, a window or door trim. If the wall runs on much farther, take a section about twice as wide as the stove, centered behind it.
- Never a floor, ceiling, hearth top (the slab a stove stands on), window, door or piece of furniture.
- label: one of ${KINDS.map((k) => `"${k}"`).join(", ")}.
- box: the surface's full extent, including any part hidden behind things in front of it. Be as exact as you can about its edges.
- points: 2 or 3 spots clearly on the visible surface itself: not on anything in front of it (stove, pipe, mantel, TV, decor), not near an edge, spread apart.
- whole: true when the stone would cover the surface out to its own edges (a chimney face); false when the box marks only a section of a bigger wall.

in_front: things standing in front of those surfaces that stay in front of the stone: stove, stove pipe, mantel shelf or beam, TV, wood rack, stacked logs, furniture, lamps, plants. Only things that overlap a surface's box. A tight box and 1 or 2 points on the thing itself.

openings: places inside a surface that get no stone: a fireplace opening or its glass front, a window, a door, a niche. A tight box.

confidence: "high" when the photo clearly shows a fireplace, chimney or a wall with a stove; "low" when you can't tell where stone would go. Then leave surfaces empty and say why in note, under 15 words, written to the customer.

Finish by calling report_layout.`;
}

// A public endpoint that spends API credit: at most 12 photos per visitor per 10 minutes.
const recent = new Map<string, number[]>();
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const now = Date.now();
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const mine = (recent.get(who) ?? []).filter((t) => now - t < 600_000);
  if (mine.length >= 12) return Response.json({ error: "rate_limited" }, { status: 429 });
  recent.set(who, [...mine, now]);

  let photo: File | null = null, w = 0, h = 0;
  try {
    const fd = await req.formData();
    const f = fd.get("photo");
    photo = f instanceof File ? f : null;
    w = Math.round(Number(fd.get("width"))); h = Math.round(Number(fd.get("height")));
  } catch { /* not a form */ }
  if (!photo || photo.type !== "image/jpeg" || photo.size > MAX_BYTES || !(w > 0 && h > 0 && w <= 4000 && h <= 4000)) {
    return Response.json({ error: "bad_photo" }, { status: 400 });
  }
  const data = Buffer.from(await photo.arrayBuffer()).toString("base64");

  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
      { type: "text", text: prompt(w, h) },
    ],
  }];
  try {
    for (let round = 0; round < 3; round++) {
      const res = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 2048,
        output_config: { effort: "low" },   // boxes, not an essay: a few seconds
        tools: [REPORT],
        messages,
        ...FALLBACK,
      });
      if (res.stop_reason === "refusal") return Response.json({ error: "declined" }, { status: 502 });
      const call = res.content.find((b) => b.type === "tool_use" && b.name === REPORT.name);
      if (call && call.type === "tool_use") return Response.json({ layout: call.input });
      // answered in words instead: ask once more for the tool call
      messages.push({ role: "assistant", content: res.content });
      messages.push({ role: "user", content: "Please call report_layout with your answer now." });
    }
  } catch (e) {
    // Not set up: a key the API refused, or a failure before reaching the API with no key in the
    // environment (the SDK raises a plain Error when it finds no credentials).
    const noKey = !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;
    if (e instanceof Anthropic.AuthenticationError || (noKey && !(e instanceof Anthropic.APIError))) {
      console.error("find-surfaces: no working Claude API key (set ANTHROPIC_API_KEY)");
      return Response.json({ error: "not_configured" }, { status: 503 });
    }
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 503 });
    console.error("find-surfaces failed", (e as Error)?.message);   // never log the photo
    return Response.json({ error: "upstream" }, { status: 502 });
  }
  return Response.json({ error: "no_answer" }, { status: 502 });
}
