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
