import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { ModelCard } from "@/components/ModelCard";
import { SearchBox } from "@/components/SearchBox";
import { brandBySlug } from "@/content/brands";
import { getModelSummaries } from "@/lib/catalog";
import type { SearchRequest, SearchSource } from "@/lib/search/contract";
import { visitorOf } from "@/lib/search/guard";
import { search } from "@/lib/search/run";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search/" },
};

type Props = { searchParams: Promise<{ q?: string; from?: string }> };

const SURFACES = new Set(["home", "header", "page", "drawer"]);

/** Ideas for an empty search: real names and real questions the guides answer. */
const EXAMPLES = ["Jøtul F 500", "gas inserts", "clean the glass on my Ashford 20.2", "Kozy Heat pilot won't light", "hours"];

function SourceList({ items, heading }: { items: SearchSource[]; heading: string }) {
  if (!items.length) return null;
  return (
    <section className="search-group" aria-label={heading}>
      <h2>{heading}</h2>
      <ul className="search-list">
        {items.map((s) => (
          <li key={`${s.kind}|${s.id}`} className={s.audience === "installer" ? "is-installer" : undefined}>
            <a href={s.url}>
              <strong>{s.title}</strong>
              {s.detail ? <small>{s.detail}</small> : null}
              {s.snippet ? <span className="search-snippet">…{s.snippet}…</span> : null}
              {s.kind === "guide_section" && s.page ? <span className="search-page">Manual p. {s.page}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", from = "page" } = await searchParams;
  const text = q.trim().slice(0, 300);
  const surface = (SURFACES.has(from) ? from : "page") as SearchRequest["surface"];

  const ran = text ? await search({ message: text, surface }, visitorOf(await headers())) : null;
  const res = ran?.response;
  const sources = res?.sources ?? [];
  const of = (kind: SearchSource["kind"]) => sources.filter((s) => s.kind === kind);

  const modelSources = of("model");
  const models = await getModelSummaries(modelSources.map((s) => s.id)).catch(() => []);
  const sections = of("guide_section");
  const manual = of("manual_page");
  const places = [...of("brand"), ...of("page")];
  const answerFirst = res?.kind === "answer";

  const cards = models.length ? (
    <section className="search-group" aria-label="Models">
      <h2>{models.length === 1 ? "The model" : "Models"}</h2>
      <div className="lineup-grid">
        {models.map((m) => (
          <ModelCard key={m.id} model={m} brandName={brandBySlug(m.brand_slug)?.name ?? m.brand_name} />
        ))}
      </div>
    </section>
  ) : null;

  return (
    <>
      <div className="page-title search-head">
        <div className="wrap">
          <h1>{text ? "Search" : "Search the site"}</h1>
          <SearchBox variant="hero" surface="page" defaultValue={text} autoFocus={!text} />
        </div>
      </div>

      <div className="page-body">
        <div className="wrap search-results">
          {!text ? (
            <div className="search-empty">
              <p>Type or say a brand, a model, or a question about your stove. For example:</p>
              <ul className="search-examples">
                {EXAMPLES.map((e) => (
                  <li key={e}>
                    <Link href={`/search/?q=${encodeURIComponent(e)}`}>{e}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className={`search-reply is-${res?.kind}`} role="status">
                {res?.reply}
              </p>

              {res?.choices.length ? (
                <ul className="search-choices">
                  {res.choices.map((c) => (
                    <li key={c.message}>
                      <Link href={`/search/?q=${encodeURIComponent(c.message)}&from=${surface}`}>{c.label}</Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {answerFirst ? (
                <>
                  <SourceList items={sections} heading="From the owner & installer guides" />
                  <SourceList items={manual} heading="In the maker's manual" />
                  <SourceList items={places} heading="On our site" />
                  {cards}
                </>
              ) : (
                <>
                  <SourceList items={places} heading="On our site" />
                  {cards}
                  <SourceList items={sections} heading="From the owner & installer guides" />
                  <SourceList items={manual} heading="In the maker's manual" />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
