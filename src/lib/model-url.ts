/**
 * A model's own page: /brands/blaze-king/ashford-20-2/. The catalog id is the
 * brand's slug plus the model's, so the address follows from the data and a
 * model added to the brain has a page as soon as it's loaded.
 */

type ModelRef = { id: string; brand_slug: string };

export const modelSlug = ({ id, brand_slug }: ModelRef) =>
  id.startsWith(`${brand_slug}-`) ? id.slice(brand_slug.length + 1) : id;

export const modelHref = (m: ModelRef) => `/brands/${m.brand_slug}/${modelSlug(m)}/`;
