import "server-only";
import type { FollowJob } from "@/lib/chat/contract";
import type { ScrapeBrief } from "@/lib/chat/markers";
import { postJobMessage, postTeamMessage } from "@/lib/chat/teamMessages";
import { loadAgentSettings, loadTeamMembers, pickLeads, poolOf, productCount, workspaceOwner } from "@/lib/jobs/context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { MSG_NO_SEARCH_KEY, msgCantRun } from "@/lib/jobs/limits";
import { dismissTeamOpenJobs, getJob, mergeJobParams, moveJobStatus, teamJobsIn, type JobRow } from "@/lib/jobs/store";
import { capMode } from "./autonomy";
import { decideChain } from "./chain";
import { MSG_ALREADY_HANDLED, MSG_TEAM_GONE, busyText, scrapeAskText, stageAskText, startText, withApprove } from "./summary";
import { POD_BATCH, isPodStage, type PodStage } from "./types";

// The chain (01-prd.md §7.2) and the approval gate (§7.5).
//
// A "run" is one go of the chain: the stage the user started (through
// enqueuePodStage) and every stage chainNext queued after it. Each job of a
// run carries params.runId = the id of the run's first job; Cancel summarises
// the jobs of the newest run.

export type PodStageInput = {
  teamId: string;
  agentId: string;
  kind: PodStage;
  leadIds?: string[];
  instruction?: string; // scrape: "{what}. Selling: {product (desc)}. Location: {where}."
  target?: number; // scrape: 1–25
  brief?: import("@/lib/chat/markers").ScrapeBrief; // scrape: kept for "look for more" and wider search
};

type StageResult = { ok: true; job: JobRow; follow: FollowJob | null } | { ok: false; error: string };

// Same check as lib/jobs/scrape.ts isSearchConfigured (not imported, so the
// runner and this module don't import each other).
const searchReady = () => Boolean(process.env.FIRECRAWL_API_KEY?.trim());

// The ask text of a stage that works on leads: it names the leads it would pick now.
async function leadAskText(workspaceId: string, job: JobRow, kind: PodStage): Promise<string> {
  const pool = await poolOf(workspaceId, job.agentId);
  const leads = await pickLeads(workspaceId, kind, pool.agentIds, job.params.leadIds, POD_BATCH);
  return stageAskText(kind, leads.length, leads.map((l) => l.name));
}

async function queueStage(workspaceId: string, accountId: string, input: PodStageInput, run?: { runId: string; brief?: ScrapeBrief }): Promise<StageResult> {
  const { teamId, agentId, kind } = input;
  if (!isPodStage(kind)) return { ok: false, error: msgCantRun(String(kind)) };
  const team = await loadTeamMembers(workspaceId, teamId);
  if (!team) return { ok: false, error: MSG_TEAM_GONE };

  // Busy: the team already has this stage waiting, queued or running.
  const open = await teamJobsIn(workspaceId, teamId, ["needs_approval", "queued", "running"], kind);
  if (open.length) return { ok: false, error: busyText(kind, open.every((j) => j.status === "needs_approval")) };
  if (kind === "scrape" && !searchReady()) return { ok: false, error: MSG_NO_SEARCH_KEY };

  const ask = capMode(await loadAgentSettings(workspaceId, agentId), kind) !== "auto";
  const brief = input.brief ?? run?.brief;
  const leadIds = input.leadIds?.length ? input.leadIds : undefined;
  // The other checks (paused, capability, AI, ≤ 25 leads, instruction length,
  // daily limit) are enqueueJob's. The job is made waiting first and moved to
  // queued below for Auto, so the run id is saved before any runner sees it.
  const res = await enqueueJob(workspaceId, accountId, {
    agentId,
    kind,
    leadIds,
    batchSize: POD_BATCH,
    instruction: input.instruction,
    ask: true,
    teamId,
    pod: true,
    target: input.target ?? brief?.count,
  });
  if (typeof res === "string") return { ok: false, error: res };

  // Older open asks of the team are dropped: only the newest step waits.
  await dismissTeamOpenJobs(workspaceId, teamId, { except: res.id, onlyWaiting: true });
  const patch = { runId: run?.runId ?? res.id, ...(brief ? { brief } : {}) };
  await mergeJobParams(workspaceId, res.id, patch);
  let job: JobRow = { ...res, params: { ...res.params, ...patch } };

  if (!ask) {
    const queued = await moveJobStatus(workspaceId, job.id, "needs_approval", "queued");
    if (!queued) return { ok: false, error: MSG_ALREADY_HANDLED };
    job = queued;
    await postTeamMessage(workspaceId, teamId, agentId, startText(kind, job.id));
    return { ok: true, job, follow: { jobId: job.id, kind } };
  }

  const text =
    kind === "scrape" ? scrapeAskText(brief, Number(job.params.target) || 10, job.params.instruction ?? "") : await leadAskText(workspaceId, job, kind);
  await postTeamMessage(workspaceId, teamId, agentId, withApprove(text, job.id));
  return { ok: true, job, follow: null };
}

