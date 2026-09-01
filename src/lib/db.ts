import "server-only";

/**
 * One SQL surface, two drivers.
 *
 * Production sets DATABASE_URL and talks to a real Postgres via `pg`.
 * Local development with no DATABASE_URL falls back to PGlite — Postgres 18
 * compiled to WASM, persisted under var/pgdata — so the same schema, the same
 * SQL and the same migrations run everywhere without installing a server.
 */

type Row = Record<string, unknown>;

export type QueryResult<T extends Row = Row> = { rows: T[]; rowCount: number };

interface Driver {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

const PGDATA_DIR = process.env.PGLITE_DIR ?? "var/pgdata";

async function createPgDriver(connectionString: string): Promise<Driver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    // Managed Postgres (Neon, Supabase, Replit) terminates TLS with its own CA.
    ssl: /\bsslmode=disable\b/.test(connectionString)
      ? false
      : { rejectUnauthorized: false },
  });

  return {
    async query(sql, params) {
      const res = await pool.query(sql, params as never);
      return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
    },
    async exec(sql) {
      await pool.query(sql);
    },
  };
}

async function createPgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create({ dataDir: PGDATA_DIR });

  return {
    async query(sql, params) {
      const res = await db.query(sql, params as never[]);
      return { rows: (res.rows ?? []) as never, rowCount: res.rows?.length ?? 0 };
    },
    async exec(sql) {
      await db.exec(sql);
    },
  };
}

/**
 * Cached on globalThis so Next's dev-mode module reloading does not open a new
 * pool (or a second PGlite instance holding the same data directory) on every
 * edit.
 */
const globalForDb = globalThis as unknown as { __swDriver?: Promise<Driver> };

function driver(): Promise<Driver> {
  if (!globalForDb.__swDriver) {
    const url = process.env.DATABASE_URL;
    globalForDb.__swDriver = url ? createPgDriver(url) : createPgliteDriver();
  }
  return globalForDb.__swDriver;
}

export async function query<T extends Row = Row>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return (await driver()).query<T>(sql, params);
}

/** First row, or null. The common shape for lookups by id. */
export async function queryOne<T extends Row = Row>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const { rows } = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Run a multi-statement script (migrations, seeds). */
export async function exec(sql: string): Promise<void> {
  return (await driver()).exec(sql);
}

export function usingPglite(): boolean {
  return !process.env.DATABASE_URL;
}
