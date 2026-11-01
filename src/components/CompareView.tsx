"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import { business } from "@/content/site";
import type { CompareCell, CompareColumn, CompareRow } from "@/lib/compare";
import { compareHref, setCompare, toggle, useShortlist } from "@/lib/shortlist";

const GROUPS = [
  { key: "basics", title: "The basics", badge: "Makers’ figures" },
  { key: "stoveworks", title: "At Hayward Stoveworks", badge: null },
] as const;

/**
 * The comparison itself, after the Woodland site's (Ben, 22 Oct 2026): a table
 * of up to five on a desktop, any two side by side on a phone, rows that match
 * hidden on request, share, print, and a way to ask about them.
 */
export function CompareView({ columns, rows }: { columns: CompareColumn[]; rows: CompareRow[] }) {
  const router = useRouter();
  const saved = useShortlist("saved");
  const [hideSame, setHideSame] = useState(false);
  const [pair, setPair] = useState<[number, number]>([0, 1]);
  const [status, setStatus] = useState("");

  // The compare set becomes what's on this page, a shared link included.
  useEffect(() => {
    setCompare(columns.map((c) => c.item));
  }, [columns]);

  const values = (row: CompareRow) => columns.map((c) => c.cells[row.key]?.text ?? null);
  const matches = (row: CompareRow) => columns.length > 1 && values(row).every((v) => v === values(row)[0]);
  const shown = rows.filter((r) => values(r).some((v) => v !== null) && !(hideSame && matches(r)));

  const removeColumn = (id: string) => {
    const rest = columns.filter((c) => c.item.id !== id).map((c) => c.item);
    setCompare(rest);
    setPair([0, 1]);
    router.replace(rest.length ? compareHref(rest) : "/compare/", { scroll: false });
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Models to compare", url: location.href });
        return;
      }
      await navigator.clipboard.writeText(location.href);
      setStatus("Link copied. Paste it in a text or an email.");
    } catch {
      setStatus("Copy this page’s address to share it.");
    }
  };

  const allSaved = columns.every((c) => saved.some((s) => s.id === c.item.id));
  const saveAll = () => {
    for (const c of columns) if (!saved.some((s) => s.id === c.item.id)) toggle("saved", c.item);
    setStatus("Saved. Find them under Saved at the top of the page.");
  };

  const names = columns.map((c) => `- ${c.item.brand} ${c.item.name}`).join("\n");
  const ask = `mailto:${business.email}?subject=${encodeURIComponent("Comparing models")}&body=${encodeURIComponent(
    `I'm comparing these and would like to know more:\n\n${names}\n\n`,
  )}`;

  const a = Math.min(pair[0], columns.length - 1);
  const b = columns.length > 1 ? Math.min(pair[1], columns.length - 1) : -1;
  const phoneCols = b >= 0 && b !== a ? [columns[a], columns[b]] : [columns[a]];

  return (
    <div className="compare">
      <div className="compare-tools">
        <button type="button" role="switch" aria-checked={hideSame} className="compare-switch" onClick={() => setHideSame((v) => !v)}>
          <span className="compare-switch-track" aria-hidden="true" />
          Hide rows that match
        </button>
        <div className="compare-tools-end">
          <button type="button" className="tool" onClick={share}>
            Share
          </button>
          <button type="button" className="tool" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button type="button" className="tool" onClick={saveAll} disabled={allSaved}>
            {allSaved ? "All saved" : "Save all"}
          </button>
        </div>
      </div>
      <p className="compare-status" role="status">
        {status}
      </p>

      <div className="compare-desktop">
        <div className="compare-scroller">
          <table className="compare-table">
            <caption className="visually-hidden">Comparing {columns.length} models</caption>
            <thead>
              <tr>
                <td />
                {columns.map((c) => (
                  <th key={c.item.id} scope="col">
                    <Head column={c} onRemove={removeColumn} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const groupRows = shown.filter((r) => r.group === g.key);
                if (!groupRows.length) return null;
                return (
                  <Fragment key={g.key}>
                    <tr className="compare-group">
                      <th colSpan={columns.length + 1} scope="colgroup">
                        {g.title}
                        {g.badge ? <span className="compare-badge">{g.badge}</span> : null}
                      </th>
                    </tr>
                    {groupRows.map((r) => (
                      <tr key={r.key} className={matches(r) ? "is-same" : undefined}>
                        <th scope="row">
                          {r.label}
                          {r.hint ? <span className="compare-hint">{r.hint}</span> : null}
                        </th>
                        {columns.map((c) => (
                          <td key={c.item.id}>
                            <Cell cell={c.cells[r.key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="compare-phone">
        {columns.length > 2 ? (
          <div className="compare-pick">
            {([0, 1] as const).map((slot) => (
              <label key={slot}>
                <span>{slot === 0 ? "Showing" : "and"}</span>
                <select
                  value={slot === 0 ? a : b}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPair((p) => (slot === 0 ? [v, p[1]] : [p[0], v]));
                  }}
                >
                  {columns.map((c, i) => (
                    <option key={c.item.id} value={i}>
                      {c.item.brand} {c.item.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}
        <div className="compare-board" style={{ "--cols": phoneCols.length } as React.CSSProperties}>
          <div className="compare-mhead">
            {phoneCols.map((c) => (
              <Head key={c.item.id} column={c} onRemove={removeColumn} />
            ))}
          </div>
          {GROUPS.map((g) => {
            const groupRows = shown.filter((r) => r.group === g.key);
            if (!groupRows.length) return null;
            return (
              <Fragment key={g.key}>
                <p className="compare-mgroup">
                  {g.title}
                  {g.badge ? <span className="compare-badge">{g.badge}</span> : null}
                </p>
                {groupRows.map((r) => (
                  <div key={r.key} className="compare-mrow">
                    <p className="compare-mlabel">{r.label}</p>
                    {phoneCols.map((c) => (
                      <p key={c.item.id} className="compare-mvalue">
                        <Cell cell={c.cells[r.key]} />
                      </p>
                    ))}
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="compare-foot">
        <p>
          <strong>Want to see {columns.length > 1 ? "these" : "it"} in person?</strong> Ask us about{" "}
          {columns.length > 1 ? "them" : "it"}, or call <a href={business.phoneHref}>{business.phoneDisplay}</a>, and
          we&rsquo;ll tell you what&rsquo;s on the showroom floor.
        </p>
        <a className="btn" href={ask}>
          Ask about {columns.length > 1 ? "these" : "this one"}
        </a>
      </div>
      <p className="compare-footnote">
        Figures are the makers&rsquo; own, from their websites and manuals, and can change. Each model&rsquo;s page
        links to the maker&rsquo;s full specs and our owner &amp; installer guide.
      </p>
    </div>
  );
}

function Head({ column, onRemove }: { column: CompareColumn; onRemove: (id: string) => void }) {
  const { item } = column;
  return (
    <div className="compare-head">
      <Link href={item.href} className="compare-photo" tabIndex={-1} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.photo ? <img src={item.photo} alt="" /> : null}
      </Link>
      <Link href={item.href} className="compare-name">
        {item.brand} {item.name}
      </Link>
      <span className="compare-meta">{column.typeLine}</span>
      {/* Only where Hearth Studio can show this very model in its room, as on its page (Ben, 1 Nov 2026). */}
      {column.studio ? (
        <a className="compare-studio" href={`/hearth-studio/?stove=${encodeURIComponent(column.studio)}`}>
          See it in a room &rarr;
        </a>
      ) : null}
      <button
        type="button"
        className="compare-remove"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove the ${item.brand} ${item.name} from the comparison`}
      >
        Remove
      </button>
    </div>
  );
}

function Cell({ cell }: { cell: CompareCell }) {
  if (!cell) return <span className="compare-na">&mdash;</span>;
  if (!cell.href) return <>{cell.text}</>;
  return (
    <a href={cell.href} {...(cell.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {cell.text}
    </a>
  );
}
