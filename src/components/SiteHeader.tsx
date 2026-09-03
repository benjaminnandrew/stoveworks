"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { business, nav } from "@/content/site";
import { MobileNav } from "./MobileNav";

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.5-8 5.5V21a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-3-3.6-5.5-8-5.5Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="topbar-item">
            <PinIcon />
            {business.streetShort} ~ {business.city}, {business.state}
          </span>
          <span className="topbar-right">
            <Link href="/account" className="topbar-account">
              <UserIcon />
              My Account
            </Link>
            <a className="topbar-phone" href={business.phoneHref}>
              CALL US! {business.phoneDisplay}
            </a>
          </span>
        </div>
      </div>

      <div className="masthead">
        <div className="wrap">
          <Link href="/" className="masthead-logo" aria-label={`${business.name} home`}>
            <Image
              src="/images/logo-hayward-stoveworks.png"
              alt={`${business.name} — ${business.tagline}`}
              width={1200}
              height={655}
              sizes="(max-width: 640px) 190px, 300px"
              priority
            />
          </Link>

          <div className="masthead-hours">
            <strong>Business Hours:</strong>
            <br />
            {business.hours.map((h) => (
              <span key={h.days}>
                {h.time === "Closed" ? `Closed ${h.days}s` : `${h.time} ${h.days}`}
                <br />
              </span>
            ))}
          </div>

          <MobileNav pathname={pathname} />
        </div>
      </div>

      <nav className="primary-nav" aria-label="Main">
        <div className="wrap">
          <ul className="nav-list">
            {nav.map((item) => (
              <li key={item.href} className={`nav-item${item.children ? " has-children" : ""}`}>
                <Link
                  href={item.href}
                  className={`nav-link${isActive(item.href) ? " is-active" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>

                {item.children ? (
                  <ul className="subnav">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={pathname === child.href ? "page" : undefined}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
            <li className="nav-item">
              <Link
                href="/"
                className={`nav-link${pathname === "/" ? " is-active" : ""}`}
                aria-current={pathname === "/" ? "page" : undefined}
              >
                Home
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}
