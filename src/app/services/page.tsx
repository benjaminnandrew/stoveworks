import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { JumpBar, type JumpItem } from "@/components/JumpBar";
import { brands } from "@/content/brands";
import { plainText, service } from "@/content/services";
import { business } from "@/content/site";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: service.metaTitle,
  description: service.description,
  alternates: { canonical: "/services/" },
  openGraph: { title: service.metaTitle, url: "/services/", images: [SHARE_IMAGE] },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
    { "@type": "ListItem", position: 2, name: service.title, item: `${siteUrl}/services/` },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: service.questions.items.map((i) => ({
    "@type": "Question",
    name: i.q,
    acceptedAnswer: { "@type": "Answer", text: plainText(i.a) },
  })),
};

/**
 * Services (Ben's handoff, 27 Oct 2026). Booking starts with a phone call, so the page's one
 * action is "Call to book"; the gas-smell steps sit beside the booking box, not at the bottom.
 * The copy is in src/content/services.ts.
 */
export default function ServicesPage() {
  const { book, gasSmell, questions } = service;
  const jump: JumpItem[] = [
    ...[...service.sections, questions].map((s) => ({ id: s.id, label: s.nav ?? s.heading })),
    { id: gasSmell.id, label: gasSmell.heading, spy: false, alert: true },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <div className="page-title service-hero">
        <div className="wrap">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <span aria-current="page">{service.title}</span>
              </li>
            </ol>
          </nav>
          <h1>{service.headline}</h1>
          <p className="page-lede">{service.intro}</p>
          <a className="btn" href={business.phoneHref}>
            {service.cta}
          </a>
        </div>
      </div>

      <JumpBar items={jump} />

      <div className="page-body">
        <div className="wrap service-layout">
          <aside className="service-aside">
            <section className="service-book" aria-labelledby="book-heading">
              <h2 id="book-heading">{book.heading}</h2>
              <ul>
                {book.items.map((i) => (
                  <li key={i.label}>
                    <strong>{i.label}</strong> <span dangerouslySetInnerHTML={{ __html: i.html }} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="service-gas" id={gasSmell.id} aria-labelledby="gas-heading">
              <h2 id="gas-heading">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M12 3 2 21h20L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M12 10v5M12 17.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {gasSmell.heading}
              </h2>
              <p>{gasSmell.intro}</p>
              <ul>
                {gasSmell.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          </aside>

          <div className="service-main">
            {service.sections.map((s) => (
              <section key={s.id} id={s.id} className="service-section prose" aria-labelledby={`${s.id}-heading`}>
                <h2 id={`${s.id}-heading`}>{s.heading}</h2>
                {s.lead ? <p>{s.lead}</p> : null}
                {s.brandList ? (
                  <ul className="service-brands">
                    {brands.map((b) => (
                      <li key={b.slug}>
                        <Link href={`/brands/${b.slug}/`}>{b.name}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div dangerouslySetInnerHTML={{ __html: s.html }} />
              </section>
            ))}

            <section id={questions.id} className="service-section service-faq" aria-labelledby="questions-heading">
              <h2 id="questions-heading">{questions.heading}</h2>
              {questions.items.map((i) => (
                <details key={i.q}>
                  <summary>{i.q}</summary>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: `<p>${i.a}</p>` }} />
                </details>
              ))}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
