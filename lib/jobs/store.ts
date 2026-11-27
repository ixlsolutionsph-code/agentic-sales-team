import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import type { ScrapeBrief } from "@/lib/chat/markers";
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
  target?: number; // lead search: how many leads to find
  // The chain (Milestone 9):
  brief?: ScrapeBrief; // the search brief, carried down the chain for the wider-search offer
  runId?: string; // the id of the job that started this run of the chain
  stopped?: boolean; // the team pressed Cancel while this job was running
  cleared?: boolean; // the team's chat was cleared while this job was running
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

// Claims one queued job of this workspace by id (the browser's "run this
// search now"). Null when it is not queued any more.
export async function claimJobById(workspaceId: string, jobId: string, kind: JobKind): Promise<JobRow | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE jobs SET status = 'running', started_at = now()
    WHERE id = ${jobId}::uuid AND user_id = ${workspaceId}::uuid AND kind = ${kind} AND status = 'queued'
    RETURNING *`);
  return r.rows.length ? toJob(r.rows[0] as Row) : null;
}

export async function getJob(workspaceId: string, jobId: string): Promise<JobRow | null> {
  const db = requireDb();
  const r = await db.execute(sql`SELECT * FROM jobs WHERE id = ${jobId}::uuid AND user_id = ${workspaceId}::uuid`);
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

// ---------------------------------------------------------------- the chain (Milestone 9)

// Adds keys to a job's params (the runners never write params).
export async function mergeJobParams(workspaceId: string, jobId: string, patch: Partial<JobParams>): Promise<void> {
  const db = requireDb();
  await db.execute(sql`
    UPDATE jobs SET params = params || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${jobId}::uuid AND user_id = ${workspaceId}::uuid`);
}

// Moves a job from one status to another atomically. Null when it was not in
// the `from` status any more.
export async function moveJobStatus(workspaceId: string, jobId: string, from: JobStatus, to: JobStatus): Promise<JobRow | null> {
  const db = requireDb();
  const fin = to === "dismissed" ? sql`, finished_at = now()` : sql``;
  const r = await db.execute(sql`
    UPDATE jobs SET status = ${to} ${fin}
    WHERE id = ${jobId}::uuid AND user_id = ${workspaceId}::uuid AND status = ${from}
    RETURNING *`);
  return r.rows.length ? toJob(r.rows[0] as Row) : null;
}

// The team's jobs in the given statuses, oldest first (optionally one kind).
export async function teamJobsIn(workspaceId: string, teamId: string, statuses: readonly JobStatus[], kind?: JobKind): Promise<JobRow[]> {
  const db = requireDb();
  const k = kind ? sql`AND kind = ${kind}` : sql``;
  const r = await db.execute(sql`
    SELECT * FROM jobs
    WHERE user_id = ${workspaceId}::uuid AND params->>'teamId' = ${teamId}
      AND status IN (SELECT jsonb_array_elements_text(${JSON.stringify(statuses)}::jsonb)) ${k}
    ORDER BY created_at ASC, id ASC`);
  return (r.rows as Row[]).map(toJob);
}

// Dismisses the team's waiting (needs_approval) and, unless onlyWaiting,
// queued jobs, except one id if given. Returns the dismissed jobs.
export async function dismissTeamOpenJobs(workspaceId: string, teamId: string, opts: { except?: string; onlyWaiting?: boolean } = {}): Promise<JobRow[]> {
  const db = requireDb();
  const statuses = opts.onlyWaiting ? ["needs_approval"] : ["needs_approval", "queued"];
  const except = opts.except ? sql`AND id <> ${opts.except}::uuid` : sql``;
  const r = await db.execute(sql`
    UPDATE jobs SET status = 'dismissed', finished_at = now()
    WHERE user_id = ${workspaceId}::uuid AND params->>'teamId' = ${teamId}
      AND status IN (SELECT jsonb_array_elements_text(${JSON.stringify(statuses)}::jsonb)) ${except}
    RETURNING *`);
  return (r.rows as Row[]).map(toJob);
}

// Flags the team's running jobs (Cancel → stopped, Clear chat → cleared), so
// they finish but hand nothing on. Returns the flagged jobs.
export async function flagTeamRunningJobs(workspaceId: string, teamId: string, flag: "stopped" | "cleared"): Promise<JobRow[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE jobs SET params = params || ${JSON.stringify({ [flag]: true })}::jsonb
    WHERE user_id = ${workspaceId}::uuid AND params->>'teamId' = ${teamId} AND status = 'running'
    RETURNING *`);
  return (r.rows as Row[]).map(toJob);
}

