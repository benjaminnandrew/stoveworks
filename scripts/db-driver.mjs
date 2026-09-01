/**
 * Standalone driver for the CLI scripts (migrate, seed).
 *
 * Deliberately independent of src/lib/db.ts: these run under plain node,
 * outside Next's module resolution and its `server-only` guard. Same rule
 * though — DATABASE_URL means real Postgres, otherwise PGlite.
 */

import net from "node:net";

/**
 * PGlite is a single-process database. If `npm run dev` is already holding
 * var/pgdata, a second connection here gets its own divergent view of the data —
 * writes made by one are invisible to the other. Catch that early; it is
 * otherwise a genuinely baffling half-hour.
 */
function devServerListening(port = 3014) {
  return new Promise((resolve) => {
    const socket = net
      .connect({ port, host: "127.0.0.1" })
      .setTimeout(300)
      .on("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .on("error", () => resolve(false))
      .on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
  });
}

export async function connect() {
  const url = process.env.DATABASE_URL;

  if (!url && !process.argv.includes("--force") && (await devServerListening())) {
    console.error(
      [
        "✗ The dev server is running and already holds the PGlite database.",
        "",
        "  Running this now would give the two processes divergent views of the",
        "  data. Stop `npm run dev` first, then re-run.",
        "",
        "  (Set DATABASE_URL to use a real Postgres, where this is a non-issue,",
        "   or pass --force if you know what you are doing.)",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (url) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({
      connectionString: url,
      ssl: /\bsslmode=disable\b/.test(url) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    return {
      label: `Postgres at ${url.replace(/:[^:@/]+@/, ":****@")}`,
      query: (sql, params = []) => client.query(sql, params),
      exec: (sql) => client.query(sql),
      close: () => client.end(),
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? "var/pgdata";
  const db = await PGlite.create({ dataDir: dir });
  return {
    label: `PGlite (local dev) at ${dir}`,
    query: async (sql, params = []) => {
      const res = await db.query(sql, params);
      return { rows: res.rows ?? [], rowCount: res.rows?.length ?? 0 };
    },
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}
