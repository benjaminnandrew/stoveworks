"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { business, mailtoHref, nav } from "@/content/site";

export function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

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

        <ul className="drawer-nav">
          <li>
            <Link href="/" aria-current={current("/")}>
              Home
            </Link>
          </li>
          {nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={current(item.href)}>
                {item.label}
              </Link>
              {item.children ? (
                <ul className="sub">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link href={child.href} aria-current={current(child.href)}>
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="drawer-contact">
          <Link href="/account" className="drawer-account">
            My Account
          </Link>
          <a href={business.phoneHref}>{business.phone}</a>
          <br />
          <a href={mailtoHref}>Email Us</a>
          <br />
          {business.street}
          <br />
          {business.city}, {business.state} {business.zip}
        </div>
      </div>
    </>
  );
}
