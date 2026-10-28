import { NextResponse } from "next/server";

import { overLimit, visitorOf } from "@/lib/search/guard";
import { getIndex } from "@/lib/search/names";
import { suggest } from "@/lib/search/recognize";

/**
 * GET /api/search/suggest?q=…: names the search holds that start with what's
 * been typed so far, for the box's drop-down. Recognizer only: no database
 * query beyond the cached index, no AI.
 *
 * A model carries its catalog id too, so a page can send it somewhere of its
 * own: the manuals hub opens the model's guide (28 Oct 2026).
 */
export type Suggestion = { label: string; message: string; url: string; id?: string };

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 80) ?? "";
  if (overLimit(`suggest:${visitorOf(request.headers)}`, 150, 2000)) {
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  }
  try {
    const index = await getIndex();
    const suggestions: Suggestion[] = suggest(q, index).map((e) => {
      const name = e.label.split(" · ")[0];
      const url =
        e.kind === "brand"
          ? `/brands/${e.ref}/`
          : e.kind === "page"
            ? e.ref
            : `/search/?q=${encodeURIComponent(name)}`;
      const model = e.kind === "model" || e.kind === "model_number";
      return { label: e.label, message: name, url, ...(model ? { id: e.ref } : {}) };
    });
    return NextResponse.json({ suggestions }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 503 });
  }
}
