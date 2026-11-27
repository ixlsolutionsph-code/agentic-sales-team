import "server-only";
import { sql } from "drizzle-orm";
import { matchLeadNames } from "@/lib/ai/resolveLeads";
import { capabilityLabel } from "@/lib/agentTypes";
import { requireDb } from "@/lib/db";
import { leadTier } from "@/lib/leads/types";
import type { ChatAgent, ChatTeam } from "./orchestrate";

// What the chat needs to know about the workspace: the teams with their
// members, the team's real numbers for the conversation (01-prd.md §7.4
// "Converse": counts by review and tier, drafts, proposals, meetings, top 8
// leads, leads named in the question; at most 3000 characters), the search
// catalog and the outreach picker. Every query filters on the workspace id.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Record<string, unknown>>) : null);

export const FACTS_MAX = 3000;

// Every team with its live (not deleted) members, oldest team first.
export async function loadChatWorld(workspaceId: string): Promise<ChatTeam[]> {
  const db = requireDb();
  const [agents, teams] = await Promise.all([
    db.execute(sql`
      SELECT a.id, a.name, a.role, a.goal, a.capabilities, c.role AS c_role, c.goal AS c_goal, c.settings,
             COALESCE(st.paused, false) AS paused, COALESCE(st.removed, false) AS removed
      FROM agents a
      LEFT JOIN agent_config c ON c.user_id = a.user_id AND c.agent_id = a.id
      LEFT JOIN agent_states st ON st.user_id = a.user_id AND st.agent_id = a.id
      WHERE a.user_id = ${workspaceId}::uuid
      ORDER BY a.created_at ASC, a.id ASC`),
    db.execute(sql`
      SELECT t.id, t.name, t.goal, COALESCE(m.members, t.members) AS members
      FROM teams t
      LEFT JOIN team_members m ON m.user_id = t.user_id AND m.team_id = t.id
      WHERE t.user_id = ${workspaceId}::uuid
      ORDER BY t.created_at ASC, t.id ASC`),
  ]);
  const byId = new Map<string, ChatAgent>();
  for (const r of agents.rows as Row[]) {
    if (r.removed === true) continue;
    byId.set(s(r.id), {
      id: s(r.id),
      name: s(r.name),
      role: s(r.c_role) || s(r.role),
      goal: r.c_goal == null ? s(r.goal) : s(r.c_goal),
      capabilities: strList(r.capabilities),
      paused: r.paused === true,
      settings: obj(r.settings),
    });
  }
  return (teams.rows as Row[]).map((t) => ({
    id: s(t.id),
    name: s(t.name),
    goal: s(t.goal),
    members: [...new Set(strList(t.members))].map((id) => byId.get(id)).filter((a): a is ChatAgent => !!a),
  }));
}

export async function teamExists(workspaceId: string, teamId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`SELECT 1 FROM teams WHERE user_id = ${workspaceId}::uuid AND id = ${teamId}`);
  return r.rows.length > 0;
}

// The team's member ids (override, else the team's list), minus deleted agents.
export async function teamMemberIds(workspaceId: string, teamId: string): Promise<string[] | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT COALESCE(m.members, t.members) AS members FROM teams t
    LEFT JOIN team_members m ON m.user_id = t.user_id AND m.team_id = t.id
    WHERE t.user_id = ${workspaceId}::uuid AND t.id = ${teamId}`);
  if (!r.rows.length) return null;
  const ids = [...new Set(strList((r.rows[0] as Row).members))];
  if (!ids.length) return [];
  const live = await db.execute(sql`
    SELECT a.id FROM agents a
    WHERE a.user_id = ${workspaceId}::uuid
      AND a.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
      AND NOT EXISTS (SELECT 1 FROM agent_states st WHERE st.user_id = a.user_id AND st.agent_id = a.id AND st.removed)`);
  const set = new Set((live.rows as Row[]).map((x) => s(x.id)));
  return ids.filter((id) => set.has(id));
}

export type PoolLead = { id: string; name: string; company: string; review: string };

// Accepted and pending leads of the given agents, newest first.
export async function poolLeadNames(workspaceId: string, agentIds: string[], limit = 500): Promise<PoolLead[]> {
  if (!agentIds.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT id, name, company, review FROM leads
    WHERE user_id = ${workspaceId}::uuid AND review IN ('accepted', 'pending')
      AND agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(agentIds)}::jsonb))
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}::int`);
  return (r.rows as Row[]).map((x) => ({ id: s(x.id), name: s(x.name), company: s(x.company), review: s(x.review) }));
}

