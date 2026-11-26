import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { isStage, type Lead, type LeadResearch, type NewLead } from "./types";

// Every function takes the workspace id explicitly and only touches rows of
// that workspace.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : s(v));

const LEAD_COLS = sql`id, agent_id, name, title, company, email, status, score, source, review, profile_url, platform, fit_reason, research, created_at`;
const WORKBOOK_LIMIT = 2000;

export function toLead(r: Row): Lead {
  const research = r.research && typeof r.research === "object" ? (r.research as LeadResearch) : null;
  const review = s(r.review);
  return {
    id: s(r.id),
    agentId: s(r.agent_id),
    name: s(r.name),
    title: s(r.title),
    company: s(r.company),
    email: s(r.email),
    status: isStage(r.status) ? r.status : "new",
    score: Number(r.score) || 0,
    source: s(r.source),
    review: review === "pending" || review === "dismissed" ? review : "accepted",
    profileUrl: r.profile_url == null ? null : s(r.profile_url),
    platform: r.platform == null ? null : s(r.platform),
    fitReason: s(r.fit_reason),
    research,
    createdAt: iso(r.created_at),
  };
}

// The agent's name, or null when it isn't a live (not deleted) agent of this workspace.
export async function liveAgentName(workspaceId: string, agentId: string): Promise<string | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT a.name FROM agents a
    WHERE a.user_id = ${workspaceId}::uuid AND a.id = ${agentId}
      AND NOT EXISTS (SELECT 1 FROM agent_states st WHERE st.user_id = a.user_id AND st.agent_id = a.id AND st.removed)`);
  return r.rows.length ? s((r.rows[0] as Row).name) : null;
}

// The Leads page: every lead that is not dismissed, newest first.
export async function listWorkbook(workspaceId: string): Promise<Lead[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT ${LEAD_COLS} FROM leads
    WHERE user_id = ${workspaceId}::uuid AND review <> 'dismissed'
    ORDER BY created_at DESC, id DESC
    LIMIT ${WORKBOOK_LIMIT}`);
  return (r.rows as Row[]).map(toLead);
}

// Accepted leads of the given agents (a team's pool), oldest first.
export async function listLeadsForAgents(workspaceId: string, agentIds: string[], limit = 500): Promise<Lead[]> {
  if (!agentIds.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT ${LEAD_COLS} FROM leads
    WHERE user_id = ${workspaceId}::uuid AND review = 'accepted'
      AND agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(agentIds)}::jsonb))
    ORDER BY created_at ASC, id ASC
    LIMIT ${limit}`);
  return (r.rows as Row[]).map(toLead);
}

// Profile links and emails already in the given agents' leads (for the
// lead search to skip, Milestone 8).
export async function knownLeadKeys(workspaceId: string, agentIds: string[]): Promise<{ urls: Set<string>; emails: Set<string> }> {
  const out = { urls: new Set<string>(), emails: new Set<string>() };
  if (!agentIds.length) return out;
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT profile_url, lower(email) AS email FROM leads
    WHERE user_id = ${workspaceId}::uuid
      AND agent_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(agentIds)}::jsonb))`);
  for (const row of r.rows as Row[]) {
    if (row.profile_url) out.urls.add(s(row.profile_url));
    if (row.email) out.emails.add(s(row.email));
  }
  return out;
}

async function logActivity(workspaceId: string, agentId: string, text: string, leadId: string | null) {
  const db = requireDb();
  await db.execute(sql`
    INSERT INTO activity (user_id, agent_id, type, lead_id, text)
    VALUES (${workspaceId}::uuid, ${agentId}, 'lead_added', ${leadId}::uuid, ${text})`);
}

// A lead added by hand: accepted, source "manual".
export async function insertLead(workspaceId: string, agentId: string, agentName: string, lead: NewLead): Promise<Lead | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    INSERT INTO leads (user_id, agent_id, name, title, company, email, source, review)
    SELECT ${workspaceId}::uuid, ${agentId}, ${lead.name}, ${lead.title}, ${lead.company}, ${lead.email}, 'manual', 'accepted'
    WHERE EXISTS (SELECT 1 FROM agents WHERE user_id = ${workspaceId}::uuid AND id = ${agentId})
    RETURNING ${LEAD_COLS}`);
  if (!r.rows.length) return null;
  const saved = toLead(r.rows[0] as Row);
  await logActivity(workspaceId, agentId, `${agentName} added ${saved.name}`, saved.id);
  return saved;
}

// CSV import for one agent: accepted, source "import". A row whose email
// (lower case) the agent already has is skipped. Returns the saved leads.
export async function importLeadRows(workspaceId: string, agentId: string, agentName: string, list: NewLead[]): Promise<Lead[]> {
  if (!list.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    INSERT INTO leads (user_id, agent_id, name, title, company, email, source, review)
    SELECT ${workspaceId}::uuid, ${agentId}, x.name, x.title, x.company, x.email, 'import', 'accepted'
    FROM jsonb_to_recordset(${JSON.stringify(list)}::jsonb) AS x(name text, title text, company text, email text)
    WHERE EXISTS (SELECT 1 FROM agents WHERE user_id = ${workspaceId}::uuid AND id = ${agentId})
      AND NOT EXISTS (
        SELECT 1 FROM leads l
        WHERE l.user_id = ${workspaceId}::uuid AND l.agent_id = ${agentId} AND lower(l.email) = lower(x.email)
      )
    RETURNING ${LEAD_COLS}`);
  const saved = (r.rows as Row[]).map(toLead);
  if (saved.length) {
    await logActivity(workspaceId, agentId, `${agentName} imported ${saved.length} ${saved.length === 1 ? "lead" : "leads"}`, null);
  }
  return saved;
}

