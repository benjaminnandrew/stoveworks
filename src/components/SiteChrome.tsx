"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Pages that fill the screen and bring their own top bar: Hearth Studio, on the website and on
 * the showroom's touch screen (28 Oct 2026). The site's header, footer and floating trays stay
 * off them; on a phone every pixel of height goes to the picture.
 */
const BARE = ["/hearth-studio", "/showroom"];

export const isBarePath = (pathname: string) => BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Its children, everywhere but the full-screen pages. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return isBarePath(usePathname()) ? null : children;
}
