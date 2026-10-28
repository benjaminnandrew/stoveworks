/**
 * The one way the search reads text, for stored names and typed words alike.
 *
 * ø, æ and ß first, because Unicode NFKD doesn't split them: without that,
 * "Jøtul" folds to "j tul" and a search for "jotul" never finds it. Then NFKD
 * strips the accents NFKD can (é, å, ü), and everything that isn't a letter or
 * digit becomes a space.
 *
 * No imports: the tests load this file directly with Node.
 */
export function fold(s: string): string {
  return s
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Folded and without spaces: "GI 635 DV", "gi-635dv" and "GI635DV" all become "gi635dv". */
export const compact = (s: string): string => fold(s).replace(/ /g, "");

export const words = (s: string): string[] => {
  const f = fold(s);
  return f ? f.split(" ") : [];
};

export const hasDigit = (s: string): boolean => /\d/.test(s);
