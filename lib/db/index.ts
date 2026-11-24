import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

// Local testing only: point the driver at a stand-in for Neon's HTTP endpoint.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

const url = process.env.DATABASE_URL;

// With no DATABASE_URL the app still boots; anything that needs the database
// reports "Couldn't reach the server".
export const db: DB | null = url ? drizzle(neon(url), { schema }) : null;

export function requireDb(): DB {
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}

export { schema };
