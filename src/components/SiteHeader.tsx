"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { business, primaryNav, servicesMenu, shopMenu, visualizeMenu } from "@/content/site";
import { BrandsMenu, ServicesMenu, ShopMenu, VisualizeMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { OpenStatus } from "./OpenStatus";
import { SavedLink } from "./ShortlistButtons";

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Caret() {
  return (
    <svg className="caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Every page each panel leads to, so the bar can show which section you're in. */
const sectionHrefs = {
  shop: [
    ...shopMenu.needs,
    ...shopMenu.heat,
    ...shopMenu.more,
    { href: "/hearth-accessories/" },
  ].map((l) => l.href),
  brands: ["/brands/"],
  visualize: visualizeMenu.map((l) => l.href),
  services: servicesMenu.map((l) => l.href),
};

type Menu = keyof typeof sectionHrefs;

const hoursSummary = "Mon–Fri 9–5 · Sat 10–2";

export function SiteHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<Menu | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The open menu as events see it (state lags a render behind), and when it opened.
  const openRef = useRef<Menu | null>(null);
  const openedAt = useRef(0);
  useEffect(() => {
    openRef.current = openMenu;
  }, [openMenu]);

  // On the home page the hero's badge is the logo; the bar's own stays away until most of the
  // badge has scrolled up under the header (Ben, 28 Oct 2026: one logo on screen at a time).
  const [logoAway, setLogoAway] = useState(pathname === "/");
  useEffect(() => {
    if (pathname !== "/") {
      setLogoAway(false);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const badge = [...document.querySelectorAll<HTMLElement>("[data-hero-badge]")].find((el) => el.offsetParent);
      const header = document.querySelector(".site-header");
      if (!badge || !header) return setLogoAway(false);
      const b = badge.getBoundingClientRect();
      setLogoAway(b.bottom - header.getBoundingClientRect().bottom > b.height * 0.35);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  const isActive = (item: (typeof primaryNav)[number]) =>
    item.menu
      ? sectionHrefs[item.menu].some((href) => pathname.startsWith(href))
      : pathname.startsWith(item.href);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const open = useCallback(
    (menu: Menu) => {
      cancelClose();
      if (openRef.current !== menu) openedAt.current = Date.now();
      openRef.current = menu;
      setOpenMenu(menu);
    },
    [cancelClose],
  );

  /**
   * A click on the word toggles its menu (Ben, 21 Oct): hover drops it down, a
   * click puts it away. A click within moments of the hover opening it was meant
   * to open it, so that one leaves it open.
   */
  const toggle = useCallback(
    (menu: Menu) => {
      if (openRef.current === menu && Date.now() - openedAt.current > 350) {
        cancelClose();
        openRef.current = null;
        setOpenMenu(null);
      } else {
        open(menu);
      }
    },
    [cancelClose, open],
  );

  // A short delay, so crossing the gap between the bar and its panel doesn't
  // snap the menu shut under the pointer.
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 160);
  }, [cancelClose]);

  useEffect(() => {
    cancelClose();
    setOpenMenu(null);
  }, [pathname, cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openMenu]);

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="topbar-item">
            <PinIcon />
            {business.streetShort} · {business.city}, Wisconsin
          </span>
          <span className="topbar-right">
            <OpenStatus fallback={hoursSummary} />
            <a className="topbar-phone" href={business.phoneHref}>
              {business.phoneDisplay}
            </a>
            {/* Manuals for owners; My designs holds what people save in the two visual
                tools (it was "My account"; Ben, 27 Oct 2026). */}
            <Link href="/guides/" className="topbar-account">
              Manuals
            </Link>
            <Link href="/account/" className="topbar-account">
              My designs
            </Link>
          </span>
        </div>
      </div>

      {/* One sticky row: logo, nav, call to action. The panels drop from its
          bottom edge, so it's the positioned ancestor they anchor to. */}
      <header className="site-header">
        <div className="wrap header-bar">
          <Link
            href="/"
            className={`header-logo${logoAway ? " is-away" : ""}`}
            aria-label={`${business.name} home`}
          >
            {/* The stove and "Hayward Stoveworks", cut from the badge's own artwork so it reads
                at bar height (Ben, 28 Oct 2026). Where the nav leaves too little room beside
                it, the round badge stands in. */}
            <Image
              className="header-logo-lockup"
              src="/images/logo-lockup.png"
              alt={`${business.name}, Hayward, Wisconsin, established 1975`}
              width={563}
              height={134}
              sizes="260px"
              priority
            />
            <Image
              className="header-logo-badge"
              src="/images/logo-badge.png"
              alt={`${business.name}, Hayward, Wisconsin, established 1975`}
              width={622}
              height={640}
              sizes="84px"
              loading="eager"
            />
          </Link>

          <nav className="primary-nav" aria-label="Main" onPointerLeave={scheduleClose}>
            <ul className="nav-list">
              {primaryNav.map((item) => {
                const active = isActive(item);
                const cls = `nav-link${active ? " is-active" : ""}`;

                if (!item.menu) {
                  return (
                    <li key={item.href} className="nav-item">
                      <Link
                        href={item.href}
                        className={cls}
                        aria-current={pathname === item.href ? "page" : undefined}
                        onPointerEnter={scheduleClose}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                }

                const menu = item.menu;
                const menuId = `menu-${menu}`;
                const isOpen = openMenu === menu;

                return (
                  <li
                    key={item.href}
                    className={`nav-item has-menu menu-${menu}${isOpen ? " is-open" : ""}`}
                    // Only the words open a menu (Ben, 21 Oct): the rest of the item's
                    // height is a bridge that keeps an open menu open on the way down
                    // to its panel, and never opens one.
                    onPointerEnter={() => {
                      if (isOpen) cancelClose();
                    }}
                    // React's onFocus/onBlur are focusin/focusout, so they bubble up
                    // from the links inside the panel too.
                    onFocus={() => open(menu)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
                    }}
                  >
                    {/* Every menu word is a disclosure button, never a link (Ben, 21 Oct):
                        hover opens its panel and a click toggles it. The section's own
                        pages are reached from inside the panel. */}
                    <button
                      type="button"
                      className={cls}
                      aria-expanded={isOpen}
                      aria-controls={menuId}
                      // Hover opens it; a click on the word puts it away again (see
                      // toggle). Escape, leaving, or tabbing away also close it.
                      onClick={() => toggle(menu)}
                      onPointerEnter={() => open(menu)}
                    >
                      {item.label}
                      <Caret />
                    </button>

                    {menu === "shop" ? (
                      <ShopMenu open={isOpen} id={menuId} />
                    ) : menu === "brands" ? (
                      <BrandsMenu open={isOpen} id={menuId} />
                    ) : menu === "services" ? (
                      <ServicesMenu open={isOpen} id={menuId} />
                    ) : (
                      <VisualizeMenu open={isOpen} id={menuId} />
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="header-actions">
            <SavedLink />
            <Link href="/search/" className="header-search" aria-label="Search the site">
              <SearchIcon />
            </Link>
            <Link href="/contact-us/" className="header-cta">
              Visit the showroom
            </Link>
            <MobileNav pathname={pathname} />
          </div>
        </div>
      </header>
    </>
  );
}
