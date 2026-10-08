"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { business, nav, type NavItem } from "@/content/site";
import { MegaMenu } from "./MegaMenu";
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
  const [openHref, setOpenHref] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nav hrefs end in a slash (next.config trailingSlash), so a prefix match covers
  // the page and everything under it. Children are checked too, because some menu
  // entries (/outdoor/, /sauna-stoves/) sit at the top level of the URL tree.
  const isActive = (item: NavItem) =>
    [item.href, ...(item.children?.map((c) => c.href) ?? [])].some((href) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href),
    );

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const open = useCallback(
    (href: string) => {
      cancelClose();
      setOpenHref(href);
    },
    [cancelClose],
  );

  // A small delay, so crossing the gap between the nav item and its panel does
  // not snap the menu shut under the pointer.
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenHref(null), 160);
  }, [cancelClose]);

  // Any navigation closes whatever was open.
  useEffect(() => {
    cancelClose();
    setOpenHref(null);
  }, [pathname, cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    if (!openHref) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenHref(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openHref]);

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="topbar-item">
            <PinIcon />
            {business.streetShort} ~ {business.city}, {business.state}
          </span>
          <span className="topbar-right">
            <Link href="/account/" className="topbar-account">
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
              height={528}
              sizes="(max-width: 640px) 200px, 210px"
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
            {nav.map((item) => {
              const hasMenu = Boolean(item.children?.length);
              const menuId = `mega-${item.href.replace(/\W+/g, "-")}`;
              const isOpen = hasMenu && openHref === item.href;

              return (
                <li
                  key={item.href}
                  className={`nav-item${hasMenu ? " has-children" : ""}${isOpen ? " is-open" : ""}`}
                  onPointerEnter={hasMenu ? () => open(item.href) : undefined}
                  onPointerLeave={hasMenu ? scheduleClose : undefined}
                  // Opening on focus keeps the menu usable by keyboard without
                  // turning the parent link into a button. React maps onFocus /
                  // onBlur to focusin / focusout, which bubble from the links
                  // inside — the capture variants do not reach here.
                  onFocus={hasMenu ? () => open(item.href) : undefined}
                  onBlur={
                    hasMenu
                      ? (e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                            scheduleClose();
                          }
                        }
                      : undefined
                  }
                >
                  <Link
                    href={item.href}
                    className={`nav-link${isActive(item) ? " is-active" : ""}`}
                    aria-current={pathname === item.href ? "page" : undefined}
                    aria-expanded={hasMenu ? isOpen : undefined}
                    aria-controls={hasMenu ? menuId : undefined}
                  >
                    {item.label}
                  </Link>

                  {hasMenu ? <MegaMenu item={item} open={isOpen} id={menuId} /> : null}
                </li>
              );
            })}
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
