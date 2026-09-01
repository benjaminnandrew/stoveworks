import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { query, queryOne } from "./db";

export const SESSION_COOKIE = "sw_session";

const LOGIN_TOKEN_TTL_MIN = 15;
const SESSION_TTL_DAYS = 30;
/** Sign-in requests allowed per email address inside the window. */
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MIN = 15;

export type Role = "customer" | "staff" | "admin";

export type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  created_at: Date;
  last_login_at: Date | null;
};

/** Opaque tokens are random; only their SHA-256 lives in the database. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function isValidEmail(email: string): boolean {
  // Deliberately permissive: the sign-in link is the real verification.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

// ---------------------------------------------------------------------------
// Sign-in links
// ---------------------------------------------------------------------------

export type SignInRequest =
  | { ok: true; token: string; isNewUser: boolean }
  | { ok: false; reason: "rate_limited" };

/**
 * Finds or creates the user, then issues a single-use sign-in token.
 * Returns the raw token — the caller emails it and must not log it.
 */
export async function createSignInToken(
  rawEmail: string,
  requestIp: string | null,
): Promise<SignInRequest> {
  const email = normaliseEmail(rawEmail);

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = $1`,
    [email],
  );

  let userId = existing?.id;
  const isNewUser = !existing;

  if (!userId) {
    const created = await queryOne<{ id: string }>(
      `INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [email],
    );
    userId = created!.id;
  } else {
    const { rows } = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM login_tokens
        WHERE user_id = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
      [userId, REQUEST_WINDOW_MIN],
    );
    if ((rows[0]?.n ?? 0) >= REQUEST_LIMIT) return { ok: false, reason: "rate_limited" };
  }

  // Outstanding links for this user stop working the moment a new one is asked for.
  await query(
    `UPDATE login_tokens SET consumed_at = now()
      WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId],
  );

  const token = newToken();
  await query(
    `INSERT INTO login_tokens (user_id, token_hash, expires_at, request_ip)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval, $4)`,
    [userId, hashToken(token), LOGIN_TOKEN_TTL_MIN, requestIp],
  );

  return { ok: true, token, isNewUser };
}

/**
 * Consumes a sign-in token and starts a session.
 * Returns null for anything expired, already used, or unknown.
 */
export async function redeemSignInToken(
  token: string,
  userAgent: string | null,
): Promise<User | null> {
  if (!token) return null;

  const row = await queryOne<{ id: string; user_id: string }>(
    `UPDATE login_tokens SET consumed_at = now()
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING id, user_id`,
    [hashToken(token)],
  );
  if (!row) return null;

  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [row.user_id]);
  await startSession(row.user_id, userAgent);

  return queryOne<User>(`SELECT * FROM users WHERE id = $1`, [row.user_id]);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

async function startSession(userId: string, userAgent: string | null): Promise<void> {
  const token = newToken();

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [userId, hashToken(token), SESSION_TTL_DAYS, userAgent?.slice(0, 400) ?? null],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/**
 * The signed-in user, or null. Memoised per request so a page and its
 * components can each ask without extra queries.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await queryOne<User & { session_id: string }>(
    `SELECT u.*, s.id AS session_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!user) return null;

  // Sliding expiry, but only written once an hour so reads stay cheap.
  await query(
    `UPDATE sessions
        SET last_seen_at = now(),
            expires_at = now() + ($2 || ' days')::interval
      WHERE id = $1 AND last_seen_at < now() - interval '1 hour'`,
    [user.session_id, SESSION_TTL_DAYS],
  );

  return user;
});

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export function isStaff(user: User | null): boolean {
  return user?.role === "staff" || user?.role === "admin";
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  // 404 rather than 403 — the admin area should not advertise itself.
  if (!isStaff(user)) notFound();
  return user;
}

/** Constant-time compare for share slugs and similar low-entropy secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
