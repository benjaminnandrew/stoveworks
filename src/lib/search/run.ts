import "server-only";

import { business } from "@/content/site";

import { LIMITS, type SearchRequest, type SearchResponse } from "./contract";
import { runSearch } from "./engine";
import { overLimit } from "./guard";
import { logFailure, logSearch } from "./log";

/**
 * Every search box goes through here, the endpoint and the /search/ page alike,
 * so they share limits, failures and logging as well as the engine.
 * Failures come back as real reasons, never as "nothing found" (blueprint rule 11).
 */

export type Ran = { status: number; response: SearchResponse };

const BUDGET_MS = 6500;
const SURFACES = new Set<SearchRequest["surface"]>(["home", "header", "page", "drawer", "test"]);

const failure = (reply: string): SearchResponse => ({ kind: "unsupported", reply, filters: null, choices: [], sources: [] });

/** Shapes and limits a request from outside (blueprint section 3, "Guard"). */
export function readRequest(body: unknown): SearchRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string" || b.message.length > LIMITS.message) return null;
  const surface = (typeof b.surface === "string" ? b.surface : "page") as SearchRequest["surface"];
  if (!SURFACES.has(surface)) return null;
  let scope: SearchRequest["scope"];
  if (b.scope !== undefined) {
    if (typeof b.scope !== "object" || b.scope === null) return null;
    const s = b.scope as Record<string, unknown>;
    scope = {
      ...(typeof s.modelId === "string" ? { modelId: s.modelId } : {}),
      ...(typeof s.brandSlug === "string" ? { brandSlug: s.brandSlug } : {}),
      ...(s.audience === "owner" || s.audience === "installer" ? { audience: s.audience } : {}),
    };
  }
  if (b.context !== undefined && JSON.stringify(b.context).length > LIMITS.context) return null;
  return { message: b.message, surface, scope, context: b.context };
}

export async function search(req: SearchRequest, visitor: string): Promise<Ran> {
  if (overLimit(visitor, 15, 80)) {
    return { status: 429, response: failure("You've run a lot of searches. Try again in a minute.") };
  }
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      runSearch(req),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })), BUDGET_MS);
      }),
    ]);
    void logSearch(req, response);
    return { status: 200, response };
  } catch (err) {
    logFailure("search", err, startedAt);
    void logSearch(req, null);
    const slow = err instanceof Error && err.name === "TimeoutError";
    return {
      status: slow ? 504 : 503,
      response: failure(
        slow
          ? "That search took too long. Try again, or try fewer words."
          : `Search isn't working right now. Try again in a minute, or call us at ${business.phoneDisplay}.`,
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}
