"use server";

// Thin server actions for runs: read the session, check the input, then call
// the server-only modules with the active workspace id.
import { AGENT_ID_RE } from "@/lib/agents/new";
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { agentWorkStats, listDrafts, listProposals, type AgentWorkStats, type Draft, type Proposal } from "@/lib/emails/store";
import { UUID_RE } from "@/lib/products/shape";
import { enqueueJob, enqueueOutreachJob } from "./enqueue";
import type { Step } from "@/lib/scrape/steps";
import { MAX_LEADS_PER_RUN, MSG_SEARCH_FAILED, MSG_TOO_MANY_LEADS, RUNNABLE_KINDS, SEARCH_TARGET, type JobKind } from "./limits";
import { getJob, getJobs, listAgentJobs } from "./store";
import { toTask, type Task } from "./tasks";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const TRY_AGAIN = "Something went wrong. Please try again.";

// Queues one run of an agent. Pressing the button is the owner's go-ahead,
// so the job is queued at once; the browser then calls POST /api/jobs/run.
export async function startRun(input: { agentId: string; kind: JobKind; leadIds?: string[] }): Promise<ActionResult<{ jobId: string }>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (!input || typeof input.agentId !== "string" || !AGENT_ID_RE.test(input.agentId)) return fail(TRY_AGAIN);
  if (!RUNNABLE_KINDS.includes(input.kind)) return fail(TRY_AGAIN);
  if (input.leadIds !== undefined) {
    if (!Array.isArray(input.leadIds) || !input.leadIds.every((id) => typeof id === "string" && UUID_RE.test(id))) return fail(TRY_AGAIN);
    if (input.leadIds.length > MAX_LEADS_PER_RUN) return fail(MSG_TOO_MANY_LEADS);
  }
  try {
    const base = { agentId: input.agentId, leadIds: input.leadIds };
    const res = input.kind === "outreach" ? await enqueueOutreachJob(s.userId, s.accountId, base) : await enqueueJob(s.userId, s.accountId, { ...base, kind: input.kind });
    return typeof res === "string" ? fail(res) : { ok: true, data: { jobId: res.id } };
  } catch (e) {
    console.error("startRun failed", e);
    return fail(MSG.serverDown);
  }
}

export type AgentWork = { tasks: Task[]; drafts: Draft[]; proposals: Proposal[]; stats: AgentWorkStats };

// Everything the agent page shows about the agent's work.
export async function loadAgentWork(agentId: string): Promise<ActionResult<AgentWork>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId)) return fail(TRY_AGAIN);
  try {
    const [jobs, drafts, proposals, stats] = await Promise.all([
      listAgentJobs(s.userId, agentId),
      listDrafts(s.userId, agentId),
      listProposals(s.userId, agentId),
      agentWorkStats(s.userId),
    ]);
    return {
      ok: true,
      data: { tasks: jobs.map(toTask), drafts, proposals, stats: stats[agentId] ?? { leads: 0, sent: 0, drafts: 0, replied: 0, researched: 0 } },
    };
  } catch (e) {
    console.error("loadAgentWork failed", e);
    return fail(MSG.serverDown);
  }
}

// Work numbers for every agent (the /agents cards).
export async function loadAgentStats(): Promise<Record<string, AgentWorkStats>> {
  try {
    const s = await getSession();
    return s ? await agentWorkStats(s.userId) : {};
  } catch (e) {
    console.error("loadAgentStats failed", e);
    return {};
  }
}

export async function loadTasks(jobIds: string[]): Promise<Task[]> {
  try {
    const s = await getSession();
    if (!s || !Array.isArray(jobIds) || jobIds.length > 50 || !jobIds.every((id) => typeof id === "string" && UUID_RE.test(id))) return [];
    return (await getJobs(s.userId, jobIds)).map(toTask);
  } catch (e) {
    console.error("loadTasks failed", e);
    return [];
  }
}

// Queues a lead search from the agent page (target 10). Pressing Find leads
// is the go-ahead, so it is queued at once; the browser then calls
// POST /api/scrape with the job id.
export async function startSearch(input: { agentId: string; instruction: string }): Promise<ActionResult<{ jobId: string }>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (!input || typeof input.agentId !== "string" || !AGENT_ID_RE.test(input.agentId)) return fail(TRY_AGAIN);
  if (typeof input.instruction !== "string") return fail(TRY_AGAIN);
  try {
    const res = await enqueueJob(s.userId, s.accountId, { agentId: input.agentId, kind: "scrape", instruction: input.instruction, target: SEARCH_TARGET.default });
    return typeof res === "string" ? fail(res) : { ok: true, data: { jobId: res.id } };
  } catch (e) {
    console.error("startSearch failed", e);
    return fail(MSG.serverDown);
  }
}

export type ScrapeProgress = {
  status: string;
  steps: Step[];
  leadsFound: number;
  sources: number;
  dropped: number;
  error: string | null;
};

// The live timeline of one search. Only the user-facing message is returned
// for a failed search, never a raw error.
export async function getScrapeProgress(jobId: string): Promise<ScrapeProgress | null> {
  try {
    const s = await getSession();
    if (!s || typeof jobId !== "string" || !UUID_RE.test(jobId)) return null;
    const job = await getJob(s.userId, jobId);
    if (!job || job.kind !== "scrape") return null;
    const r = job.result ?? {};
    const num = (k: string) => Number(r[k]) || 0;
    return {
      status: job.status,
      steps: Array.isArray(r.steps) ? (r.steps as Step[]) : [],
      leadsFound: num("leadsFound"),
      sources: num("sources"),
      dropped: num("dropped"),
      error: job.status === "failed" ? job.error || MSG_SEARCH_FAILED : null,
    };
  } catch (e) {
    console.error("getScrapeProgress failed", e);
    return null;
  }
}
