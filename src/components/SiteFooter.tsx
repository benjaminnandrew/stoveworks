import Image from "next/image";

import { associations, business, mailtoHref } from "@/content/site";
import { ToTop } from "./ToTop";

export function SiteFooter() {
  return (
    <>
      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <Image
                src="/images/logo-sw-footer-2.jpg"
                alt={business.name}
                width={263}
                height={91}
              />
            </div>

            <div>
              <h2 className="footer-title">Get In Touch</h2>
              <address>
                <strong>{business.name.replace(/, Inc\.$/, ", Inc")}</strong>
                <br />
                {business.street}
                <br />
                {business.city}, {business.state} {business.zip}
                <br />
                Phone: <a href={business.phoneHref}>{business.phone}</a>
                <br />
                Fax: {business.fax}
                <br />
                <a href={mailtoHref}>Email Us</a>{" | "}
                <a href={business.facebook} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              </address>
            </div>

            <div>
              <h2 className="footer-title">Associations</h2>
              <ul className="assoc-grid">
                {associations.map((a) => (
                  <li key={a.name}>
                    <a href={a.href} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={a.logo.src}
                        alt={a.name}
                        width={a.logo.width}
                        height={a.logo.height}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="footer-title">Visit Us!</h2>
              <div className="map-frame">
                <iframe
                  src={business.mapEmbed}
                  title={`Map to ${business.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </footer>

      <div className="bottom-bar">
        <div className="wrap">
          <span>
            &copy; Copyright {new Date().getFullYear()} - {business.name}
          </span>
          <span>
            <a href="https://ccsdirect.net" target="_blank" rel="noopener noreferrer">
              Web Design by CCS, Inc.
            </a>
          </span>
        </div>
      </div>

      <ToTop />
    </>
  );
}
