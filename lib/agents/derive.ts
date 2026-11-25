// What the screen shows for agents and teams, derived from stored data.
// Agent status is never read from agents.status: it comes from live jobs and
// the paused flag (01-prd.md §7.1).
import type { Agent, AgentConfig, AgentState, Team } from "@/lib/types";
import { capabilityLabel, TEAM_TEMPLATES } from "@/lib/agentTypes";
import type { AgentStatus } from "@/lib/visuals";
import { sumNumbers, type AgentNumbers } from "@/lib/workspace/statsShape";
import { effectiveRoleGoal } from "./settings";

// A job as far as the status needs it. Jobs arrive in Milestone 7.
export type LiveJob = { agentId: string; kind: string; status: string; leadCount: number };

const LIVE = new Set(["queued", "running"]);

export function agentNow(
  agent: { id: string },
  state: AgentState | undefined,
  jobs: LiveJob[] = [],
): { status: AgentStatus; task: string } {
  const live = jobs.find((j) => j.agentId === agent.id && LIVE.has(j.status));
  if (live) return { status: "working", task: `${capabilityLabel(live.kind)} · ${live.leadCount} leads` };
  if (state?.paused) return { status: "waiting", task: "Paused" };
  return { status: "idle", task: "Idle" };
}

export function isRemoved(agentId: string, states: Record<string, AgentState>): boolean {
  return states[agentId]?.removed === true;
}

// Agents that are not deleted, with their edits (role, goal) applied.
export function visibleAgents(
  agents: Agent[],
  states: Record<string, AgentState>,
  config: Record<string, AgentConfig>,
): Agent[] {
  return agents
    .filter((a) => !isRemoved(a.id, states))
    .map((a) => ({ ...a, ...effectiveRoleGoal(a, config[a.id]) }));
}

export function liveAgentCount(agents: { id: string }[], states: Record<string, AgentState>, jobs: LiveJob[] = []): number {
  return agents.filter((a) => !isRemoved(a.id, states) && agentNow(a, states[a.id], jobs).status === "working").length;
}

// "{template} team · N agents" (team page, Milestone 5).
export function teamSubtitle(team: Pick<Team, "template">, memberCount: number): string {
  const label = TEAM_TEMPLATES.find((t) => t.id === team.template)?.label ?? "Custom";
  return `${label} team · ${memberCount} ${memberCount === 1 ? "agent" : "agents"}`;
}

// Team KPIs: Meetings, In pipeline, Leads, Avg lead score, worked out from the
// members' accepted leads. The legacy teams.meetings / pipeline / leads
// columns are never used. Scores of 0 (not scored) don't count toward the average.
export function teamKpis(memberIds: string[], perAgent: Record<string, AgentNumbers>) {
  const t = sumNumbers(memberIds, perAgent);
  return {
    meetings: t.meetings,
    pipeline: t.pipeline,
    leads: t.leads,
    avgScore: t.scoredCount ? Math.round(t.scoredSum / t.scoredCount) : 0,
  };
}

// How many of these agents are working right now.
export function workingCount(agentIds: string[], states: Record<string, AgentState>, jobs: LiveJob[] = []): number {
  return agentIds.filter((id) => !isRemoved(id, states) && agentNow({ id }, states[id], jobs).status === "working").length;
}
