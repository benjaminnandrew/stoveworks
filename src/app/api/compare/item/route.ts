import { NextResponse } from "next/server";

import { loadShortItem } from "@/lib/compare";
import { overLimit, visitorOf } from "@/lib/search/guard";

/**
 * GET /api/compare/item?id=…: a model's compare-tray entry (name, maker, type, page, photo) by
 * catalog id, for a model picked in the tray's own search (Ben, 1 Nov 2026: "we should be able to
 * add to compare right from this bottom bar"). Only models the site shows.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 120) ?? "";
  if (overLimit(`compare-item:${visitorOf(request.headers)}`, 60, 1000)) {
    return NextResponse.json({ item: null }, { status: 429 });
  }
  try {
    const item = id ? await loadShortItem(id) : null;
    return NextResponse.json({ item }, { status: item ? 200 : 404, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ item: null }, { status: 503 });
  }
}
