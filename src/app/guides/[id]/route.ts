import { brandBySlug } from "@/content/brands";
import { getGuideHtml, listGuideModels } from "@/lib/catalog";
import { themeGuide } from "@/lib/guide-theme";
import { modelHref } from "@/lib/model-url";

/**
 * The owner & installer guides: /guides/<id>/.
 *
 * Each guide is one self-contained page (its own styles, search and drawers),
 * loaded into catalog_guides by `npm run brain:load`, so it's served whole
 * rather than inside the site's layout, dressed in the site's theme on the way
 * out (src/lib/guide-theme.ts). Its manual links point at /files/, where the
 * PDFs open at the cited page.
 */

type Params = { params: Promise<{ id: string }> };

function page(status: number, title: string, message: string): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title} · Hayward Stoveworks</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:17px/1.5 system-ui,sans-serif;background:#f6f3ee;color:#22201c}main{max-width:32rem}a{color:inherit}@media (prefers-color-scheme:dark){body{background:#171513;color:#efe9e1}}</style>
</head><body><main><h1>${title}</h1><p>${message}</p><p><a href="/">Hayward Stoveworks home</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(id)) {
    return page(404, "Guide not found", "We don't have a guide at that address.");
  }

  let html: string | null;
  try {
    html = await getGuideHtml(id);
  } catch (err) {
    console.error(`[guides] ${id}:`, err);
    return page(503, "Guides are unavailable", "Please try again in a few minutes.");
  }
  if (!html) return page(404, "Guide not found", "We don't have a guide at that address.");

  // Our page for each model the guide covers, where the model has one (the model page's rule: a
  // catalog brand and the public lineup). A failed lookup only costs the link, not the guide.
  const models = (await listGuideModels(id).catch((err) => {
    console.error(`[guides] ${id} models:`, err);
    return [];
  }))
    .filter((m) => brandBySlug(m.brand_slug)?.inCatalog)
    .map((m) => ({ brand: brandBySlug(m.brand_slug)?.name ?? m.brand_name, name: m.name, href: modelHref(m) }));

  return new Response(themeGuide(html, { models }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
