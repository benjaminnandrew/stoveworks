/**
 * Canonical origin for metadata, sitemap and JSON-LD.
 * Set SITE_URL in the environment on the deployed VM.
 */
export const siteUrl = (process.env.SITE_URL ?? "https://stoveworksinc.com").replace(/\/$/, "");
