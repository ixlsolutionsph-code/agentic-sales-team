import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { toLead } from "@/lib/leads/store";
import type { Lead } from "@/lib/leads/types";
import type { JobKind } from "./limits";

// What a run needs to know: the agent as it is now, its team's lead pool and
// goal, and the leads to work on. Every query filters on the workspace id.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export type RunAgent = {
  id: string;
  name: string;
  role: string;
  goal: string;
  capabilities: string[];
  paused: boolean;
  removed: boolean;
};

// The agent with its edits (role, goal) applied, or null if it doesn't exist here.
export async function loadRunAgent(workspaceId: string, agentId: string): Promise<RunAgent | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT a.id, a.name, a.role, a.goal, a.capabilities, c.role AS c_role, c.goal AS c_goal,
           COALESCE(st.paused, false) AS paused, COALESCE(st.removed, false) AS removed
    FROM agents a
    LEFT JOIN agent_config c ON c.user_id = a.user_id AND c.agent_id = a.id
    LEFT JOIN agent_states st ON st.user_id = a.user_id AND st.agent_id = a.id
    WHERE a.user_id = ${workspaceId}::uuid AND a.id = ${agentId}`);
  const row = r.rows[0] as Row | undefined;
  if (!row) return null;
  return {
    id: s(row.id),
    name: s(row.name),
    role: s(row.c_role) || s(row.role),
    goal: row.c_goal == null ? s(row.goal) : s(row.c_goal),
    capabilities: Array.isArray(row.capabilities) ? (row.capabilities as unknown[]).map(String) : [],
    paused: row.paused === true,
    removed: row.removed === true,
  };
}

// The agent's lead pool: its own leads and those of everyone on its teams
// (team_members overrides teams.members; deleted agents are left out).
// Also returns the oldest team's shared goal.
export async function poolOf(workspaceId: string, agentId: string): Promise<{ agentIds: string[]; teamGoal: string }> {
  const db = requireDb();
  const r = await db.execute(sql`
    WITH t AS (
      SELECT t.goal, t.created_at, COALESCE(m.members, t.members) AS members
      FROM teams t
      LEFT JOIN team_members m ON m.user_id = t.user_id AND m.team_id = t.id
      WHERE t.user_id = ${workspaceId}::uuid
    ), mine AS (SELECT * FROM t WHERE members ? ${agentId})
    SELECT
      (SELECT goal FROM mine ORDER BY created_at ASC LIMIT 1) AS team_goal,
      (SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb) FROM mine, jsonb_array_elements_text(mine.members) AS x) AS ids`);
  const row = (r.rows[0] ?? {}) as Row;
  const ids = Array.isArray(row.ids) ? (row.ids as unknown[]).map(String) : [];
  const all = [...new Set([agentId, ...ids])];
  const live = await db.execute(sql`
    SELECT a.id FROM agents a
    WHERE a.user_id = ${workspaceId}::uuid
      AND a.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(all)}::jsonb))
      AND NOT EXISTS (SELECT 1 FROM agent_states st WHERE st.user_id = a.user_id AND st.agent_id = a.id AND st.removed)`);
  const liveIds = new Set((live.rows as Row[]).map((x) => s(x.id)));
  return { agentIds: all.filter((id) => id === agentId || liveIds.has(id)), teamGoal: s(row.team_goal) };
}

// The leads a stage works on (01-prd.md §7.2), oldest first. Given lead ids
// are used as they are (if they belong to this workspace and are in the right
// review state); otherwise the pool is searched for leads that still need
// this stage.
export async function pickLeads(
  workspaceId: string,
  kind: JobKind,
  poolAgentIds: string[],
  leadIds: string[] | undefined,
  limit: number,
): Promise<Lead[]> {
  const db = requireDb();
  const review = kind === "assess" ? sql`l.review = 'pending'` : sql`l.review = 'accepted'`;
  const liveDraft = sql`EXISTS (SELECT 1 FROM outreach_drafts d WHERE d.lead_id = l.id AND d.status <> 'sent' AND d.dismissed = false)`;
  const anyDraft = sql`EXISTS (SELECT 1 FROM outreach_drafts d WHERE d.lead_id = l.id)`;
  const hasProposal = sql`EXISTS (SELECT 1 FROM proposals p WHERE p.lead_id = l.id)`;
  let scope;
  let need;
  if (leadIds && leadIds.length) {
    scope = sql`l.id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(leadIds)}::jsonb))::uuid)`;
    need = kind === "outreach" ? sql`NOT ${liveDraft}` : kind === "proposal" ? sql`NOT ${hasProposal}` : sql`true`;
  } else {
    scope = sql`l.agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(poolAgentIds)}::jsonb))`;
    need =
      kind === "research"
        ? sql`l.research IS NULL`
        : kind === "qualify"
          ? sql`l.qualified_at IS NULL`
          : kind === "match"
            ? sql`l.matched_at IS NULL`
            : kind === "outreach"
              ? sql`NOT ${anyDraft}`
              : kind === "proposal"
                ? sql`NOT ${hasProposal}`
                : sql`true`;
  }
  const r = await db.execute(sql`
    SELECT l.id, l.agent_id, l.name, l.title, l.company, l.email, l.status, l.score, l.source, l.review,
           l.profile_url, l.platform, l.fit_reason, l.research, l.created_at
    FROM leads l
    WHERE l.user_id = ${workspaceId}::uuid AND ${review} AND ${scope} AND ${need}
    ORDER BY l.created_at ASC, l.id ASC
    LIMIT ${limit}`);
  return (r.rows as Row[]).map(toLead);
}

export async function productCount(workspaceId: string): Promise<number> {
  const db = requireDb();
  const r = await db.execute(sql`SELECT count(*)::int AS n FROM products WHERE user_id = ${workspaceId}::uuid`);
  return Number((r.rows[0] as Row)?.n) || 0;
}

// Lead ids (of the given ones) that already have an open draft.
export async function leadsWithOpenDraft(workspaceId: string, leadIds: string[]): Promise<string[]> {
  if (!leadIds.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT DISTINCT lead_id FROM outreach_drafts
    WHERE user_id = ${workspaceId}::uuid AND status <> 'sent' AND dismissed = false
      AND lead_id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(leadIds)}::jsonb))::uuid)`);
  return (r.rows as Row[]).map((x) => s(x.lead_id));
}
