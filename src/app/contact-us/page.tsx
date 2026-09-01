import type { Metadata } from "next";
import Link from "next/link";

import { business, mailtoHref } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Visit The Stove Works at ${business.street}, ${business.city}, ${business.state} ${business.zip}. Call ${business.phone} or stop in — hours, directions and map.`,
  alternates: { canonical: "/contact-us" },
};

export default function ContactPage() {
  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Contact Us</h1>
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <span aria-current="page">Contact Us</span>
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <p className="notice">
            <strong>Please Note:</strong> We choose not to sell our stoves or quote prices over the
            internet outside of our normal territory in Northern Wisconsin due to installation and
            warranty issues.
          </p>

          <div className="contact-grid">
            <section className="contact-card">
              <h2>Get In Touch</h2>
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
                <a href={mailtoHref}>Email Us</a>
                {" | "}
                <a href={business.facebook} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              </address>
            </section>

            <section className="contact-card">
              <h2>Business Hours</h2>
              <dl className="hours-list">
                {business.hours.map((h) => (
                  <div key={h.days} style={{ display: "contents" }}>
                    <dt>{h.days}</dt>
                    <dd>{h.time}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="contact-card">
              <h2>Visit Us</h2>
              <div className="map-frame">
                <iframe
                  src={business.mapEmbed}
                  title={`Map to ${business.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
