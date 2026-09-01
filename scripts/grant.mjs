/**
 * Grants a role to a user by email, creating the account if it does not exist.
 *   node scripts/grant.mjs steve@example.com admin
 * Roles: customer | staff | admin
 */

import { connect } from "./db-driver.mjs";

const [email, role = "staff"] = process.argv.slice(2);

if (!email || !["customer", "staff", "admin"].includes(role)) {
  console.error("usage: node scripts/grant.mjs <email> [customer|staff|admin]");
  process.exit(1);
}

const db = await connect();
console.log(`→ ${db.label}`);

try {
  const { rows } = await db.query(
    `INSERT INTO users (email, role) VALUES ($1, $2)
     ON CONFLICT (lower(email)) DO UPDATE SET role = EXCLUDED.role
     RETURNING id, email, role`,
    [email.trim().toLowerCase(), role],
  );
  const u = rows[0];
  console.log(`✓ ${u.email} is now ${u.role}`);
  console.log(`  Sign in at /sign-in — no password, the link is emailed.`);
} catch (err) {
  console.error("✗ failed:", err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
