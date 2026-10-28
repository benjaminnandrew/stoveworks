import Image from "next/image";
import Link from "next/link";

import { associations, business, mailtoHref } from "@/content/site";
import { ToTop } from "./ToTop";

export function SiteFooter() {
  return (
    <>
      <footer className="site-footer">
        <div className="footer-treeline" aria-hidden="true" />
        <div className="wrap footer-grid">
          <div className="footer-brand">
            <Image
              className="footer-logo"
              src="/images/logo-badge.png"
              alt={business.name}
              width={622}
              height={640}
              sizes="140px"
            />
            <p>{business.tagline}.</p>
          </div>

          <div>
            <h2 className="footer-title">Visit</h2>
            <address>
              {business.street}
              <br />
              {business.city}, {business.state} {business.zip}
            </address>
            <dl className="footer-hours">
              {business.hours.map((h) => (
                <div key={h.days}>
                  <dt>{h.days}</dt>
                  <dd>{h.time}</dd>
                </div>
              ))}
            </dl>
            <p className="footer-contact">
              <a href={business.phoneHref}>{business.phone}</a>
              <a href={mailtoHref}>Email us</a>
              <a href={business.facebook} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            </p>
          </div>

          <div>
            <h2 className="footer-title">Shop</h2>
            <ul className="footer-links">
              <li><Link href="/stoves/">Stoves</Link></li>
              <li><Link href="/inserts/">Inserts</Link></li>
              <li><Link href="/fireplaces/">Fireplaces</Link></li>
              <li><Link href="/brands/">Brands</Link></li>
              <li><Link href="/fireplace-walls-mantels/">Fireplace walls &amp; mantels</Link></li>
              <li><Link href="/hearth-accessories/">Hearth accessories</Link></li>
              <li><Link href="/outdoor/">Outdoor</Link></li>
              <li><Link href="/sauna-stoves/">Sauna stoves &amp; hot tubs</Link></li>
              <li><Link href="/home-cabin-decor/">Home &amp; cabin decor</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="footer-title">Plan &amp; install</h2>
            <ul className="footer-links">
              <li><Link href="/visualizer/">Room visualizer</Link></li>
              <li><Link href="/veneer/">Stone mock-up studio</Link></li>
              <li><Link href="/services/">Installation &amp; service</Link></li>
              <li><Link href="/guides/">Manuals</Link></li>
              <li><Link href="/account/">My designs</Link></li>
            </ul>
            <h2 className="footer-title footer-title-gap">Members of</h2>
            <ul className="assoc-row">
              {associations.map((a) => (
                <li key={a.name}>
                  <a href={a.href} target="_blank" rel="noopener noreferrer" title={a.name}>
                    <Image src={a.logo.src} alt={a.name} width={a.logo.width} height={a.logo.height} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>

      <div className="bottom-bar">
        <div className="wrap">
          <span>
            &copy; {new Date().getFullYear()} {business.name} · {business.city}, Wisconsin
          </span>
          <Link href="/contact-us/">Contact &amp; directions</Link>
        </div>
      </div>

      <ToTop />
    </>
  );
}
