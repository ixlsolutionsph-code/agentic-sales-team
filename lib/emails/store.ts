import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";

// Email drafts and proposals. Nothing here sends anything: the owner sends
// from their own mail app, then marks the draft as sent. Every query filters
// on the workspace id.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : s(v));

export type Draft = {
  id: string;
  agentId: string;
  leadId: string;
  leadName: string;
  leadTitle: string;
  company: string;
  email: string;
  profileUrl: string | null;
  platform: string | null;
  subject: string;
  body: string;
  rationale: string;
  status: "draft" | "sent";
  createdAt: string;
  sentAt: string | null;
};

export type Proposal = {
  id: string;
  agentId: string;
  leadId: string;
  leadName: string;
  company: string;
  email: string;
  title: string;
  body: string;
  products: string[];
  status: "draft" | "sent";
  createdAt: string;
  sentAt: string | null;
};

const toDraft = (r: Row): Draft => ({
  id: s(r.id),
  agentId: s(r.agent_id),
  leadId: s(r.lead_id),
  leadName: s(r.lead_name),
  leadTitle: s(r.lead_title),
  company: s(r.company),
  email: s(r.email),
  profileUrl: r.profile_url == null ? null : s(r.profile_url),
  platform: r.platform == null ? null : s(r.platform),
  subject: s(r.subject),
  body: s(r.body),
  rationale: s(r.rationale),
  status: r.status === "sent" ? "sent" : "draft",
  createdAt: iso(r.created_at) ?? "",
  sentAt: iso(r.sent_at),
});

// Drafts that are not discarded, newest first; optionally of one agent.
export async function listDrafts(workspaceId: string, agentId?: string): Promise<Draft[]> {
  const db = requireDb();
  const byAgent = agentId ? sql`AND d.agent_id = ${agentId}` : sql``;
  const r = await db.execute(sql`
    SELECT d.id, d.agent_id, d.lead_id, d.subject, d.body, d.rationale, d.status, d.created_at, d.sent_at,
           l.name AS lead_name, l.title AS lead_title, l.company, l.email, l.profile_url, l.platform
    FROM outreach_drafts d JOIN leads l ON l.id = d.lead_id AND l.user_id = d.user_id
    WHERE d.user_id = ${workspaceId}::uuid AND d.dismissed = false ${byAgent}
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1000`);
  return (r.rows as Row[]).map(toDraft);
}

// Mark sent: the draft is sent, the lead moves new → contacted (only from
// new), and an email_sent activity row is written, all in one statement.
export async function markDraftSent(workspaceId: string, draftId: string): Promise<{ leadStatus: string } | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    WITH d AS (
      UPDATE outreach_drafts SET status = 'sent', sent_at = now()
      WHERE user_id = ${workspaceId}::uuid AND id = ${draftId}::uuid AND status <> 'sent' AND dismissed = false
      RETURNING lead_id, agent_id
    ), l AS (
      UPDATE leads SET status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, updated_at = now()
      WHERE user_id = ${workspaceId}::uuid AND id IN (SELECT lead_id FROM d)
      RETURNING id, name, status
    ), a AS (
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      SELECT ${workspaceId}::uuid, d.agent_id, 'email_sent', d.lead_id, 'Email to ' || l.name || ' marked as sent'
      FROM d JOIN l ON l.id = d.lead_id
    )
    SELECT status FROM l`);
  return r.rows.length ? { leadStatus: s((r.rows[0] as Row).status) } : null;
}

// Discard hides a draft. The row stays, so counts that read every row don't drop.
export async function discardDraft(workspaceId: string, draftId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE outreach_drafts SET dismissed = true
    WHERE user_id = ${workspaceId}::uuid AND id = ${draftId}::uuid AND dismissed = false
    RETURNING id`);
  return r.rows.length === 1;
}

// Clear sent: hides every sent draft.
export async function clearSentDrafts(workspaceId: string): Promise<number> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE outreach_drafts SET dismissed = true
    WHERE user_id = ${workspaceId}::uuid AND status = 'sent' AND dismissed = false
    RETURNING id`);
  return r.rows.length;
}

export async function listProposals(workspaceId: string, agentId?: string): Promise<Proposal[]> {
  const db = requireDb();
  const byAgent = agentId ? sql`AND p.agent_id = ${agentId}` : sql``;
  const r = await db.execute(sql`
    SELECT p.id, p.agent_id, p.lead_id, p.title, p.body, p.products, p.status, p.created_at, p.sent_at,
           l.name AS lead_name, l.company, l.email
    FROM proposals p JOIN leads l ON l.id = p.lead_id AND l.user_id = p.user_id
    WHERE p.user_id = ${workspaceId}::uuid ${byAgent}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 500`);
  return (r.rows as Row[]).map((x) => ({
    id: s(x.id),
    agentId: s(x.agent_id),
    leadId: s(x.lead_id),
    leadName: s(x.lead_name),
    company: s(x.company),
    email: s(x.email),
    title: s(x.title),
    body: s(x.body),
    products: Array.isArray(x.products) ? (x.products as unknown[]).map(String) : [],
    status: x.status === "sent" ? "sent" : "draft",
    createdAt: iso(x.created_at) ?? "",
    sentAt: iso(x.sent_at),
  }));
}

export async function markProposalSentRow(workspaceId: string, proposalId: string): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE proposals SET status = 'sent', sent_at = now()
    WHERE user_id = ${workspaceId}::uuid AND id = ${proposalId}::uuid AND status <> 'sent'
    RETURNING id`);
  return r.rows.length === 1;
}

export type AgentWorkStats = { leads: number; sent: number; drafts: number; replied: number; researched: number };

// The agent page's Performance numbers and the /agents card line, per agent.
export async function agentWorkStats(workspaceId: string): Promise<Record<string, AgentWorkStats>> {
  const db = requireDb();
  const [l, d] = await Promise.all([
    db.execute(sql`
      SELECT agent_id, count(*)::int AS leads, count(*) FILTER (WHERE research IS NOT NULL)::int AS researched
      FROM leads WHERE user_id = ${workspaceId}::uuid AND review = 'accepted' GROUP BY agent_id`),
    db.execute(sql`
      SELECT d.agent_id, count(*)::int AS drafts,
             count(*) FILTER (WHERE d.status = 'sent')::int AS sent,
             count(*) FILTER (WHERE d.status = 'sent' AND l.status IN ('replied', 'meeting'))::int AS replied
      FROM outreach_drafts d JOIN leads l ON l.id = d.lead_id
      WHERE d.user_id = ${workspaceId}::uuid GROUP BY d.agent_id`),
  ]);
  const out: Record<string, AgentWorkStats> = {};
  const get = (id: string) => (out[id] ??= { leads: 0, sent: 0, drafts: 0, replied: 0, researched: 0 });
  for (const r of l.rows as Row[]) Object.assign(get(s(r.agent_id)), { leads: Number(r.leads) || 0, researched: Number(r.researched) || 0 });
  for (const r of d.rows as Row[]) Object.assign(get(s(r.agent_id)), { drafts: Number(r.drafts) || 0, sent: Number(r.sent) || 0, replied: Number(r.replied) || 0 });
  return out;
}
