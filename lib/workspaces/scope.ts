import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// The active workspace id for the signed-in user, or throws. Every data query
// filters on `user_id = <this id>`.
export async function requireWorkspaceId(): Promise<string> {
  const s = await getSession();
  if (!s) throw new Error("Not signed in");
  return s.userId;
}

// All workspace ids of an account. Daily limits count across all of them.
export async function inAccountWorkspaces(accountId: string): Promise<string[]> {
  if (!db) return [];
  const res = await db.execute(sql`SELECT id FROM workspaces WHERE owner_id = ${accountId}::uuid`);
  return res.rows.map((r) => String((r as { id: string }).id));
}