export async function setLeadStatus(workspaceId: string, leadId: string, stage: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE leads SET status = ${stage}, updated_at = now()
    WHERE user_id = ${workspaceId}::uuid AND id = ${leadId}::uuid
    RETURNING id`);
  return r.rows.length === 1;
}

// Moves the lead one stage on. Returns the new stage, or null when the lead
// is missing or already at the last stage.
export async function advanceLeadRow(workspaceId: string, leadId: string): Promise<string | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE leads SET updated_at = now(), status = CASE status
      WHEN 'new' THEN 'contacted' WHEN 'contacted' THEN 'engaged'
      WHEN 'engaged' THEN 'replied' WHEN 'replied' THEN 'meeting' ELSE status END
    WHERE user_id = ${workspaceId}::uuid AND id = ${leadId}::uuid AND status IN ('new', 'contacted', 'engaged', 'replied')
    RETURNING status`);
  return r.rows.length ? s((r.rows[0] as Row).status) : null;
}

// Accept or dismiss some leads. Returns how many changed.
export async function setReviewRows(workspaceId: string, leadIds: string[], review: "accepted" | "dismissed"): Promise<number> {
  if (!leadIds.length) return 0;
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE leads SET review = ${review}, updated_at = now()
    WHERE user_id = ${workspaceId}::uuid
      AND id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(leadIds)}::jsonb))::uuid)
    RETURNING id`);
  return r.rows.length;
}

// Accept all / Dismiss all on the Pending tab.
export async function setReviewAllPending(workspaceId: string, review: "accepted" | "dismissed"): Promise<number> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE leads SET review = ${review}, updated_at = now()
    WHERE user_id = ${workspaceId}::uuid AND review = 'pending'
    RETURNING id`);
  return r.rows.length;
}

// Hard delete. Its drafts, proposal, matches and meetings go with it (cascade).
export async function deleteLeadRow(workspaceId: string, leadId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`DELETE FROM leads WHERE user_id = ${workspaceId}::uuid AND id = ${leadId}::uuid RETURNING id`);
  return r.rows.length === 1;
}

// Sidebar badges: leads waiting for review, and drafts not yet sent.
export async function navCountRows(workspaceId: string): Promise<{ leads: number; emails: number }> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM leads WHERE user_id = ${workspaceId}::uuid AND review = 'pending') AS leads,
      (SELECT count(*) FROM outreach_drafts WHERE user_id = ${workspaceId}::uuid AND status <> 'sent' AND dismissed = false) AS emails`);
  const row = (r.rows[0] ?? {}) as Row;
  return { leads: Number(row.leads) || 0, emails: Number(row.emails) || 0 };
}

export type LeadExtras = {
  matches: { productName: string; score: number; reason: string }[];
  drafts: { id: string; subject: string; body: string; status: string; createdAt: string }[];
};

// The lead details window: its product matches and email drafts.
export async function leadExtras(workspaceId: string, leadId: string): Promise<LeadExtras> {
  const db = requireDb();
  const [m, d] = await Promise.all([
    db.execute(sql`
      SELECT p.name AS product_name, m.score, m.reason FROM matches m
      JOIN products p ON p.id = m.product_id AND p.user_id = m.user_id
      WHERE m.user_id = ${workspaceId}::uuid AND m.lead_id = ${leadId}::uuid
      ORDER BY m.score DESC`),
    db.execute(sql`
      SELECT id, subject, body, status, created_at FROM outreach_drafts
      WHERE user_id = ${workspaceId}::uuid AND lead_id = ${leadId}::uuid AND dismissed = false
      ORDER BY created_at DESC`),
  ]);
  return {
    matches: (m.rows as Row[]).map((r) => ({ productName: s(r.product_name), score: Number(r.score) || 0, reason: s(r.reason) })),
    drafts: (d.rows as Row[]).map((r) => ({ id: s(r.id), subject: s(r.subject), body: s(r.body), status: s(r.status), createdAt: iso(r.created_at) })),
  };
}
