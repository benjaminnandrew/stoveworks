"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SearchBox } from "@/components/SearchBox";
import { brands } from "@/content/brands";
import { business, mailtoHref, shopMenu, visualizeMenu } from "@/content/site";

/** The drawer lists everything the desktop panels do, grouped the same way. */
const groups = [
  {
    title: "Stoves, inserts & fireplaces",
    links: shopMenu.heat,
  },
  {
    title: "Brands",
    links: [
      ...brands.map((b) => ({ label: b.name, href: `/brands/${b.slug}/` })),
      { label: "All brands", href: "/brands/" },
    ],
    cols: true,
  },
  { title: "Hearth, sauna & outdoor", links: shopMenu.more },
  { title: "Visualize", links: visualizeMenu },
  {
    title: "Hayward Stoveworks",
    links: [
      { label: "Services", href: "/services/" },
      { label: "Manuals", href: "/guides/" },
      { label: "Home & cabin decor", href: "/home-cabin-decor/" },
      { label: "Visit & contact", href: "/contact-us/" },
    ],
  },
];

export function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // The drawer is portalled to <body>, which only exists in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on route change.
  useEffect(() => setOpen(false), [pathname]);

  // Lock scroll, trap focus loosely, and close on Escape while open.
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="mobile-drawer"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bar" />
        <span className="bar" />
        <span className="bar" />
      </button>

      {/* Portalled to <body>: the sticky header has a backdrop-filter, and that
          turns it into the containing block for fixed-position children, which
          trapped the whole drawer inside the 64px header bar. Inside it, a fixed,
          clipped layer: the drawer parks off-screen to the right, and without
          the clip it widens the page on phones. */}
      {mounted
        ? createPortal(
            <div className="drawer-root">
              <div
                className={`drawer-scrim${open ? " is-open" : ""}`}
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />

              <div
                id="mobile-drawer"
                ref={drawerRef}
                className={`drawer${open ? " is-open" : ""}`}
                role="dialog"
                aria-modal={open || undefined}
                aria-label="Site menu"
                inert={!open}
              >
                <div className="drawer-head">
                  <span className="drawer-title">Menu</span>
                  <button
                    type="button"
                    className="drawer-close"
                    onClick={() => {
                      setOpen(false);
                      toggleRef.current?.focus();
                    }}
                    aria-label="Close menu"
                  >
                    <span className="bar" />
                    <span className="bar" />
                  </button>
                </div>

                <div className="drawer-body">
                  <div className="drawer-search">
                    <SearchBox variant="drawer" surface="drawer" placeholder="Search or ask" />
                  </div>
                  <p className="drawer-group-title">What are you working with?</p>
                  <ul className="drawer-needs">
                    {shopMenu.needs.map((need) => (
                      <li key={need.href}>
                        <Link href={need.href} aria-current={current(need.href)}>
                          <strong>{need.label}</strong>
                          <small>{need.blurb}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {groups.map((group) => (
                    <div key={group.title} className="drawer-group">
                      <p className="drawer-group-title">{group.title}</p>
                      <ul className={`drawer-nav${"cols" in group ? " is-cols" : ""}`}>
                        {group.links.map((link) => (
                          <li key={link.href + link.label}>
                            <Link href={link.href} aria-current={current(link.href)}>
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div className="drawer-contact">
                    <a href={business.phoneHref} className="drawer-call">
                      Call {business.phoneDisplay}
                    </a>
                    <a href={mailtoHref}>Email us</a>
                    <Link href="/account/">My designs</Link>
                    <span>
                      {business.street}, {business.city}
                    </span>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
