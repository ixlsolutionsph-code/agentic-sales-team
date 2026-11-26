import "server-only";
import { sql } from "drizzle-orm";
import type { AssessResult } from "@/lib/ai/assess";
import type { EngineResearch } from "@/lib/ai/engine";
import type { ProductMatch } from "@/lib/ai/match";
import type { OutreachResult } from "@/lib/ai/outreach";
import type { ProposalResult } from "@/lib/ai/proposal";
import type { QualifyResult } from "@/lib/ai/qualify";
import { requireDb } from "@/lib/db";

// Writes an engine's result for one lead. Each write is one statement, so
// it is all-or-nothing. Every query filters on the workspace id.

type Who = { workspaceId: string; agentId: string; agentName: string; leadId: string; leadName: string };

export async function applyResearchResult(w: Who, research: EngineResearch): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    WITH u AS (
      UPDATE leads SET research = ${JSON.stringify(research)}::jsonb, updated_at = now()
      WHERE user_id = ${w.workspaceId}::uuid AND id = ${w.leadId}::uuid
      RETURNING id
    ), a AS (
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      SELECT ${w.workspaceId}::uuid, ${w.agentId}, 'lead_researched', id, ${`${w.agentName} researched ${w.leadName}`} FROM u
    )
    SELECT id FROM u`);
  return r.rows.length === 1;
}

export async function applyQualifyResult(w: Who, q: QualifyResult): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    WITH u AS (
      UPDATE leads SET score = ${q.score}, qualified_at = now(), updated_at = now()
      WHERE user_id = ${w.workspaceId}::uuid AND id = ${w.leadId}::uuid
      RETURNING id
    ), a AS (
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      SELECT ${w.workspaceId}::uuid, ${w.agentId}, 'lead_qualified', id,
             ${`${w.agentName} scored ${w.leadName} ${q.score} (${q.tier})`} FROM u
    )
    SELECT id FROM u`);
  return r.rows.length === 1;
}

// Only a lead that is still pending is changed. A failed-open result keeps
// the lead's fit reason (no "auto-accepted" text is written).
export async function applyAssessResult(w: Who, a: AssessResult): Promise<boolean> {
  const db = requireDb();
  const review = a.accept ? "accepted" : "dismissed";
  const r = await db.execute(sql`
    WITH u AS (
      UPDATE leads SET review = ${review}, score = ${a.score}, updated_at = now(),
        fit_reason = CASE WHEN ${a.reason !== null}::boolean THEN ${a.reason ?? ""} ELSE fit_reason END
      WHERE user_id = ${w.workspaceId}::uuid AND id = ${w.leadId}::uuid AND review = 'pending'
      RETURNING id
    ), x AS (
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      SELECT ${w.workspaceId}::uuid, ${w.agentId}, 'lead_assessed', id,
             ${`${w.agentName} ${a.accept ? "accepted" : "dismissed"} ${w.leadName}`} FROM u
    )
    SELECT id FROM u`);
  return r.rows.length === 1;
}

// Replaces the lead's matches and sets matched_at (also when nothing fits).
// Only products of this workspace are linked. No activity row.
export async function applyMatchResult(w: Who, matches: ProductMatch[]): Promise<number> {
  const db = requireDb();
  const r = await db.execute(sql`
    WITH d AS (
      DELETE FROM matches WHERE user_id = ${w.workspaceId}::uuid AND lead_id = ${w.leadId}::uuid
    ), u AS (
      UPDATE leads SET matched_at = now(), updated_at = now()
      WHERE user_id = ${w.workspaceId}::uuid AND id = ${w.leadId}::uuid
      RETURNING id
    ), i AS (
      INSERT INTO matches (user_id, agent_id, lead_id, product_id, score, reason)
      SELECT ${w.workspaceId}::uuid, ${w.agentId}, u.id, x."productId"::uuid, x.score, x.reason
      FROM u, jsonb_to_recordset(${JSON.stringify(matches)}::jsonb) AS x("productId" text, score int, reason text)
      WHERE EXISTS (SELECT 1 FROM products p WHERE p.user_id = ${w.workspaceId}::uuid AND p.id = x."productId"::uuid)
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM i) AS n, (SELECT count(*)::int FROM u) AS leads`);
  return Number((r.rows[0] as Record<string, unknown>)?.n) || 0;
}

// The draft, the lead's score and the activity row together. A lead that
// already has an open draft gets nothing (the unique index decides, so two
// runs at once still leave one draft). Outreach never changes the stage.
export async function applyOutreachResult(w: Who, o: OutreachResult): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    WITH d AS (
      INSERT INTO outreach_drafts (user_id, agent_id, lead_id, subject, body, rationale)
      SELECT ${w.workspaceId}::uuid, ${w.agentId}, l.id, ${o.subject}, ${o.body}, ${o.rationale}
      FROM leads l WHERE l.user_id = ${w.workspaceId}::uuid AND l.id = ${w.leadId}::uuid
      ON CONFLICT (lead_id) WHERE status <> 'sent' AND dismissed = false DO NOTHING
      RETURNING id, lead_id
    ), u AS (
      UPDATE leads SET score = ${o.score}, updated_at = now()
      WHERE user_id = ${w.workspaceId}::uuid AND id IN (SELECT lead_id FROM d)
    ), a AS (
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      SELECT ${w.workspaceId}::uuid, ${w.agentId}, 'email_drafted', lead_id, ${`${w.agentName} drafted an email to ${w.leadName}`} FROM d
    )
    SELECT id FROM d`);
  return r.rows.length === 1;
}

// One proposal per lead (unique index). No activity row.
export async function applyProposalResult(w: Who, p: ProposalResult): Promise<boolean> {
  const db = requireDb();
  const r = await db.execute(sql`
    INSERT INTO proposals (user_id, agent_id, lead_id, title, body, products)
    SELECT ${w.workspaceId}::uuid, ${w.agentId}, l.id, ${p.title}, ${p.body}, ${JSON.stringify(p.productsUsed)}::jsonb
    FROM leads l WHERE l.user_id = ${w.workspaceId}::uuid AND l.id = ${w.leadId}::uuid
    ON CONFLICT (lead_id) DO NOTHING
    RETURNING id`);
  return r.rows.length === 1;
}

// Fills the fit reason only where it is empty.
export async function setFitReasonIfEmpty(workspaceId: string, leadId: string, reason: string): Promise<void> {
  const db = requireDb();
  await db.execute(sql`
    UPDATE leads SET fit_reason = ${reason}
    WHERE user_id = ${workspaceId}::uuid AND id = ${leadId}::uuid AND fit_reason = ''`);
}
