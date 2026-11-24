// Applies lib/db/migrations/*.sql to the Neon database, in name order.
// The Neon HTTP driver runs one statement per call, so each file is split on
// "--> statement-breakpoint". A file's statements and its _migrations row run
// in one transaction. Safe to run again: applied files are skipped.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { neon, neonConfig } from "@neondatabase/serverless";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local
  }
}
loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to the environment or .env.local.");
  process.exit(1);
}
// Local testing only: point the driver at a stand-in for Neon's HTTP endpoint.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

const sql = neon(url);
const dir = path.join(process.cwd(), "lib/db/migrations");

await sql.query(
  'CREATE TABLE IF NOT EXISTS "_migrations" ("name" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())',
);
const applied = new Set((await sql.query('SELECT "name" FROM "_migrations"')).map((r) => r.name));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const statements = readFileSync(path.join(dir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s && !/^(--[^\n]*\n?)*$/.test(s));
  await sql.transaction([
    ...statements.map((s) => sql.query(s)),
    sql.query('INSERT INTO "_migrations" ("name") VALUES ($1)', [file]),
  ]);
  console.log(`applied ${file} (${statements.length} statements)`);
  count++;
}
console.log(count ? `Done: ${count} file(s) applied.` : "Nothing to apply. The database is up to date.");
