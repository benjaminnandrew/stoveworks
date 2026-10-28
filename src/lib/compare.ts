import "server-only";

import { brandBySlug } from "@/content/brands";
import { typeLabel } from "@/content/lineup";
import { getCatalogModel, isPublicModel } from "@/lib/catalog";
import { modelHref } from "@/lib/model-url";
import { modelView } from "@/lib/model-view";
import type { ShortItem } from "@/lib/shortlist";

/**
 * The compare page's table (Ben, 22 Oct 2026: "a 5 compare set up"). The same
 * facts as the model pages, so the two never disagree; efficiency keeps its
 * test basis in every cell, because makers measure it differently. No prices,
 * and no installation values (those stay in each model's guide).
 */

export type CompareCell = { text: string; href?: string; external?: boolean } | null;
export type CompareRow = { key: string; label: string; hint?: string; group: "basics" | "stoveworks" };
export type CompareColumn = { item: ShortItem; typeLine: string; cells: Record<string, CompareCell> };

export const COMPARE_ROWS: CompareRow[] = [
  { key: "Type", label: "Type", group: "basics" },
  { key: "Heats", label: "Heats", group: "basics" },
  {
    key: "Efficiency",
    label: "Efficiency",
    hint: "Makers test this in different ways (HHV, LHV, AFUE…), so compare like with like.",
    group: "basics",
  },
  { key: "Burns", label: "Burn time", group: "basics" },
  { key: "Firebox", label: "Firebox", group: "basics" },
  { key: "Logs", label: "Log length", group: "basics" },
  { key: "Hopper", label: "Hopper", group: "basics" },
  { key: "Heater", label: "Electric heater", group: "basics" },
  { key: "Size", label: "Size", group: "basics" },
  { key: "Weight", label: "Weight", group: "basics" },
  { key: "Blower", label: "Blower", group: "basics" },
  { key: "Venting", label: "Venting", group: "basics" },
  { key: "Showroom", label: "At our showroom", group: "stoveworks" },
  { key: "Guide", label: "Owner & installer guide", group: "stoveworks" },
  { key: "Maker", label: "Full specs", group: "stoveworks" },
];

const VENTING: Record<string, string> = {
  chimney: "Chimney",
  direct_vent: "Direct vent",
  b_vent: "B-vent",
  vent_free: "Vent-free",
  none: "None needed",
};

/** Up to five models by catalog id, in the order given; ids the site doesn't show are dropped. */
export async function loadComparison(ids: string[]): Promise<CompareColumn[]> {
  const models = await Promise.all(ids.slice(0, 5).map((id) => getCatalogModel(id)));
  return models.flatMap((m) => {
    if (!m || !isPublicModel(m)) return [];
    const brand = brandBySlug(m.brand_slug)?.name ?? m.brand_name;
    const view = modelView(m, brand);
    const cells: Record<string, CompareCell> = Object.fromEntries(
      view.facts.map((f) => [f.label, { text: f.value }]),
    );
    cells.Type = { text: view.typeLine };
    cells.Venting = m.venting && VENTING[m.venting] ? { text: VENTING[m.venting] } : null;
    cells.Showroom = {
      text: m.carry_status === "on_floor" ? "On the floor" : m.carry_status === "carried" ? "We carry it" : "Ask us",
    };
    cells.Guide = m.guide_id ? { text: "Read the guide", href: `/guides/${m.guide_id}/` } : null;
    cells.Maker = m.product_url ? { text: `On ${brand}’s site`, href: m.product_url, external: true } : null;
    return [
      {
        item: {
          id: m.id,
          name: m.name,
          brand,
          type: typeLabel(m.form, m.fuel),
          href: modelHref(m),
          photo: m.hero_image,
        },
        typeLine: view.typeLine,
        cells,
      },
    ];
  });
}
