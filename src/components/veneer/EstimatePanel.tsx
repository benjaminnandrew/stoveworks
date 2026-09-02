"use client";

import {
  estimateRegion,
  WASTE_ALLOWANCE,
  type Estimate,
  type Region,
  type StoneSwatch,
} from "@/lib/veneer-types";

const sqft = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} sq ft`;
const lnft = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} lin ft`;

/**
 * Turns the marked areas into a material list.
 *
 * Everything here follows from the real width and height the customer entered
 * for each area, so it is only as good as those measurements — which the copy
 * says plainly. It is a starting point for a quote, not a quote.
 */
export function EstimatePanel({
  total,
  regions,
  stones,
}: {
  total: Estimate & { regions: number };
  regions: Region[];
  stones: Map<string, StoneSwatch>;
}) {
  const anyBoxes = total.flatBoxes !== null || total.cornerBoxes !== null;

  return (
    <section className="estimate" aria-label="Material estimate">
      <h2>Material estimate</h2>

      <dl className="estimate-figures">
        <div>
          <dt>Area to cover</dt>
          <dd>{sqft(total.netSqft)}</dd>
        </div>
        {total.openingsSqft > 0.05 ? (
          <div>
            <dt>Openings deducted</dt>
            <dd>−{sqft(total.openingsSqft)}</dd>
          </div>
        ) : null}
        {total.cornerLnft > 0.05 ? (
          <div>
            <dt>Outside corners</dt>
            <dd>{lnft(total.cornerLnft)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Flats needed</dt>
          <dd>{sqft(total.flatSqft)}</dd>
        </div>
      </dl>

      <p className="estimate-waste">
        With the usual {Math.round(WASTE_ALLOWANCE * 100)}% allowance for cuts and breakage:{" "}
        <strong>{sqft(total.flatSqftWithWaste)}</strong> of flats
        {total.cornerLnftWithWaste > 0.05 ? (
          <>
            {" "}
            and <strong>{lnft(total.cornerLnftWithWaste)}</strong> of corners
          </>
        ) : null}
        .
      </p>

      {anyBoxes ? (
        <p className="estimate-boxes">
          Roughly{" "}
          {total.flatBoxes !== null ? (
            <strong>
              {total.flatBoxes} {total.flatBoxes === 1 ? "box" : "boxes"} of flats
            </strong>
          ) : null}
          {total.flatBoxes !== null && total.cornerBoxes ? " and " : null}
          {total.cornerBoxes ? (
            <strong>
              {total.cornerBoxes} {total.cornerBoxes === 1 ? "box" : "boxes"} of corners
            </strong>
          ) : null}
          .
        </p>
      ) : null}

      {regions.length > 1 ? (
        <ul className="estimate-breakdown">
          {regions.map((region, i) => {
            const stone = stones.get(region.stoneId);
            const e = estimateRegion(region, stone);
            return (
              <li key={region.id}>
                <span>
                  Area {i + 1} — {stone?.texture ?? "stone"}
                </span>
                <span>{sqft(e.netSqft)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="estimate-caveat">
        An estimate from the sizes you entered, using typical coverage figures. We&rsquo;ll confirm
        quantities against the current coverage chart before anything is ordered.
      </p>
    </section>
  );
}
