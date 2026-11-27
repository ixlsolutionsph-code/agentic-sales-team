import "server-only";
import { sql } from "drizzle-orm";
import type { BookingRules } from "@/lib/ai/meetingTime";
import { meetingSettings } from "@/lib/agents/settings";
import { requireDb } from "@/lib/db";
import { loadAgentSettings } from "@/lib/jobs/context";

// Meetings (04-erd.md `meetings`, the only source for the calendar). Every
// query filters on the workspace id.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : s(v));

export type Meeting = {
  id: string;
  title: string;
  whenAt: string;
  whenLabel: string;
  leadId: string;
  leadName: string;
  company: string;
  agentId: string;
  agentName: string;
};

export type BookingAgent = { id: string; name: string; rules: BookingRules };

// The agent's booking settings (type, length, window, weekdays only).
export async function bookingRules(workspaceId: string, agentId: string): Promise<BookingRules> {
  return meetingSettings(await loadAgentSettings(workspaceId, agentId));
}

// Live agents of the workspace that can book meetings, oldest first.
export async function bookingAgents(workspaceId: string): Promise<{ id: string; name: string }[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT a.id, a.name FROM agents a
    WHERE a.user_id = ${workspaceId}::uuid AND a.capabilities ? 'book-meeting'
      AND NOT EXISTS (SELECT 1 FROM agent_states st WHERE st.user_id = a.user_id AND st.agent_id = a.id AND (st.removed OR st.paused))
    ORDER BY a.created_at ASC, a.id ASC`);
  return (r.rows as Row[]).map((x) => ({ id: s(x.id), name: s(x.name) }));
}

// Books one meeting per lead (leads of this workspace only): inserts the
// rows, moves each lead to the "meeting" stage and logs the activity.
// Returns the names of the leads booked.
export async function bookMeetingRows(
  workspaceId: string,
  m: { agentId: string; agentName: string; leadIds: string[]; whenAt: string; whenLabel: string; title: string },
): Promise<string[]> {
  if (!m.leadIds.length) return [];
  const db = requireDb();
  const ids = JSON.stringify(m.leadIds);
  const r = await db.execute(sql`
    INSERT INTO meetings (user_id, agent_id, lead_id, title, when_at, when_label)
    SELECT ${workspaceId}::uuid, ${m.agentId}, l.id, ${m.title}, ${m.whenAt}::timestamptz, ${m.whenLabel}
    FROM leads l
    WHERE l.user_id = ${workspaceId}::uuid AND l.id IN (SELECT (jsonb_array_elements_text(${ids}::jsonb))::uuid)
    RETURNING lead_id`);
  const booked = (r.rows as Row[]).map((x) => s(x.lead_id));
  if (!booked.length) return [];
  const leads = await db.execute(sql`
    UPDATE leads SET status = 'meeting', review = 'accepted', updated_at = now()
    WHERE user_id = ${workspaceId}::uuid AND id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(booked)}::jsonb))::uuid)
    RETURNING id, name`);
  const names = (leads.rows as Row[]).map((x) => s(x.name));
  for (const x of leads.rows as Row[]) {
    await db.execute(sql`
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      VALUES (${workspaceId}::uuid, ${m.agentId}, 'meeting_booked', ${s(x.id)}::uuid, ${`${m.agentName} booked a ${m.title} with ${s(x.name)} on ${m.whenLabel}`})`);
  }
  return names;
}

export async function listMeetings(workspaceId: string): Promise<Meeting[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT m.id, m.title, m.when_at, m.when_label, m.lead_id, m.agent_id,
           l.name AS lead_name, l.company, a.name AS agent_name
    FROM meetings m
    JOIN leads l ON l.id = m.lead_id
    LEFT JOIN agents a ON a.user_id = m.user_id AND a.id = m.agent_id
    WHERE m.user_id = ${workspaceId}::uuid
    ORDER BY m.when_at ASC
    LIMIT 2000`);
  return (r.rows as Row[]).map((x) => ({
    id: s(x.id),
    title: s(x.title),
    whenAt: iso(x.when_at),
    whenLabel: s(x.when_label),
    leadId: s(x.lead_id),
    leadName: s(x.lead_name),
    company: s(x.company),
    agentId: s(x.agent_id),
    agentName: s(x.agent_name),
  }));
}

// The lead's owner, if it can book meetings, else the first agent that can.
export async function bookingAgentForLead(workspaceId: string, leadId: string): Promise<{ id: string; name: string } | null> {
  const db = requireDb();
  const r = await db.execute(sql`SELECT agent_id FROM leads WHERE user_id = ${workspaceId}::uuid AND id = ${leadId}::uuid`);
  if (!r.rows.length) return null;
  const owner = s((r.rows[0] as Row).agent_id);
  const list = await bookingAgents(workspaceId);
  return list.find((a) => a.id === owner) ?? list[0] ?? null;
}

// Accepted leads of the pool with no meeting yet, best score first (≤ 10).
export async function meetableLeads(workspaceId: string, poolAgentIds: string[], limit = 10): Promise<{ id: string; name: string; company: string; score: number }[]> {
  if (!poolAgentIds.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT l.id, l.name, l.company, l.score FROM leads l
    WHERE l.user_id = ${workspaceId}::uuid AND l.review = 'accepted'
      AND l.agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(poolAgentIds)}::jsonb))
      AND NOT EXISTS (SELECT 1 FROM meetings m WHERE m.lead_id = l.id)
    ORDER BY l.score DESC, l.created_at ASC
    LIMIT ${limit}::int`);
  return (r.rows as Row[]).map((x) => ({ id: s(x.id), name: s(x.name), company: s(x.company), score: Number(x.score) || 0 }));
}