// Leads of this workspace by id (for /lead picks), in the given agents' pool.
export async function poolLeadsByIds(workspaceId: string, agentIds: string[], ids: string[]): Promise<PoolLead[]> {
  if (!agentIds.length || !ids.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT id, name, company, review FROM leads
    WHERE user_id = ${workspaceId}::uuid
      AND id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid)
      AND agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(agentIds)}::jsonb))`);
  const rows = (r.rows as Row[]).map((x) => ({ id: s(x.id), name: s(x.name), company: s(x.company), review: s(x.review) }));
  return ids.map((id) => rows.find((x) => x.id === id)).filter((x): x is PoolLead => !!x);
}

// Leads for the chat's /lead picker and cards: the given ids (this
// workspace), or the team pool (accepted and pending, newest first, ≤ 200).
export type ChatLeadRow = {
  id: string;
  name: string;
  company: string;
  title: string;
  review: string;
  fitReason: string;
  platform: string | null;
  profileUrl: string | null;
  email: string;
  score: number;
  research: { summary: string; angle: string } | null;
  createdAt: string;
};
export async function chatLeadRows(workspaceId: string, scope: { agentIds: string[] } | { ids: string[] }): Promise<ChatLeadRow[]> {
  const db = requireDb();
  let where;
  if ("ids" in scope) {
    if (!scope.ids.length) return [];
    where = sql`id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(scope.ids)}::jsonb))::uuid)`;
  } else {
    if (!scope.agentIds.length) return [];
    where = sql`review IN ('accepted', 'pending') AND agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(scope.agentIds)}::jsonb))`;
  }
  const r = await db.execute(sql`
    SELECT id, name, company, title, review, fit_reason, platform, profile_url, email, score, research, created_at
    FROM leads WHERE user_id = ${workspaceId}::uuid AND ${where}
    ORDER BY created_at DESC, id DESC LIMIT 200`);
  return (r.rows as Row[]).map((x) => {
    const res = x.research && typeof x.research === "object" ? (x.research as Record<string, unknown>) : null;
    return {
      id: s(x.id),
      name: s(x.name),
      company: s(x.company),
      title: s(x.title),
      review: s(x.review),
      fitReason: s(x.fit_reason),
      platform: x.platform == null ? null : s(x.platform),
      profileUrl: x.profile_url == null ? null : s(x.profile_url),
      email: s(x.email),
      score: Number(x.score) || 0,
      research: res ? { summary: s(res.summary), angle: s(res.angle) } : null,
      createdAt: x.created_at instanceof Date ? x.created_at.toISOString() : s(x.created_at),
    };
  });
}

// The outreach picker: accepted leads with no open draft, best score first, ≤ 50.
export async function openOutreachLeads(workspaceId: string, agentIds: string[], limit = 50): Promise<{ id: string; name: string; company: string }[]> {
  if (!agentIds.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT l.id, l.name, l.company FROM leads l
    WHERE l.user_id = ${workspaceId}::uuid AND l.review = 'accepted'
      AND l.agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(agentIds)}::jsonb))
      AND NOT EXISTS (SELECT 1 FROM outreach_drafts d WHERE d.lead_id = l.id AND d.status <> 'sent' AND d.dismissed = false)
    ORDER BY l.score DESC, l.created_at DESC, l.id DESC
    LIMIT ${limit}::int`);
  return (r.rows as Row[]).map((x) => ({ id: s(x.id), name: s(x.name), company: s(x.company) }));
}

// The catalog as the search brief sees it (name and description).
export async function briefProducts(workspaceId: string): Promise<{ name: string; description: string }[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT name, description FROM products WHERE user_id = ${workspaceId}::uuid
    ORDER BY created_at ASC, id ASC LIMIT 200`);
  return (r.rows as Row[]).map((x) => ({ name: s(x.name), description: s(x.description) }));
}

// The last search of the team's members (for "look for more"): its brief, or
// the instruction it ran with.
export async function lastSearch(workspaceId: string, agentIds: string[]): Promise<{ agentId: string; brief: unknown; instruction: string } | null> {
  if (!agentIds.length) return null;
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT agent_id, params FROM jobs
    WHERE user_id = ${workspaceId}::uuid AND kind = 'scrape'
      AND agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(agentIds)}::jsonb))
    ORDER BY created_at DESC, id DESC LIMIT 1`);
  const row = r.rows[0] as Row | undefined;
  if (!row) return null;
  const params = (row.params && typeof row.params === "object" ? row.params : {}) as Record<string, unknown>;
  return { agentId: s(row.agent_id), brief: params.brief ?? null, instruction: s(params.instruction) };
}

