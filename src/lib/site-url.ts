/**
 * Canonical origin for metadata, the sitemap, JSON-LD and — most importantly —
 * the magic-link sign-in emails.
 *
 * Deliberately NOT derived from request headers: a forged Host header would
 * otherwise let an attacker mint sign-in links pointing at their own domain.
 * Production must set SITE_URL.
 */
const configured = process.env.SITE_URL?.replace(/\/$/, "");

if (!configured && process.env.NODE_ENV === "production") {
  console.warn(
    "[stoveworks] SITE_URL is not set — falling back to https://stoveworksinc.com. " +
      "Sign-in links will point there.",
  );
}

export const siteUrl = configured || "https://stoveworksinc.com";

/**
 * Where a sign-in link may send someone afterwards. Only the customer's own
 * tools, as a same-site path — never a full URL, `//host` or a backslash trick —
 * so the parameter can't be turned into an open redirect.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200) return null;
  if (!/^\/(visualizer|account)\//.test(value)) return null;
  if (value.includes("//") || value.includes("\\")) return null;
  return value;
}
