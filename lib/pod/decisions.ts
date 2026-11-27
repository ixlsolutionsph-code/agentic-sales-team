import "server-only";
import type { ChatMessage } from "@/lib/types";
import type { FollowJob } from "@/lib/chat/contract";
import { postTeamMessage } from "@/lib/chat/teamMessages";
import { bookFromJob } from "@/lib/meetings/book";
import {
  dismissTeamOpenJobs,
  flagRecentRunJobs,
  flagTeamRunningJobs,
  getJob,
  latestTeamPodJob,
  moveJobStatus,
  teamRunJobs,
  type JobRow,
} from "@/lib/jobs/store";
import { MSG_ALREADY_HANDLED, MSG_WONT_BOOK, cancelSummary, startText } from "./summary";

// Proceed and Cancel (01-prd.md §7.5, 03-user-journey.md J6).


// Proceed: needs_approval → queued, posts the start text. Returns the posted
// messages and the job to follow.
export async function approveStep(workspaceId: string, jobId: string): Promise<{ messages: ChatMessage[]; follow: FollowJob | null; error?: string }> {
  const job = await getJob(workspaceId, jobId);
  if (!job || job.status !== "needs_approval") return { messages: [], follow: null, error: MSG_ALREADY_HANDLED };
  // book-meeting books on Proceed; that flow comes with meetings (Milestone 10).
  // book-meeting has no runner: Proceed books it here.
  if (job.kind === "book-meeting") {
    const running = await moveJobStatus(workspaceId, jobId, "needs_approval", "running");
    if (!running) return { messages: [], follow: null, error: MSG_ALREADY_HANDLED };
    await bookFromJob(workspaceId, running);
    return { messages: [], follow: null };
  }
  const queued = await moveJobStatus(workspaceId, jobId, "needs_approval", "queued");
  if (!queued) return { messages: [], follow: null, error: MSG_ALREADY_HANDLED };
  const messages: ChatMessage[] = [];
  if (queued.params.teamId) messages.push(await postTeamMessage(workspaceId, queued.params.teamId, queued.agentId, startText(queued.kind, queued.id)));
  return { messages, follow: { jobId: queued.id, kind: queued.kind } };
}

const nameOf = (j: JobRow) => j.params.agent?.name ?? "";

// Cancel: this job and every other needs_approval or queued job of the team →
// dismissed; posts the summary. jobId may be null (a typed "stop").
//
// Running jobs of the team are flagged `stopped`: they finish, and chainNext
// then hands nothing on. The summary lists the jobs of the newest run (the
// pressed job's run, else the team's newest chain job's run). When nothing
// was waiting, queued or running, the run was already over, and the
// "nothing changed" text is posted instead of an old summary.
export async function cancelStep(workspaceId: string, teamId: string, jobId: string | null): Promise<{ messages: ChatMessage[] }> {
  const target = jobId ? await getJob(workspaceId, jobId) : null;
  const team = target?.params.teamId ?? teamId;

  if (target?.kind === "book-meeting") {
    (await moveJobStatus(workspaceId, target.id, "needs_approval", "dismissed")) ??
      (await moveJobStatus(workspaceId, target.id, "queued", "dismissed"));
    return { messages: [await postTeamMessage(workspaceId, team, target.agentId, MSG_WONT_BOOK)] };
  }

  // A step of no team (not from chat): only that step is dismissed.
  if (target && !target.params.teamId) {
    (await moveJobStatus(workspaceId, target.id, "needs_approval", "dismissed")) ??
      (await moveJobStatus(workspaceId, target.id, "queued", "dismissed"));
  }

  const latest = target?.params.teamId ? target : await latestTeamPodJob(workspaceId, team);
  const runId = latest ? (latest.params.runId ?? latest.id) : null;
  const dismissed = await dismissTeamOpenJobs(workspaceId, team);
  const running = await flagTeamRunningJobs(workspaceId, team, "stopped");
  const justDone = runId ? await flagRecentRunJobs(workspaceId, team, runId) : [];

  let jobs: JobRow[] = [];
  if (dismissed.length || running.length || justDone.length) {
    jobs = runId ? await teamRunJobs(workspaceId, team, runId) : [];
    for (const r of running) if (!jobs.some((j) => j.id === r.id)) jobs.push(r);
  }
  const text = cancelSummary(jobs.map((j) => ({ kind: j.kind, status: j.status, agentName: nameOf(j), result: j.result })));
  const who = target?.agentId ?? running[0]?.agentId ?? dismissed[0]?.agentId ?? latest?.agentId ?? "system";
  return { messages: [await postTeamMessage(workspaceId, team, who, text)] };
}

// Dismisses every waiting or queued job of the team, posts nothing (Clear chat).
// Running jobs are flagged `cleared`: they finish, post nothing and hand nothing on.
export async function dismissTeamJobs(workspaceId: string, teamId: string): Promise<number> {
  const dismissed = await dismissTeamOpenJobs(workspaceId, teamId);
  await flagTeamRunningJobs(workspaceId, teamId, "cleared");
  return dismissed.length;
}