// Queues one stage for a team member (Ask → needs_approval + ask message with
// ⟦approve:id⟧; Auto → queued + start message). Posts its own chat messages
// as the agent. Returns the follow job (Auto) or null (Ask), or an error text
// the caller posts. Each call starts a new run.
export async function enqueuePodStage(
  workspaceId: string,
  accountId: string,
  input: PodStageInput,
): Promise<{ ok: true; job: JobRow; follow: FollowJob | null } | { ok: false; error: string }> {
  return queueStage(workspaceId, accountId, input);
}

// Called by the runners when a pod job ends (params.pod && params.teamId),
// with the job as stored after it finished. Posts the result once (as the
// agent, idempotent per job), then queues the next stage, or stops with the
// reason (01-prd.md §7.2). Only queues: the browser or the cron runs the job.
export async function chainNext(job: JobRow): Promise<void> {
  const teamId = job.params.teamId;
  if (!job.params.pod || !teamId || !isPodStage(job.kind)) return;
  if (job.status !== "done" && job.status !== "failed") return;
  // The chat was cleared while the job ran: say nothing, hand nothing on.
  if (job.params.cleared) return;

  const ws = job.workspaceId;
  const team = await loadTeamMembers(ws, teamId);
  if (!team) return;
  const catalogEmpty = (await productCount(ws)) === 0;
  const out = decideChain(
    {
      kind: job.kind,
      agentId: job.agentId,
      status: job.status,
      error: job.error,
      result: job.result,
      stopped: job.params.stopped === true,
      brief: job.params.brief,
    },
    team.members,
    catalogEmpty,
  );

  const posted = await postJobMessage(ws, teamId, job.agentId, job.id, out.text);
  if (!posted || !out.next) return; // already handed on, or the chain stops here

  const accountId = await workspaceOwner(ws);
  if (!accountId) return;
  const res = await queueStage(
    ws,
    accountId,
    { teamId, agentId: out.next.agentId, kind: out.next.kind, leadIds: out.next.leadIds },
    { runId: job.params.runId ?? job.id, brief: job.params.brief },
  );
  if (!res.ok) {
    await postTeamMessage(ws, teamId, out.next.agentId, res.error);
    return;
  }
  // A Cancel that arrived while this hand-off was being made: undo the new step.
  const after = await getJob(ws, job.id);
  if (after?.params.stopped || after?.params.cleared) {
    (await moveJobStatus(ws, res.job.id, "queued", "dismissed")) ?? (await moveJobStatus(ws, res.job.id, "needs_approval", "dismissed"));
  }
}

// For the runners, after finishJob: reloads the job (so status, result and
// the stop flags are final) and runs chainNext. Never throws.
export async function chainAfterRun(job: JobRow): Promise<void> {
  if (!job.params.pod || !job.params.teamId) return;
  try {
    const fresh = await getJob(job.workspaceId, job.id);
    if (fresh) await chainNext(fresh);
  } catch (e) {
    console.error(`chainNext for job ${job.id} failed`, e instanceof Error ? e.message : e);
  }
}
