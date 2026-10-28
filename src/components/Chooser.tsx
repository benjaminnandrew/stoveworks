"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { shopMenu } from "@/content/site";

type Fuel = "wood" | "gas" | "electric";

/**
 * Where each situation + fuel lands. Only fuels the site actually lists for that
 * situation are offered: there are no electric inserts or stoves on the site, so
 * electric only appears for fireplaces.
 */
const ROUTES: Record<string, Partial<Record<Fuel, string>>> = {
  "/inserts/": { wood: "/inserts/wood-inserts/", gas: "/inserts/gas-inserts/" },
  "/stoves/": { wood: "/stoves/wood-stoves/", gas: "/stoves/gas-stoves/" },
  "/fireplaces/": {
    wood: "/fireplaces/wood-fireplaces/",
    gas: "/fireplaces/gas-fireplaces/",
    electric: "/fireplaces/electric-fireplaces/",
  },
  "/fireplace-walls-mantels/": {},
};

const FUEL_LABEL: Record<Fuel, string> = { wood: "Wood", gas: "Gas", electric: "Electric" };

/**
 * "What are you working with?" Each tile is a real link to its section, so it
 * works before (or without) JavaScript; once hydrated, a click selects it and
 * offers a fuel to narrow down to the right page.
 */
export function Chooser() {
  const router = useRouter();
  const [need, setNeed] = useState<string | null>(null);
  const [fuel, setFuel] = useState<Fuel | null>(null);

  const fuels = need ? (Object.keys(ROUTES[need] ?? {}) as Fuel[]) : [];
  const destination = need ? (fuel && ROUTES[need]?.[fuel]) || need : null;

  return (
    <div className="chooser">
      <p className="chooser-q" id="chooser-q">
        What are you working with?
        {need ? null : <span className="chooser-hint"> Pick one and we&rsquo;ll narrow it down by fuel.</span>}
      </p>
      <ul className="chooser-tiles" aria-labelledby="chooser-q">
        {shopMenu.needs.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              className={`chooser-tile${need === n.href ? " is-selected" : ""}`}
              onClick={(e) => {
                // A situation with nothing to narrow goes straight there.
                if (!Object.keys(ROUTES[n.href] ?? {}).length) return;
                e.preventDefault();
                setNeed(n.href);
                setFuel(null);
              }}
            >
              <Image src={n.image} alt="" width={64} height={64} sizes="64px" />
              <span>
                <strong>{n.label}</strong>
                <small>{n.blurb}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* The fuel row takes room only once a situation is picked, so the hero stays short. */}
      <div className={`chooser-fuel${need ? " is-ready" : ""}`} aria-live="polite">
        {need ? (
          <>
            <span className="chooser-fuel-label">Fuel</span>
            {fuels.map((f) => (
              <button
                key={f}
                type="button"
                className={`pill${fuel === f ? " is-on" : ""}`}
                aria-pressed={fuel === f}
                onClick={() => setFuel(f)}
              >
                {FUEL_LABEL[f]}
              </button>
            ))}
            <button
              type="button"
              className={`pill${fuel === null ? " is-on" : ""}`}
              aria-pressed={fuel === null}
              onClick={() => setFuel(null)}
            >
              Not sure
            </button>
            <button type="button" className="btn chooser-go" onClick={() => destination && router.push(destination)}>
              Show me &rarr;
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
