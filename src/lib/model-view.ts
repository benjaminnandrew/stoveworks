/**
 * What a model's page says. Ben, 22 Oct 2026: "the model pages don't need to be
 * crazy with info - some basic details for Stoveworks and the customer. Then a
 * link to the manufacturer's page." So: a type line, a handful of facts a
 * customer asks first, the maker's short description, and the SEO title and
 * description, all from the brain record.
 *
 * Maker's figures only, as on the cards. Installation values (clearances,
 * venting, flue, gas input, outside air, mobile-home approval) stay in the owner
 * & installer guide, where the manual page is one click away. No prices.
 */

import { typeLabel } from "@/content/lineup";
import type { CatalogModel } from "@/lib/catalog";

export type ModelFact = { label: string; value: string };

export type ModelView = {
  /** "Catalytic wood stove · 20 Series" */
  typeLine: string;
  /** The maker's own short description, as the brain records it. */
  description: string | null;
  facts: ModelFact[];
  seoTitle: string;
  seoDescription: string;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** "catalytic" and "non-catalytic" are worth saying about a wood stove; nothing else is. */
function combustion(specs: Record<string, unknown>, fuel: string | null) {
  const c = specs.combustion_type;
  return fuel === "wood" && typeof c === "string" ? c : null;
}

function facts(m: CatalogModel, specs: Record<string, unknown>): ModelFact[] {
  const out: ModelFact[] = [];
  const min = num(specs.heating_area_sqft_min);
  const max = num(specs.heating_area_sqft_max) ?? m.heating_area_sqft_max;
  if (max) out.push({ label: "Heats", value: min ? `${fmt(min)} to ${fmt(max)} sq ft` : `up to ${fmt(max)} sq ft` });

  if (m.efficiency_pct) {
    out.push({
      label: "Efficiency",
      value: `${fmt(m.efficiency_pct)}%${m.efficiency_basis ? ` (${m.efficiency_basis})` : ""}`,
    });
  }

  const burn = num(specs.burn_time_hr_max) ?? m.burn_time_hr_max;
  if (burn && (m.fuel === "wood" || m.fuel === "pellet")) out.push({ label: "Burns", value: `up to ${fmt(burn)} hours` });

  const firebox = num(specs.firebox_cu_ft);
  if (firebox) out.push({ label: "Firebox", value: `${fmt(firebox)} cu ft` });

  const logMax = num(specs.log_length_max_in);
  const logRec = num(specs.log_length_recommended_in);
  if (logMax) out.push({ label: "Logs", value: `up to ${fmt(logMax)}″` });
  else if (logRec) out.push({ label: "Logs", value: `${fmt(logRec)}″ recommended` });

  const hopper = num(specs.hopper_capacity_lb);
  if (hopper) out.push({ label: "Hopper", value: `${fmt(hopper)} lb of pellets` });

  const watts = num(specs.electric_watts_max);
  if (watts) out.push({ label: "Heater", value: `${fmt(watts)} watts` });

  const size = (
    [
      ["W", specs.width_in],
      ["H", specs.height_in],
      ["D", specs.depth_in],
    ] as const
  ).flatMap(([k, v]) => (num(v) ? [`${fmt(num(v)!)}″ ${k}`] : []));
  if (size.length) out.push({ label: "Size", value: size.join(" × ") });

  const weight = num(specs.weight_lb);
  if (weight) out.push({ label: "Weight", value: `${fmt(weight)} lb` });

  if (specs.blower === "standard" || specs.blower === "optional") {
    out.push({ label: "Blower", value: specs.blower === "standard" ? "Included" : "Optional" });
  }
  return out;
}

/** Page part of the title: at most 38 characters, so with " | Hayward Stoveworks" it fits 59. */
const TITLE_MAX = 38;

function seoTitle(brand: string, m: CatalogModel) {
  const type = titleCase(typeLabel(m.form, m.fuel));
  // "Neo 1.6 Insert LE2" already says what it is; don't add "Wood Insert" after it.
  const says = m.form ? new RegExp(`\\b${m.form.replace("_", " ")}`, "i").test(m.name) : false;
  const options = says
    ? [`${brand} ${m.name}`, m.name]
    : [`${brand} ${m.name} ${type}`, `${brand} ${m.name}`, `${m.name} ${type}`, m.name];
  return options.find((t) => t.length <= TITLE_MAX) ?? m.name;
}

/** 125–155 characters where the facts allow: what it is, two or three facts, and where. */
function seoDescription(brand: string, m: CatalogModel, specs: Record<string, unknown>) {
  const kind = [combustion(specs, m.fuel), typeLabel(m.form, m.fuel)].filter(Boolean).join(" ");
  const lead = `${brand} ${m.name}, ${/^[aeiou]/i.test(kind) ? "an" : "a"} ${kind}`;
  const max = num(specs.heating_area_sqft_max) ?? m.heating_area_sqft_max;
  const burn = num(specs.burn_time_hr_max) ?? m.burn_time_hr_max;
  const bits = [
    max ? `heats up to ${fmt(max)} sq ft` : null,
    burn && (m.fuel === "wood" || m.fuel === "pellet") ? `burns up to ${fmt(burn)} hours` : null,
    m.efficiency_pct ? `is ${fmt(m.efficiency_pct)}% efficient${m.efficiency_basis ? ` (${m.efficiency_basis})` : ""}` : null,
  ].filter((b): b is string => Boolean(b));
  const tails = [
    " See it, and its owner & installer guide, at Hayward Stoveworks in Hayward, WI.",
    " Ask about it at Hayward Stoveworks in Hayward, WI.",
    " At Hayward Stoveworks, Hayward WI.",
  ];
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
  // More facts beat a longer sign-off.
  for (let n = bits.length; n >= 0; n--) {
    for (const tail of tails) {
      const text = `${n ? `${lead} that ${list(bits.slice(0, n))}` : lead}.${tail}`;
      if (text.length <= 155) return text;
    }
  }
  return `${brand} ${m.name} at Hayward Stoveworks in Hayward, WI.`;
}

export function modelView(m: CatalogModel, brandName: string): ModelView {
  const specs = (m.data.specs ?? {}) as Record<string, unknown>;
  const series = typeof m.data.series === "string" ? m.data.series : null;
  const kind = [combustion(specs, m.fuel), typeLabel(m.form, m.fuel)].filter(Boolean).join(" ");
  return {
    typeLine: [capital(kind), series].filter(Boolean).join(" · "),
    description: typeof m.data.description === "string" ? m.data.description : null,
    facts: facts(m, specs),
    seoTitle: seoTitle(brandName, m),
    seoDescription: seoDescription(brandName, m, specs),
  };
}
