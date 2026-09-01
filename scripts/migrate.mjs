import { readFileSync } from "node:fs";

import { connect } from "./db-driver.mjs";

const db = await connect();
console.log(`→ ${db.label}`);

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

try {
  await db.exec(sql);
  const { rows } = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  console.log(`✓ schema applied — ${rows.length} tables:`);
  for (const r of rows) console.log(`    ${r.table_name}`);
} catch (err) {
  console.error("✗ migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
