/**
 * The first stage of every search (blueprint section 3, "Guard", and section 7).
 *
 * The safety screen runs on the text with held names already taken out, so a
 * model or part whose name contains a screened word still works. It's a rule
 * about what people say, not about any product.
 *
 * DRAFT WORDING: the emergency and refusal messages below are drafts until
 * Stoveworks (Steve) approves them. Change them here, nowhere else.
 */

export const EMERGENCY_MESSAGE =
  "If you smell gas or a carbon monoxide alarm is going off, get everyone out of the house now. " +
  "Don't flip switches, use a phone or light anything inside. Once you're outside, call 911 or your gas utility. " +
  "If there's a chimney fire or smoke filling the room, get everyone out and call 911.";

export const REFUSAL_MESSAGE =
  "We can't help with getting around a safety device. When one keeps shutting a stove or fireplace down, " +
  "it's telling you something needs attention. Call us and we'll set up a service visit.";

/** Emergencies, on folded text (lowercase letters and digits, single spaces). */
const EMERGENCY = [
  /\b(smell|smells|smelling|odou?r)\b(\s\w+){0,4}\s(gas|propane)\b/,
  /\b(gas|propane)\s(smell|leak|leaking|odou?r)\b/,
  /\brotten eggs?\b/,
  /\b(carbon monoxide|co)\s(alarm|detector|monitor)\b/,
  /\b(alarm|detector|monitor)\b(\s\w+){0,4}\s(carbon monoxide|co)\b/,
  /\bcarbon monoxide\b(\s\w+){0,4}\s(going off|beeping|sounding|went off)\b/,
  /\bchimney fire\b/,
  /\bchimney\b(\s\w+){0,2}\son fire\b/,
  /\bsmoke\b(\s\w+){0,3}\s(filling|pouring|billowing)\b/,
  /\broom\b(\s\w+){0,2}\s(full of|filling with)\ssmoke\b/,
  /\b(house|home|wall|roof)\b(\s\w+){0,2}\son fire\b/,
];

/** Getting around a safety device: a verb of defeating it near the device. */
const DEFEAT = /\b(bypass|bypassing|disable|disabling|defeat|jump|jumper|jumping|override|wire around|remove|disconnect|cheat)\b/;
const DEVICE =
  /\b(thermocouple|thermopile|safety switch|spill switch|high limit|limit switch|ods|oxygen depletion|vacuum switch|pressure switch|flame sensor|safety device|safety valve|interlock)\b/;

export type Screen = "emergency" | "refusal" | null;

export function screen(unheld: string): Screen {
  if (EMERGENCY.some((r) => r.test(unheld))) return "emergency";
  if (DEFEAT.test(unheld) && DEVICE.test(unheld)) return "refusal";
  return null;
}

// --- rate limits --------------------------------------------------------------------

/**
 * Per visitor and overall, over a sliding five minutes (blueprint: 15 and 80).
 * Only in production: the generated tests run hundreds of searches locally.
 */
const WINDOW_MS = 5 * 60_000;
const hits = new Map<string, number[]>();
let all: number[] = [];

export function overLimit(visitor: string, perVisitor: number, overall: number): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const now = Date.now();
  const recent = (hits.get(visitor) ?? []).filter((t) => now - t < WINDOW_MS);
  all = all.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= perVisitor || all.length >= overall) return true;
  recent.push(now);
  all.push(now);
  hits.set(visitor, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** The visitor's address as the proxy reports it. Kept in memory only, never logged. */
export function visitorOf(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "local";
}
