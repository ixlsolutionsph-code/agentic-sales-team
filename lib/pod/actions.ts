"use server";

// Thin server actions for Proceed / Cancel and the waiting steps: read the
// session, check the input, then call the server-only modules with the
// active workspace id.
import { capabilityLabel } from "@/lib/agentTypes";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { getSession } from "@/lib/auth/session";
import type { ChatResult, PendingApproval } from "@/lib/chat/contract";
import { stripMarkers } from "@/lib/chat/markers";
import { getJob, listTeamApprovals, moveJobStatus, type JobRow } from "@/lib/jobs/store";
import { UUID_RE } from "@/lib/products/shape";
import { TEAM_ID_RE } from "@/lib/teams/new";
import { approveStep, cancelStep } from "./decisions";
import { MSG_ALREADY_HANDLED, scrapeAskText, stageAskText } from "./summary";
import { isPodStage } from "./types";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const TRY_AGAIN = "Something went wrong. Please try again.";

export async function approveJob(jobId: string): Promise<ActionResult<ChatResult>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof jobId !== "string" || !UUID_RE.test(jobId)) return fail(TRY_AGAIN);
  try {
    const r = await approveStep(s.userId, jobId);
    if (r.error) return fail(r.error);
    return { ok: true, data: { messages: r.messages, follow: r.follow ? [r.follow] : [] } };
  } catch (e) {
    console.error("approveJob failed", e);
    return fail(MSG.serverDown);
  }
}

// Cancel on a waiting step (chat card or the team page). Stops the whole run
// of the job's team (cancelStep).
export async function rejectJob(jobId: string): Promise<ActionResult<ChatResult>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof jobId !== "string" || !UUID_RE.test(jobId)) return fail(TRY_AGAIN);
  try {
    const job = await getJob(s.userId, jobId);
    if (!job || !["needs_approval", "queued", "running"].includes(job.status)) return fail(MSG_ALREADY_HANDLED);
    const teamId = job.params.teamId;
    if (!teamId) {
      const done = (await moveJobStatus(s.userId, jobId, "needs_approval", "dismissed")) ?? (await moveJobStatus(s.userId, jobId, "queued", "dismissed"));
      return done ? { ok: true, data: { messages: [], follow: [] } } : fail(MSG_ALREADY_HANDLED);
    }
    const r = await cancelStep(s.userId, teamId, jobId);
    return { ok: true, data: { messages: r.messages, follow: [] } };
  } catch (e) {
    console.error("rejectJob failed", e);
    return fail(MSG.serverDown);
  }
}

// The ask when its message is gone (for example after Clear chat).
function generatedAsk(j: JobRow): string {
  if (j.kind === "scrape") return scrapeAskText(j.params.brief, Number(j.params.target) || 10, j.params.instruction ?? "");
  if (isPodStage(j.kind)) return stageAskText(j.kind, j.params.leadIds?.length ?? 0);
  return `I'm ready to start ${capabilityLabel(j.kind).toLowerCase()}. Proceed?`;
}

// Waiting steps of the workspace, or of one team.
export async function listPendingApprovals(teamId?: string): Promise<PendingApproval[]> {
  const s = await getSession();
  if (!s) return [];
  if (teamId !== undefined && (typeof teamId !== "string" || !TEAM_ID_RE.test(teamId))) return [];
  try {
    const rows = await listTeamApprovals(s.userId, teamId);
    return rows.map((r) => ({
      jobId: r.job.id,
      teamId: r.teamId,
      teamName: r.teamName,
      agentId: r.job.agentId,
      agentName: r.agentName,
      kind: r.job.kind,
      text: (r.askText && stripMarkers(r.askText)) || generatedAsk(r.job),
      createdAt: r.job.createdAt,
    }));
  } catch (e) {
    console.error("listPendingApprovals failed", e);
    return [];
  }
}
