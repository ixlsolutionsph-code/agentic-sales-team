import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import type { ChatMessage } from "@/lib/types";
import { marker } from "./markers";

// Team chat storage (01-prd.md §7.4): messages rows with agent_id = team id;
// who = "me", "system" or the speaking agent's id. The serial id is the order
// and the poll cursor. Every query filters on the workspace id.

type Row = Record<string, unknown>;
const toMsg = (r: Row): ChatMessage => ({
  id: Number(r.id),
  who: String(r.who),
  text: String(r.text),
  createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
});

export const MSG_MAX_CHARS = 2000;
export const CHAT_MESSAGES_PER_DAY = 300;
export const MSG_TOO_LONG = "That message is too long. Keep it under 2000 characters.";
export const MSG_CHAT_LIMIT = "You've reached today's limit of 300 messages. Try again tomorrow.";

export async function postTeamMessage(workspaceId: string, teamId: string, who: string, text: string): Promise<ChatMessage> {
  const db = requireDb();
  const r = await db.execute(sql`
    INSERT INTO messages (user_id, agent_id, who, text)
    VALUES (${workspaceId}::uuid, ${teamId}, ${who}, ${text})
    RETURNING id, who, text, created_at`);
  return toMsg(r.rows[0] as Row);
}

// Posts a job's result once: the text carries ⟦job:id⟧, and a second post for
// the same job is skipped. Returns null when it was already posted.
export async function postJobMessage(workspaceId: string, teamId: string, who: string, jobId: string, text: string): Promise<ChatMessage | null> {
  const db = requireDb();
  const tag = marker("job", jobId);
  const r = await db.execute(sql`
    INSERT INTO messages (user_id, agent_id, who, text)
    SELECT ${workspaceId}::uuid, ${teamId}, ${who}, ${`${text}${tag}`}
    WHERE NOT EXISTS (
      SELECT 1 FROM messages WHERE user_id = ${workspaceId}::uuid AND agent_id = ${teamId} AND position(${tag} in text) > 0
    )
    RETURNING id, who, text, created_at`);
  return r.rows.length ? toMsg(r.rows[0] as Row) : null;
}

// The thread after a cursor (0 = from the start), oldest first, at most 500.
export async function listTeamMessages(workspaceId: string, teamId: string, afterId = 0): Promise<ChatMessage[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT id, who, text, created_at FROM messages
    WHERE user_id = ${workspaceId}::uuid AND agent_id = ${teamId} AND id > ${afterId}::int
    ORDER BY id ASC LIMIT 500`);
  return (r.rows as Row[]).map(toMsg);
}

// The last N messages of a thread, oldest first (for the conversation prompt).
export async function lastTeamMessages(workspaceId: string, teamId: string, n: number): Promise<ChatMessage[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT id, who, text, created_at FROM messages
    WHERE user_id = ${workspaceId}::uuid AND agent_id = ${teamId}
    ORDER BY id DESC LIMIT ${n}::int`);
  return (r.rows as Row[]).map(toMsg).reverse();
}

// Messages from agents or the system newer than the last one the user saw,
// per team. `seen` maps team id → last seen message id (kept by the browser).
export async function chatUnread(workspaceId: string, seen: Record<string, number>): Promise<Record<string, number>> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT agent_id, count(*)::int AS n FROM messages m
    WHERE m.user_id = ${workspaceId}::uuid AND m.who <> 'me'
      AND m.agent_id IN (SELECT id FROM teams WHERE user_id = ${workspaceId}::uuid)
      AND m.id > COALESCE((${JSON.stringify(seen)}::jsonb ->> m.agent_id)::int, 0)
    GROUP BY agent_id`);
  const out: Record<string, number> = {};
  for (const row of r.rows as Row[]) out[String(row.agent_id)] = Number(row.n) || 0;
  return out;
}

// User messages in the last 24 h across every workspace of the account.
export async function countRecentUserMessages(workspaceIds: string[]): Promise<number> {
  if (!workspaceIds.length) return 0;
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT count(*)::int AS n FROM messages
    WHERE user_id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(workspaceIds)}::jsonb))::uuid)
      AND who = 'me' AND created_at > now() - interval '24 hours'`);
  return Number((r.rows[0] as Row)?.n) || 0;
}

// Clear chat: deletes the thread (hard delete). Dismissing the team's waiting
// jobs is done by the caller (lib/pod).
export async function deleteTeamMessages(workspaceId: string, teamId: string): Promise<number> {
  const db = requireDb();
  const r = await db.execute(sql`DELETE FROM messages WHERE user_id = ${workspaceId}::uuid AND agent_id = ${teamId} RETURNING id`);
  return r.rows.length;
}
