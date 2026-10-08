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
 * Everything here follows from each area's real width and height — typed in by
 * the customer, read off their scale, or (before either) guessed from the
 * photo — so it is only as good as those sizes, and the copy says which they
 * are. It is a starting point for a quote, not a quote.
 */
export type SizeBasis = "measured" | "scale" | "guess";

const CAVEAT: Record<SizeBasis, string> = {
  measured: "An estimate from the sizes you entered, using typical coverage figures.",
  scale: "An estimate from sizes read off your photo's scale, using typical coverage figures — measure the wall to firm it up.",
  guess:
    "A rough estimate: these sizes are guessed from the photo until you set the scale or enter measurements.",
};

export function EstimatePanel({
  total,
  regions,
  stones,
  areaNumbers,
  basis,
}: {
  total: Estimate & { regions: number };
  regions: Region[];
  stones: Map<string, StoneSwatch>;
  /** Each area's number in the design, so a view that skips one still labels the rest right. */
  areaNumbers: Map<string, number>;
  basis: SizeBasis;
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
                  Area {areaNumbers.get(region.id) ?? i + 1} — {stone?.texture ?? "stone"}
                </span>
                <span>{sqft(e.netSqft)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="estimate-caveat">
        {CAVEAT[basis]} We&rsquo;ll confirm quantities against the current coverage chart before
        anything is ordered.
      </p>
    </section>
  );
}