// ---- Team facts for the conversation ----

export type TeamFacts = {
  teamName: string;
  teamGoal: string;
  members: { name: string; role: string; capabilities: string[]; paused: boolean }[];
  leads: { accepted: number; pending: number; dismissed: number; hot: number; warm: number; cold: number; unscored: number };
  stages: Record<string, number>;
  drafts: { open: number; sent: number };
  proposals: number;
  meetings: { upcoming: number; total: number };
  products: number;
  top: { name: string; title: string; company: string; score: number; status: string }[];
  named: { name: string; title: string; company: string; score: number; status: string; review: string; fitReason: string; research: string }[];
};

const tierWord = (score: number) => leadTier(score) ?? "not scored";
const clip = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);

// The facts as short lines, at most 3000 characters (cut at a line).
export function formatTeamFacts(f: TeamFacts): string {
  const lines: string[] = [];
  lines.push(`Team: ${clip(f.teamName, 80)}${f.teamGoal ? `. Shared goal: ${clip(f.teamGoal, 300)}` : ""}`);
  if (f.members.length) {
    lines.push(
      `Members: ${f.members
        .map((m) => `${clip(m.name, 60)} (${clip(m.role, 60)}; ${m.capabilities.map(capabilityLabel).join(", ") || "no skills"}${m.paused ? "; paused" : ""})`)
        .join("; ")}`,
    );
  }
  const L = f.leads;
  lines.push(`Leads in the book (accepted): ${L.accepted} (${L.hot} hot, ${L.warm} warm, ${L.cold} cold, ${L.unscored} not scored yet)`);
  lines.push(`Leads waiting for review (pending): ${L.pending}. Dismissed: ${L.dismissed}`);
  const st = Object.entries(f.stages).filter(([, n]) => n > 0);
  if (st.length) lines.push(`Stages of accepted leads: ${st.map(([k, n]) => `${k} ${n}`).join(", ")}`);
  lines.push(`Email drafts waiting to be sent: ${f.drafts.open}. Emails marked sent: ${f.drafts.sent}`);
  lines.push(`Proposals written: ${f.proposals}`);
  lines.push(`Meetings booked: ${f.meetings.total} (${f.meetings.upcoming} upcoming)`);
  lines.push(`Products in the catalog: ${f.products}`);
  if (f.top.length) {
    lines.push("Top leads by score:");
    for (const l of f.top) lines.push(`- ${clip(l.name, 80)}, ${clip(l.title, 80) || "no title"} at ${clip(l.company, 80) || "unknown company"}: score ${l.score} (${tierWord(l.score)}), stage ${l.status}`);
  }
  if (f.named.length) {
    lines.push("Leads named in the message:");
    for (const l of f.named) {
      const parts = [`${clip(l.name, 80)}, ${clip(l.title, 80) || "no title"} at ${clip(l.company, 80) || "unknown company"}`, `review ${l.review}`, `score ${l.score} (${tierWord(l.score)})`, `stage ${l.status}`];
      if (l.fitReason) parts.push(`why they fit: ${clip(l.fitReason, 200)}`);
      if (l.research) parts.push(`research: ${clip(l.research, 300)}`);
      lines.push(`- ${parts.join("; ")}`);
    }
  }
  let out = "";
  for (const line of lines) {
    if (out.length + line.length + 1 > FACTS_MAX) break;
    out += (out ? "\n" : "") + line;
  }
  return out;
}

// A short factual answer when there is no AI.
export function factualAnswer(f: TeamFacts): string {
  const L = f.leads;
  const parts = [
    `Here is where we stand: ${L.accepted} lead${L.accepted === 1 ? "" : "s"} in the book (${L.hot} hot, ${L.warm} warm, ${L.cold} cold) and ${L.pending} waiting for review.`,
    `We have ${f.drafts.open} email draft${f.drafts.open === 1 ? "" : "s"} to send, ${f.proposals} proposal${f.proposals === 1 ? "" : "s"} and ${f.meetings.upcoming} upcoming meeting${f.meetings.upcoming === 1 ? "" : "s"}.`,
  ];
  if (f.named.length) {
    const l = f.named[0];
    parts.push(`${clip(l.name, 80)} has a score of ${l.score} (${tierWord(l.score)}) and is at the ${l.status} stage.`);
  } else if (f.top.length) {
    parts.push(`The top lead is ${clip(f.top[0].name, 80)} with a score of ${f.top[0].score}.`);
  }
  return parts.join(" ");
}

