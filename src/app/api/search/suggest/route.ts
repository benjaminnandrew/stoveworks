import { NextResponse } from "next/server";

import { overLimit, visitorOf } from "@/lib/search/guard";
import { getIndex } from "@/lib/search/names";
import { suggest } from "@/lib/search/recognize";

/**
 * GET /api/search/suggest?q=…: names the search holds that start with what's
 * been typed so far, for the box's drop-down. Recognizer only: no database
 * query beyond the cached index, no AI.
 */
export type Suggestion = { label: string; message: string; url: string };

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
      return { label: e.label, message: name, url };
    });
    return NextResponse.json({ suggestions }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 503 });
  }
}
