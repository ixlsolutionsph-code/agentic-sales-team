import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import type { Step } from "@/lib/scrape/steps";
import { STALE_AFTER_MS, STALE_SCRAPE_AFTER_MS } from "./runtime";
import { MSG_TIMED_OUT, type JobKind, type JobStatus } from "./limits";

// The work queue (jobs table). Functions that act on one workspace take its
// id explicitly; the claim and reap functions also run for all workspaces
// (the cron runner) when the id is null.

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : s(v));

export type JobParams = {
  agent: { id: string; name: string; role: string; goal: string; task: string };
  leadIds?: string[];
  batchSize?: number;
  instruction?: string;
  teamId?: string;
  pod?: boolean;
  leadCount?: number;
};

export type JobRow = {
  id: string;
  workspaceId: string;
  agentId: string;
  kind: JobKind;
  status: JobStatus;
  params: JobParams;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export function toJob(r: Row): JobRow {
  return {
    id: s(r.id),
    workspaceId: s(r.user_id),
    agentId: s(r.agent_id),
    kind: s(r.kind) as JobKind,
    status: s(r.status) as JobStatus,
    params: (r.params && typeof r.params === "object" ? r.params : {}) as JobParams,
    result: r.result && typeof r.result === "object" ? (r.result as Record<string, unknown>) : null,
    error: r.error == null ? null : s(r.error),
    createdAt: iso(r.created_at) ?? "",
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
  };
}

export async function insertJob(
  workspaceId: string,
  j: { agentId: string; kind: JobKind; status: "queued" | "needs_approval"; params: JobParams },
): Promise<JobRow> {
  const db = requireDb();
  const r = await db.execute(sql`
    INSERT INTO jobs (user_id, agent_id, kind, status, params)
    VALUES (${workspaceId}::uuid, ${j.agentId}, ${j.kind}, ${j.status}, ${JSON.stringify(j.params)}::jsonb)
    RETURNING *`);
  return toJob(r.rows[0] as Row);
}

// Runs started in the last 24 h across all of an account's workspaces. Lead
// searches (scrape) have their own limit; book-meeting is not a run.
export async function countRecentRuns(workspaceIds: string[], kinds: "runs" | "searches"): Promise<number> {
  if (!workspaceIds.length) return 0;
  const db = requireDb();
  const filter = kinds === "searches" ? sql`kind = 'scrape'` : sql`kind NOT IN ('scrape', 'book-meeting')`;
  const r = await db.execute(sql`
    SELECT count(*)::int AS n FROM jobs
    WHERE user_id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(workspaceIds)}::jsonb))::uuid)
      AND created_at > now() - interval '24 hours' AND ${filter}`);
  return Number((r.rows[0] as Row)?.n) || 0;
}

// A running job older than its limit is failed with the timed-out message
// and never started again.
export async function reapStaleJobs(workspaceId: string | null): Promise<number> {
  const db = requireDb();
  const ws = workspaceId ? sql`AND user_id = ${workspaceId}::uuid` : sql``;
  const r = await db.execute(sql`
    UPDATE jobs SET status = 'failed', error = ${MSG_TIMED_OUT}, finished_at = now()
    WHERE status = 'running' ${ws}
      AND started_at < now() - (CASE WHEN kind = 'scrape' THEN ${STALE_SCRAPE_AFTER_MS}::int ELSE ${STALE_AFTER_MS}::int END) * interval '1 millisecond'
    RETURNING id`);
  return r.rows.length;
}

// Claims the oldest queued job atomically (only one runner can get it).
export async function claimNextJob(workspaceId: string | null, kinds: readonly JobKind[]): Promise<JobRow | null> {
  const db = requireDb();
  const ws = workspaceId ? sql`AND user_id = ${workspaceId}::uuid` : sql``;
  const r = await db.execute(sql`
    UPDATE jobs SET status = 'running', started_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued' ${ws}
        AND kind IN (SELECT jsonb_array_elements_text(${JSON.stringify(kinds)}::jsonb))
      ORDER BY created_at ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) AND status = 'queued'
    RETURNING *`);
  return r.rows.length ? toJob(r.rows[0] as Row) : null;
}

// Ends a running job. Keeps the steps already written.
export async function finishJob(jobId: string, status: "done" | "failed", result: Record<string, unknown>, error: string | null): Promise<void> {
  const db = requireDb();
  await db.execute(sql`
    UPDATE jobs SET status = ${status}, error = ${error}, finished_at = now(),
      result = COALESCE(result, '{}'::jsonb) || ${JSON.stringify(result)}::jsonb
    WHERE id = ${jobId}::uuid AND status = 'running'`);
}

// Saves the live timeline, only while the job is still running.
export async function writeSteps(jobId: string, steps: Step[]): Promise<void> {
  const db = requireDb();
  await db.execute(sql`
    UPDATE jobs SET result = jsonb_set(COALESCE(result, '{}'::jsonb), '{steps}', ${JSON.stringify(steps)}::jsonb)
    WHERE id = ${jobId}::uuid AND status = 'running'`);
}

export async function listAgentJobs(workspaceId: string, agentId: string, limit = 20): Promise<JobRow[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT * FROM jobs WHERE user_id = ${workspaceId}::uuid AND agent_id = ${agentId}
    ORDER BY created_at DESC, id DESC LIMIT ${limit}`);
  return (r.rows as Row[]).map(toJob);
}

export async function getJobs(workspaceId: string, ids: string[]): Promise<JobRow[]> {
  if (!ids.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT * FROM jobs WHERE user_id = ${workspaceId}::uuid
      AND id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid)`);
  return (r.rows as Row[]).map(toJob);
}