// The newest chain job of the team (any status), or null.
export async function latestTeamPodJob(workspaceId: string, teamId: string): Promise<JobRow | null> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT * FROM jobs
    WHERE user_id = ${workspaceId}::uuid AND params->>'teamId' = ${teamId} AND params->>'pod' = 'true'
    ORDER BY created_at DESC, id DESC LIMIT 1`);
  return r.rows.length ? toJob(r.rows[0] as Row) : null;
}

// Every job of one run of the team's chain (params.runId, or the first job
// itself), oldest first.
// Cancel also flags the run's steps that finished in the last 2 minutes, so a
// step that ended just before Cancel (its hand-off not posted yet) hands
// nothing on. Returns them.
export async function flagRecentRunJobs(workspaceId: string, teamId: string, runId: string): Promise<JobRow[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    UPDATE jobs SET params = params || '{"stopped": true}'::jsonb
    WHERE user_id = ${workspaceId}::uuid AND params->>'teamId' = ${teamId}
      AND (params->>'runId' = ${runId} OR id = ${runId}::uuid)
      AND status IN ('done', 'failed') AND finished_at > now() - interval '2 minutes'
    RETURNING *`);
  return (r.rows as Row[]).map(toJob);
}

export async function teamRunJobs(workspaceId: string, teamId: string, runId: string): Promise<JobRow[]> {
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT * FROM jobs
    WHERE user_id = ${workspaceId}::uuid AND params->>'teamId' = ${teamId}
      AND (params->>'runId' = ${runId} OR id = ${runId}::uuid)
    ORDER BY created_at ASC, id ASC`);
  return (r.rows as Row[]).map(toJob);
}

export type ApprovalRow = { job: JobRow; teamId: string; teamName: string; agentName: string; askText: string | null };

// Steps waiting for Proceed, newest first, with the team and agent names and
// the ask message (the newest message of the team carrying ⟦approve:id⟧).
export async function listTeamApprovals(workspaceId: string, teamId?: string, limit = 50): Promise<ApprovalRow[]> {
  const db = requireDb();
  const team = teamId ? sql`AND t.id = ${teamId}` : sql``;
  const r = await db.execute(sql`
    SELECT j.*, t.id AS team_id, t.name AS team_name, a.name AS agent_name, m.text AS ask_text
    FROM jobs j
    JOIN teams t ON t.user_id = j.user_id AND t.id = j.params->>'teamId'
    LEFT JOIN agents a ON a.user_id = j.user_id AND a.id = j.agent_id
    LEFT JOIN LATERAL (
      SELECT text FROM messages
      WHERE user_id = j.user_id AND agent_id = t.id AND position(('⟦approve:' || j.id::text || '⟧') in text) > 0
      ORDER BY id DESC LIMIT 1
    ) m ON true
    WHERE j.user_id = ${workspaceId}::uuid AND j.status = 'needs_approval' ${team}
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT ${limit}`);
  return (r.rows as Row[]).map((row) => {
    const job = toJob(row);
    return {
      job,
      teamId: s(row.team_id),
      teamName: s(row.team_name),
      agentName: s(row.agent_name) || job.params.agent?.name || "",
      askText: row.ask_text == null ? null : s(row.ask_text),
    };
  });
}

export async function getJobs(workspaceId: string, ids: string[]): Promise<JobRow[]> {
  if (!ids.length) return [];
  const db = requireDb();
  const r = await db.execute(sql`
    SELECT * FROM jobs WHERE user_id = ${workspaceId}::uuid
      AND id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid)`);
  return (r.rows as Row[]).map(toJob);
}
