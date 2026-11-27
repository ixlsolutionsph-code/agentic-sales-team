import "server-only";
import { bookingProblem, meetingLabel, safeTimeZone } from "@/lib/ai/meetingTime";
import { capMode } from "@/lib/agents/settings";
import { marker } from "@/lib/chat/markers";
import { postTeamMessage } from "@/lib/chat/teamMessages";
import { loadAgentSettings } from "@/lib/jobs/context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { finishJob, mergeJobParams, moveJobStatus, type JobRow } from "@/lib/jobs/store";
import { bookMeetingRows, bookingRules } from "./store";

// The book-meeting step (01-prd.md §7.5: it has no runner; it books when the
// owner presses Proceed, or at once when the skill is on Auto).

export type MeetingPlan = { whenAt: string; whenLabel: string; title: string; timeZone: string };

// "Ana", "Ana and Ben", "Ana, Ben and 2 more" with «» pills.
export function namesText(names: string[]): string {
  const pills = names.map((n) => `«${n.replace(/[«»⟦⟧]/g, "")}»`);
  if (pills.length <= 1) return pills[0] ?? "";
  if (pills.length <= 3) return `${pills.slice(0, -1).join(", ")} and ${pills[pills.length - 1]}`;
  return `${pills.slice(0, 2).join(", ")} and ${pills.length - 2} more`;
}

export const askText = (type: string, names: string[], label: string) => `I'm ready to book a ${type} with ${namesText(names)} on ${label}. Proceed?`;
export const bookedText = (type: string, names: string[], label: string) =>
  `Done. I booked a ${type} with ${namesText(names)} on ${label}. It's on your calendar.`;

// Checks the time, then queues the step: Ask posts the Proceed ask, Auto books
// now. Returns an error text to post instead, or null.
export async function proposeMeeting(
  workspaceId: string,
  accountId: string,
  p: { teamId: string; agentId: string; agentName: string; leads: { id: string; name: string }[]; whenAt: string; timeZone: string },
): Promise<string | null> {
  const tz = safeTimeZone(p.timeZone);
  const rules = await bookingRules(workspaceId, p.agentId);
  const problem = bookingProblem(p.whenAt, rules, tz, new Date());
  if (problem) return problem;
  const label = meetingLabel(p.whenAt, rules.duration, tz);
  const job = await enqueueJob(workspaceId, accountId, {
    agentId: p.agentId,
    kind: "book-meeting",
    leadIds: p.leads.map((l) => l.id),
    ask: true,
    teamId: p.teamId,
  });
  if (typeof job === "string") return job;
  const plan: MeetingPlan = { whenAt: p.whenAt, whenLabel: label, title: rules.type, timeZone: tz };
  await mergeJobParams(workspaceId, job.id, { meeting: plan } as never);
  const names = p.leads.map((l) => l.name);
  if (capMode(await loadAgentSettings(workspaceId, p.agentId), "book-meeting") === "auto") {
    const running = await moveJobStatus(workspaceId, job.id, "needs_approval", "running");
    if (running) await bookFromJob(workspaceId, { ...running, params: { ...running.params, meeting: plan } as never });
    return null;
  }
  await postTeamMessage(workspaceId, p.teamId, p.agentId, `${askText(rules.type, names, label)}${marker("approve", job.id)}`);
  return null;
}

// Books a running book-meeting job: checks the window again (time may have
// passed), saves the meetings and posts the result in the team chat.
export async function bookFromJob(workspaceId: string, job: JobRow): Promise<void> {
  const plan = (job.params as unknown as { meeting?: MeetingPlan }).meeting;
  const teamId = job.params.teamId;
  const say = (text: string) => (teamId ? postTeamMessage(workspaceId, teamId, job.agentId, text) : Promise.resolve(null));
  if (!plan || !job.params.leadIds?.length) {
    await finishJob(job.id, "failed", {}, "Meeting details are missing.");
    await say("I couldn't book that meeting because its details are missing. Please ask me again.");
    return;
  }
  const rules = await bookingRules(workspaceId, job.agentId);
  const problem = bookingProblem(plan.whenAt, { ...rules, duration: rules.duration }, plan.timeZone, new Date());
  if (problem) {
    await finishJob(job.id, "failed", {}, problem);
    await say(problem);
    return;
  }
  const names = await bookMeetingRows(workspaceId, {
    agentId: job.agentId,
    agentName: job.params.agent?.name ?? "",
    leadIds: job.params.leadIds,
    whenAt: plan.whenAt,
    whenLabel: plan.whenLabel,
    title: plan.title,
  });
  if (!names.length) {
    await finishJob(job.id, "failed", {}, "Those leads no longer exist.");
    await say("I couldn't book it because those leads no longer exist.");
    return;
  }
  await finishJob(job.id, "done", { booked: names.length }, null);
  await say(bookedText(plan.title, names, plan.whenLabel));
}
