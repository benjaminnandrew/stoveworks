/**
 * Drops every application table and re-applies the schema.
 * Destructive by design — refuses to run against production unless forced.
 */

import { readFileSync } from "node:fs";

import { connect } from "./db-driver.mjs";

const force = process.argv.includes("--force");

if (process.env.DATABASE_URL && !force) {
  console.error("✗ DATABASE_URL is set. Re-run with --force if you really mean to wipe it.");
  process.exit(1);
}

const db = await connect();
console.log(`→ ${db.label}`);

try {
  await db.exec(`
    DROP TABLE IF EXISTS design_enquiries, designs, room_photos,
                         products, brands, sessions, login_tokens, users CASCADE;
  `);
  console.log("✓ tables dropped");

  await db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("✓ schema re-applied — run `npm run db:seed` next");
} catch (err) {
  console.error("✗ reset failed:", err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
