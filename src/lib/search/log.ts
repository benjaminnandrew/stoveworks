import "server-only";

import { query } from "@/lib/db";

import type { SearchRequest, SearchResponse } from "./contract";
import { outcomeOf } from "./engine";

/**
 * The search log: the phrase, where it was typed, and what came of it. No
 * visitor ids or addresses, and rows older than 30 days are cleared as new
 * ones arrive. Logging never fails a search.
 */
export async function logSearch(req: SearchRequest, res: SearchResponse | null) {
  if (req.surface === "test") return;
  try {
    const outcome = res ? outcomeOf(res) : "failed";
    const results = res ? res.sources.filter((s) => s.kind === "model" || s.kind === "guide_section").length : null;
    await query(`INSERT INTO search_log (phrase, surface, outcome, results) VALUES ($1, $2, $3, $4)`, [
      req.message.slice(0, 300),
      req.surface,
      outcome,
      results,
    ]);
    if (Math.random() < 0.02) await query(`DELETE FROM search_log WHERE created_at < now() - interval '30 days'`);
  } catch {
    // The table arrives with `npm run db:migrate`; a search works without it.
  }
}

/**
 * The server's own log line for a failure: the stage and the error type, never
 * the visitor's words (blueprint section 9).
 */
export function logFailure(stage: string, err: unknown, startedAt: number) {
  const type = err instanceof Error ? err.name : typeof err;
  console.error(`[search] failed at ${stage}: ${type} after ${Date.now() - startedAt} ms`);
}
