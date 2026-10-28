/**
 * Near spellings: how far a typed word is from a word the search holds.
 *
 * Optimal string alignment distance, so a swapped pair of letters ("hearhtstone")
 * counts as one edit, not two. A cheap letter-set check runs first and skips
 * most comparisons. No imports, so the tests load it directly.
 */

/** Edits allowed for a word this long: none under 5 letters, two from 9. */
export function allowedEdits(length: number): number {
  if (length < 5) return 0;
  return length >= 9 ? 2 : 1;
}

/** Letters in a but not b, plus letters in b but not a: a floor on the edit distance. */
function letterGap(a: string, b: string): number {
  const counts = new Map<string, number>();
  for (const c of a) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const c of b) counts.set(c, (counts.get(c) ?? 0) - 1);
  let plus = 0;
  let minus = 0;
  for (const n of counts.values()) {
    if (n > 0) plus += n;
    else minus -= n;
  }
  return Math.max(plus, minus);
}

export function distance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (letterGap(a, b) > max) return max + 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    let best = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
  }
  return d[rows - 1][cols - 1];
}

/**
 * Is `typed` a near spelling of `held`? Same first letter, both at least five
 * letters, and within the edits allowed for the held word's length.
 */
export function isNear(typed: string, held: string): boolean {
  if (typed === held || typed[0] !== held[0]) return false;
  const edits = allowedEdits(Math.min(typed.length, held.length));
  if (!edits) return false;
  return distance(typed, held, edits) <= edits;
}
