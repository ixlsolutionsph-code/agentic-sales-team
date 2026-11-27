import "server-only";
import { capabilityLabel } from "@/lib/agentTypes";
import { isAIConfigured } from "@/lib/ai/gemini";
import { inAccountWorkspaces } from "@/lib/workspaces/scope";
import { leadsWithOpenDraft, loadRunAgent } from "./context";
import {
  AI_KINDS,
  DEFAULT_BATCH,
  INSTRUCTION_MAX,
  MAX_LEADS_PER_RUN,
  MSG_AGENT_UNAVAILABLE,
  MSG_INSTRUCTION_TOO_LONG,
  MSG_NO_AI,
  MSG_OPEN_DRAFT,
  MSG_RUNS_LIMIT,
  MSG_SEARCHES_LIMIT,
  MSG_SEARCH_NEEDS_TEXT,
  MSG_TOO_MANY_LEADS,
  RUNS_PER_DAY,
  SEARCH_TARGET,
  SEARCHES_PER_DAY,
  msgCantRun,
  type JobKind,
} from "./limits";
import { countRecentRuns, insertJob, type JobRow } from "./store";

export type EnqueueInput = {
  agentId: string;
  kind: JobKind;
  leadIds?: string[];
  batchSize?: number;
  instruction?: string;
  ask?: boolean; // true: wait for Proceed (needs_approval)
  teamId?: string;
  pod?: boolean;
  target?: number; // lead search: how many leads to find (1–25)
};

// Queues a run after the checks in 01-prd.md §7.5, in order: the agent is
// live; it has the capability; AI is set up for AI kinds; ≤ 25 leads; the
// instruction ≤ 500 characters; the daily limit (counted across every
// workspace of the account). Returns the job or a message for the user.
export async function enqueueJob(workspaceId: string, accountId: string, input: EnqueueInput): Promise<JobRow | string> {
  const agent = await loadRunAgent(workspaceId, input.agentId);
  if (!agent || agent.paused || agent.removed) return MSG_AGENT_UNAVAILABLE;
  if (!agent.capabilities.includes(input.kind)) return msgCantRun(input.kind);
  if (AI_KINDS.includes(input.kind) && !isAIConfigured()) return MSG_NO_AI;
  const leadIds = input.leadIds ? [...new Set(input.leadIds)] : undefined;
  if (leadIds && leadIds.length > MAX_LEADS_PER_RUN) return MSG_TOO_MANY_LEADS;
  const instruction = input.instruction?.trim();
  if (instruction && instruction.length > INSTRUCTION_MAX) return MSG_INSTRUCTION_TOO_LONG;
  const workspaces = await inAccountWorkspaces(accountId);
  const searches = input.kind === "scrape";
  const used = await countRecentRuns(workspaces.length ? workspaces : [workspaceId], searches ? "searches" : "runs");
  if (used >= (searches ? SEARCHES_PER_DAY : RUNS_PER_DAY)) return searches ? MSG_SEARCHES_LIMIT : MSG_RUNS_LIMIT;

  if (searches && !instruction) return MSG_SEARCH_NEEDS_TEXT;
  const batchSize = Math.min(MAX_LEADS_PER_RUN, Math.max(1, Math.floor(input.batchSize ?? DEFAULT_BATCH)));
  const target = Math.min(SEARCH_TARGET.max, Math.max(SEARCH_TARGET.min, Math.floor(input.target ?? SEARCH_TARGET.default)));
  const leadCount = searches ? target : (leadIds?.length ?? batchSize);
  return insertJob(workspaceId, {
    agentId: agent.id,
    kind: input.kind,
    status: input.ask ? "needs_approval" : "queued",
    params: {
      agent: { id: agent.id, name: agent.name, role: agent.role, goal: agent.goal, task: `${capabilityLabel(input.kind)} · ${leadCount} leads` },
      ...(leadIds ? { leadIds } : {}),
      batchSize,
      leadCount,
      ...(instruction ? { instruction } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
      ...(input.pod ? { pod: true } : {}),
      ...(searches ? { target } : {}),
    },
  });
}

// Outreach on chosen leads is refused when every one of them already has an
// open draft.
export async function enqueueOutreachJob(workspaceId: string, accountId: string, input: Omit<EnqueueInput, "kind">): Promise<JobRow | string> {
  if (input.leadIds?.length) {
    const open = await leadsWithOpenDraft(workspaceId, input.leadIds);
    if (open.length >= new Set(input.leadIds).size) return MSG_OPEN_DRAFT;
  }
  return enqueueJob(workspaceId, accountId, { ...input, kind: "outreach" });
}
