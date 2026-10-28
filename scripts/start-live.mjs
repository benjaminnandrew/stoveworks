/**
 * Starts the published site. On Replit this is the run command:
 *
 *   npm run start:live
 *
 * It keeps the live database up to date, so publishing is the only step:
 *
 *   1. db:migrate      the tables (idempotent, about a second; the site
 *                      doesn't start if this fails)
 *   2. next start      the site, on port 3014
 *   3. db:seed         the site's brands (idempotent)
 *   4. db:seed:stone   the stone profiles, the first time only
 *   5. brain:load      the catalog, the guides and the visualizer's products
 *
 * Replit marks a published app live once its homepage answers (within five
 * seconds), so steps 3–5 run in the background once the site is up. On the
 * very first start they take a minute or two; after that a few seconds, since
 * they only change what differs and never overwrite what staff own. If one of
 * them fails, the site keeps running with the data as last loaded.
 *
 * Without DATABASE_URL (PGlite, local only) steps 3–5 run before the site
 * starts instead, because two processes can't share a PGlite database.
 */

import { spawn, spawnSync } from "node:child_process";

const node = process.execPath;
const PORT = "3014";
const onPostgres = Boolean(process.env.DATABASE_URL);

const DATA_STEPS = [
  ["the site's brands (db:seed)", ["scripts/seed.mjs"]],
  ["stone profiles, first time only (db:seed:stone)", ["scripts/seed-stone.mjs", "--if-empty"]],
  ["catalog, guides and products (brain:load)", ["scripts/load-brain.mjs"]],
];

function stepNow(label, args) {
  console.log(`\n▸ ${label}`);
  return spawnSync(node, args, { stdio: "inherit" }).status === 0;
}

let running = null; // the background step in progress, if any

function stepInBackground(label, args) {
  console.log(`\n▸ ${label}`);
  return new Promise((resolve) => {
    running = spawn(node, args, { stdio: "inherit" });
    running.on("exit", (code) => {
      running = null;
      resolve(code === 0);
    });
  });
}

async function siteIsUp() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/robots.txt`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

// 1. tables
if (!stepNow("tables (db:migrate)", ["scripts/migrate.mjs"])) {
  console.error("✗ The database couldn't be brought up to date, so the site isn't starting.");
  process.exit(1);
}

// Local PGlite: the data steps run first.
if (!onPostgres) {
  for (const [label, args] of DATA_STEPS) {
    if (!stepNow(label, args)) console.error(`! ${label} failed; carrying on.`);
  }
}

// 2. the site
console.log(`\n▸ starting the site on port ${PORT}`);
const site = spawn(node, ["node_modules/next/dist/bin/next", "start", "-p", PORT], { stdio: "inherit" });

// Pass shutdown signals on, so a redeploy stops everything cleanly.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    running?.kill(signal);
    site.kill(signal);
  });
}
site.on("exit", (code, signal) => {
  running?.kill("SIGTERM");
  process.exit(code ?? (signal ? 1 : 0));
});

// 3–5. the data, in the background once the site answers
if (onPostgres && (await siteIsUp())) {
  for (const [label, args] of DATA_STEPS) {
    if (!(await stepInBackground(label, args))) {
      console.error(`! ${label} failed; the site carries on with the data as last loaded.`);
    }
  }
  console.log("\n✓ live database up to date");
}