export async function loadTeamFacts(workspaceId: string, team: ChatTeam, question: string): Promise<TeamFacts> {
  const db = requireDb();
  const ids = JSON.stringify(team.members.map((m) => m.id));
  const inPool = sql`l.agent_id IN (SELECT jsonb_array_elements_text(${ids}::jsonb))`;
  const [counts, stages, drafts, proposals, meetings, products, top, pool] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE review = 'accepted')::int AS accepted,
        count(*) FILTER (WHERE review = 'pending')::int AS pending,
        count(*) FILTER (WHERE review = 'dismissed')::int AS dismissed,
        count(*) FILTER (WHERE review = 'accepted' AND score >= 75)::int AS hot,
        count(*) FILTER (WHERE review = 'accepted' AND score >= 50 AND score < 75)::int AS warm,
        count(*) FILTER (WHERE review = 'accepted' AND score >= 1 AND score < 50)::int AS cold,
        count(*) FILTER (WHERE review = 'accepted' AND score < 1)::int AS unscored
      FROM leads l WHERE l.user_id = ${workspaceId}::uuid AND ${inPool}`),
    db.execute(sql`
      SELECT status, count(*)::int AS n FROM leads l
      WHERE l.user_id = ${workspaceId}::uuid AND l.review = 'accepted' AND ${inPool}
      GROUP BY status`),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE d.status <> 'sent' AND d.dismissed = false)::int AS open,
        count(*) FILTER (WHERE d.status = 'sent')::int AS sent
      FROM outreach_drafts d JOIN leads l ON l.id = d.lead_id
      WHERE d.user_id = ${workspaceId}::uuid AND ${inPool}`),
    db.execute(sql`
      SELECT count(*)::int AS n FROM proposals p JOIN leads l ON l.id = p.lead_id
      WHERE p.user_id = ${workspaceId}::uuid AND ${inPool}`),
    db.execute(sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE m.when_at > now())::int AS upcoming
      FROM meetings m JOIN leads l ON l.id = m.lead_id
      WHERE m.user_id = ${workspaceId}::uuid AND ${inPool}`),
    db.execute(sql`SELECT count(*)::int AS n FROM products WHERE user_id = ${workspaceId}::uuid`),
    db.execute(sql`
      SELECT name, title, company, score, status FROM leads l
      WHERE l.user_id = ${workspaceId}::uuid AND l.review = 'accepted' AND ${inPool}
      ORDER BY score DESC, created_at DESC LIMIT 8`),
    db.execute(sql`
      SELECT id, name, title, company, score, status, review, fit_reason, research FROM leads l
      WHERE l.user_id = ${workspaceId}::uuid AND l.review IN ('accepted', 'pending') AND ${inPool}
      ORDER BY created_at DESC LIMIT 500`),
  ]);
  const c = (counts.rows[0] ?? {}) as Row;
  const n = (v: unknown) => Number(v) || 0;
  const poolRows = pool.rows as Row[];
  const namedIds = matchLeadNames(question, poolRows.map((r) => ({ id: s(r.id), name: s(r.name) }))).slice(0, 5);
  const named = namedIds
    .map((id) => poolRows.find((r) => s(r.id) === id)!)
    .map((r) => ({
      name: s(r.name),
      title: s(r.title),
      company: s(r.company),
      score: n(r.score),
      status: s(r.status),
      review: s(r.review),
      fitReason: s(r.fit_reason),
      research: r.research && typeof r.research === "object" ? s((r.research as Record<string, unknown>).summary) : "",
    }));
  const stageMap: Record<string, number> = {};
  for (const r of stages.rows as Row[]) stageMap[s(r.status)] = n(r.n);
  const d = (drafts.rows[0] ?? {}) as Row;
  const m = (meetings.rows[0] ?? {}) as Row;
  return {
    teamName: team.name,
    teamGoal: team.goal,
    members: team.members.map((a) => ({ name: a.name, role: a.role, capabilities: a.capabilities, paused: a.paused })),
    leads: { accepted: n(c.accepted), pending: n(c.pending), dismissed: n(c.dismissed), hot: n(c.hot), warm: n(c.warm), cold: n(c.cold), unscored: n(c.unscored) },
    stages: stageMap,
    drafts: { open: n(d.open), sent: n(d.sent) },
    proposals: n((proposals.rows[0] as Row)?.n),
    meetings: { upcoming: n(m.upcoming), total: n(m.total) },
    products: n((products.rows[0] as Row)?.n),
    top: (top.rows as Row[]).map((r) => ({ name: s(r.name), title: s(r.title), company: s(r.company), score: n(r.score), status: s(r.status) })),
    named,
  };
}
