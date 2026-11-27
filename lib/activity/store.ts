import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";

// The notifications bell (02-sitemap.md): the last 12 activity rows that are
// not dismissed. Every query filters on the workspace id.

type Row = Record<string, unknown>;
export type Notice = { id: string; agentId: string; text: string; createdAt: string };

export async function listNotices(workspaceId: string, limit = 12): Promise<Notice[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT id, agent_id, text, created_at FROM activity
    WHERE user_id = ${workspaceId}::uuid AND dismissed = false
    ORDER BY created_at DESC, id DESC LIMIT ${limit}::int`);
  return (r.rows as Row[]).map((x) => ({
    id: String(x.id),
    agentId: String(x.agent_id),
    text: String(x.text),
    createdAt: x.created_at instanceof Date ? x.created_at.toISOString() : String(x.created_at),
  }));
}

// One row (id) or all rows (null) are dismissed.
export async function dismissNotices(workspaceId: string, id: string | null): Promise<number> {
  const db = requireDb();
  const one = id ? sql`AND id = ${id}::uuid` : sql``;
  const r = await db.execute(sql`UPDATE activity SET dismissed = true WHERE user_id = ${workspaceId}::uuid AND dismissed = false ${one} RETURNING id`);
  return r.rows.length;
}
