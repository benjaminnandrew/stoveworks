import { NextResponse } from "next/server";

import { visitorOf } from "@/lib/search/guard";
import { readRequest, search } from "@/lib/search/run";

/**
 * POST /api/search: the one search endpoint (docs/smart-search-plan.md).
 * Body: { message, surface?, scope?, context? }. Always answers in the
 * SearchResponse shape, failures included, with the HTTP status saying which.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const req = readRequest(body);
  if (!req) {
    return NextResponse.json(
      { kind: "unsupported", reply: "That search couldn't be read. Try typing it again.", filters: null, choices: [], sources: [] },
      { status: 400 },
    );
  }
  const { status, response } = await search(req, visitorOf(request.headers));
  return NextResponse.json(response, { status, headers: { "cache-control": "no-store" } });
}
