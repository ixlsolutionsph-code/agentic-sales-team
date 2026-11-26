import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { PIPELINE_STATUSES, toWorkspaceStats, type WorkspaceStats } from "./statsShape";

const ACTIVITY_LIMIT = 50;

// The dashboard and team-page numbers for one workspace. Every query filters
// on the given workspace id. `monthStart` is the start of the user's current
// month (sent by the browser, so it follows the user's own time zone).
export async function getWorkspaceStats(workspaceId: string, monthStart: Date): Promise<WorkspaceStats> {
  const db = requireDb();
  const pipeline = sql.join(
    PIPELINE_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  );
  const [leads, meetings, jobs, activity] = await Promise.all([
    db.execute(sql`
      SELECT agent_id,
             count(*) AS leads,
             count(*) FILTER (WHERE status IN (${pipeline})) AS pipeline,
             coalesce(sum(score) FILTER (WHERE score > 0), 0) AS scored_sum,
             count(*) FILTER (WHERE score > 0) AS scored_count,
             count(*) FILTER (WHERE updated_at >= ${monthStart.toISOString()}::timestamptz) AS month_leads
      FROM leads
      WHERE user_id = ${workspaceId}::uuid AND review = 'accepted'
      GROUP BY agent_id`),
    db.execute(sql`
      SELECT agent_id, count(*) AS meetings FROM meetings WHERE user_id = ${workspaceId}::uuid GROUP BY agent_id`),
    db.execute(sql`
      SELECT agent_id, kind, status,
             CASE WHEN jsonb_typeof(params->'leadCount') = 'number' THEN (params->>'leadCount')::int
                  WHEN jsonb_typeof(params->'leadIds') = 'array' THEN jsonb_array_length(params->'leadIds')
                  ELSE 0 END AS lead_count
      FROM jobs
      WHERE user_id = ${workspaceId}::uuid AND status IN ('queued', 'running')`),
    db.execute(sql`
      SELECT id, agent_id, text, created_at FROM activity
      WHERE user_id = ${workspaceId}::uuid AND dismissed = false
      ORDER BY created_at DESC LIMIT ${ACTIVITY_LIMIT}`),
  ]);
  return toWorkspaceStats({
    leads: leads.rows as Record<string, unknown>[],
    meetings: meetings.rows as Record<string, unknown>[],
    jobs: jobs.rows as Record<string, unknown>[],
    activity: activity.rows as Record<string, unknown>[],
  });
}

export type TeamLead = { id: string; agentId: string; name: string; title: string; company: string; status: string; score: number };

// The first 12 accepted leads of the given agents (a team's book), oldest first.
export async function getTeamLeads(workspaceId: string, agentIds: string[]): Promise<{ leads: TeamLead[]; total: number }> {
  if (!agentIds.length) return { leads: [], total: 0 };
  const db = requireDb();
  const ids = JSON.stringify(agentIds);
  const res = await db.execute(sql`
    SELECT id, agent_id, name, title, company, status, score, count(*) OVER () AS total
    FROM leads
    WHERE user_id = ${workspaceId}::uuid AND review = 'accepted'
      AND agent_id IN (SELECT jsonb_array_elements_text(${ids}::jsonb))
    ORDER BY created_at ASC, id ASC
    LIMIT 12`);
  const rows = res.rows as Record<string, unknown>[];
  return {
    total: rows.length ? Number(rows[0].total) || 0 : 0,
    leads: rows.map((r) => ({
      id: String(r.id),
      agentId: String(r.agent_id),
      name: String(r.name ?? ""),
      title: String(r.title ?? ""),
      company: String(r.company ?? ""),
      status: String(r.status ?? ""),
      score: Number(r.score) || 0,
    })),
  };
}
