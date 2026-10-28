"use client";

import Image from "next/image";
import Link from "next/link";

import { brandContent, brands } from "@/content/brands";
import { brandsForHref } from "@/content/nav-data";
import { business, servicesMenu, shopMenu, studioMenu } from "@/content/site";

/**
 * The panels that drop out of the nav bar.
 *
 * Shop is organised the way people arrive: the situation they're in, then the
 * product, then the tools that help them decide. Product links carry the brands
 * actually stocked on that page (derived from the page content), so the menu
 * says something real rather than repeating the link text.
 */
type PanelProps = { open: boolean; id: string };

function brandLine(href: string) {
  const brands = brandsForHref(href);
  if (!brands.length) return null;
  return brands.length > 3 ? `${brands.slice(0, 3).join(" · ")} +${brands.length - 3}` : brands.join(" · ");
}

export function ShopMenu({ open, id }: PanelProps) {
  return (
    // Closed panels are inert so the tab order doesn't run through hidden menus.
    <div id={id} className={`mega mega-shop${open ? " is-open" : ""}`} inert={!open}>
      <div className="wrap mega-grid">
        <div className="mega-col mega-needs">
          <p className="mega-head">What are you working with?</p>
          <ul>
            {shopMenu.needs.map((need) => (
              <li key={need.href}>
                <Link href={need.href} className="need-link">
                  <Image src={need.image} alt="" width={64} height={64} sizes="64px" />
                  <span>
                    <strong>{need.label}</strong>
                    <small>{need.blurb}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mega-col">
          <p className="mega-head">Stoves, inserts &amp; fireplaces</p>
          <ul className="product-list">
            {shopMenu.heat.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>
                  <strong>{link.label}</strong>
                  {brandLine(link.href) ? <small>{brandLine(link.href)}</small> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mega-col">
          <p className="mega-head">Hearth, sauna &amp; outdoor</p>
          <ul className="product-list is-compact">
            {shopMenu.more.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>
                  <strong>{link.label}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mega-col mega-tools">
          <p className="mega-head">Plan it</p>
          {shopMenu.tools.map((tool, i) => (
            <Link key={tool.href} href={tool.href} className={`tool-card${i === 0 ? " is-dark" : ""}`}>
              <strong>{tool.label}</strong>
              <small>{tool.blurb}</small>
            </Link>
          ))}
          <Link href="/contact-us/" className="tool-card is-visit">
            <strong>Visit the showroom</strong>
            <small>
              {business.streetShort}, {business.city}
            </small>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** What each brand is on the site for, from the product pages it appears on. */
function brandTypes(slug: string) {
  return brandContent(slug)
    .pages.map((p) => p.title)
    .join(" · ");
}

export function BrandsMenu({ open, id }: PanelProps) {
  return (
    <div id={id} className={`mega mega-brands${open ? " is-open" : ""}`} inert={!open}>
      <div className="wrap">
        <div className="mega-brands-head">
          <p className="mega-head">The makers we sell</p>
          <Link href="/brands/" className="mega-more">
            All brands &rarr;
          </Link>
        </div>
        <ul className="mega-brand-grid">
          {brands.map((b) => {
            const { logo } = brandContent(b.slug);
            return (
              <li key={b.slug}>
                <Link href={`/brands/${b.slug}/`} className="mega-brand">
                  <span className="mega-brand-logo">
                    {logo ? (
                      <Image src={logo.src} alt="" width={logo.width} height={logo.height} sizes="140px" />
                    ) : (
                      <span className="brand-wordmark" aria-hidden="true">
                        {b.name}
                      </span>
                    )}
                  </span>
                  <strong>{b.name}</strong>
                  <small>{brandTypes(b.slug)}</small>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Hearth Studio's two versions: online, and the showroom's touch screen (Ben, 28 Oct 2026). */
export function StudioMenu({ open, id }: PanelProps) {
  return (
    <div id={id} className={`mega mega-small${open ? " is-open" : ""}`} inert={!open}>
      <div className="mega-small-inner">
        {studioMenu.map((link) => (
          <Link key={link.href} href={link.href} className="small-link">
            <strong>{link.label}</strong>
            <small>{link.blurb}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Service & installation with its page's main sections, the manuals, and how to book (Ben,
 * 27 Oct 2026; a little more in it, 28 Oct 2026). The booking lines use the service page's own
 * words (src/content/services.ts, `book` and `gasSmell`).
 */
export function ServicesMenu({ open, id }: PanelProps) {
  const [service, manuals] = servicesMenu;
  return (
    <div id={id} className={`mega mega-small mega-services${open ? " is-open" : ""}`} inert={!open}>
      <div className="mega-services-inner">
        <div>
          <Link href={service.href} className="small-link">
            <strong>{service.label}</strong>
            <small>{service.blurb}</small>
          </Link>
          <ul className="services-sections">
            {service.sections?.map((s) => (
              <li key={s.href}>
                <Link href={s.href}>{s.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Link href={manuals.href} className="small-link">
            <strong>{manuals.label}</strong>
            <small>{manuals.blurb}</small>
          </Link>
          <div className="services-book">
            <p className="mega-head">Book service</p>
            <p>
              Call the shop to start: <a href={business.phoneHref}>{business.phoneDisplay}</a>
            </p>
            <Link href="/services/#gas-smell" className="services-gas">
              If you smell gas &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
